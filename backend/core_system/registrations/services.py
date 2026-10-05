"""
منطق الأعمال لمسار التسجيل اليدوي (شام كاش) وإدارة الطلبات.
كل التحولات في حالة الطلب تتم داخل transaction مع select_for_update لمنع السباقات
(موافقتان متزامنتان، رفع إيصال أثناء الرفض، ...).
"""
import calendar
import hashlib
import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.http import Http404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException

from core_system.payments.models import PaymentTransaction
from core_system.subscriptions.models import Subscription
from core_system.tenants.models import Tenant
from core_system.tenants.provisioning import ProvisioningError, create_tenant_database

from .models import PaymentReceipt, RegistrationEvent, RegistrationRequest
from .utils import (ALLOWED_RECEIPT_TYPES, derive_db_name, generate_password, new_upload_token,
                    normalize_ext, pdf_has_active_content, sanitize_display_name, sniff_receipt_type)

logger = logging.getLogger(__name__)
S = RegistrationRequest.Status

STALE_PROVISIONING_MINUTES = 10


class Conflict(APIException):
    status_code = 409
    default_detail = 'تعارض مع الحالة الحالية للطلب'
    default_code = 'conflict'


def _lock(req_id):
    """يقفل صف الطلب (داخل transaction) ويعيد 404 بدل 500 إن لم يوجد."""
    try:
        return RegistrationRequest.objects.select_for_update().get(pk=req_id)
    except RegistrationRequest.DoesNotExist:
        raise Http404


# ------------------------------------------------------------------ audit
def log_event(req, action, detail='', admin=None):
    RegistrationEvent.objects.create(
        request=req, actor=admin, action=action, detail=detail[:2000],
        actor_label=(admin.email if admin else 'applicant'),
    )


def _add_months(dt, months):
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


# ------------------------------------------------------------------ public flow
def create_registration_request(data, ip=None):
    """يُنشئ طلب تسجيل ذاتي بحالة PENDING_PAYMENT. يعيد (الطلب, رمز الرفع الخام)."""
    plan = data['plan']
    raw_token, token_hash = new_upload_token()
    try:
        with transaction.atomic():
            if Tenant.objects.filter(subdomain=data['subdomain']).exists():
                raise serializers.ValidationError({'subdomain': 'هذا النطاق الفرعي مستخدم'})
            req = RegistrationRequest.objects.create(
                source=RegistrationRequest.Source.SELF_SERVICE,
                status=S.PENDING_PAYMENT,
                mosque_name=data['mosque_name'],
                subdomain=data['subdomain'],
                contact_phone=data['contact_phone'],
                contact_email=data.get('contact_email', ''),
                center_latitude=data.get('center_latitude'),
                center_longitude=data.get('center_longitude'),
                admin_password_hash=make_password(data['admin_password']),
                plan=plan,
                amount_usd=plan.price_usd,
                upload_token_hash=token_hash,
                submitted_ip=ip,
            )
            log_event(req, 'created', f'plan={plan.code} amount={plan.price_usd}')
    except IntegrityError:
        raise serializers.ValidationError({'subdomain': 'هذا النطاق الفرعي محجوز لطلب آخر'})
    return req, raw_token


def validate_receipt_file(uploaded):
    """تحقق خادمي صارم: الحجم، الامتداد، البايتات السحرية، تطابق الامتداد مع المحتوى، محتوى PDF النشط."""
    max_bytes = settings.RECEIPT_MAX_BYTES
    if uploaded.size is None or uploaded.size <= 0:
        raise serializers.ValidationError({'file': 'الملف فارغ'})
    if uploaded.size > max_bytes:
        raise serializers.ValidationError({'file': f'حجم الملف يتجاوز {max_bytes // (1024 * 1024)} ميغابايت'})

    ext = normalize_ext(uploaded.name)
    if ext not in ALLOWED_RECEIPT_TYPES:
        raise serializers.ValidationError({'file': 'الأنواع المسموحة: PNG, JPG, WEBP, PDF'})

    data = uploaded.read(max_bytes + 1)          # لا نثق بـ uploaded.size وحده
    if len(data) > max_bytes:
        raise serializers.ValidationError({'file': 'حجم الملف يتجاوز الحد المسموح'})

    kind = sniff_receipt_type(data[:2048])
    if kind is None or kind != ext:
        raise serializers.ValidationError({'file': 'محتوى الملف لا يطابق نوعه أو أنه غير مدعوم'})
    if kind == 'pdf':
        if b'%%EOF' not in data[-2048:]:
            raise serializers.ValidationError({'file': 'ملف PDF غير مكتمل أو تالف'})
        if pdf_has_active_content(data):
            raise serializers.ValidationError({'file': 'ملف PDF يحتوي على محتوى نشط غير مسموح'})
    return kind, data


def attach_receipt(req_id, uploaded, reference_number='', ip=None):
    kind, data = validate_receipt_file(uploaded)
    digest = hashlib.sha256(data).hexdigest()
    saved_name = None
    try:
        with transaction.atomic():
            req = _lock(req_id)
            if req.status not in (S.PENDING_PAYMENT, S.PENDING_APPROVAL):
                raise Conflict('لا يمكن رفع إيصال لهذا الطلب في حالته الحالية')
            if req.receipts.count() >= settings.RECEIPT_MAX_FILES_PER_REQUEST:
                raise Conflict('تم بلوغ الحد الأقصى لعدد الإيصالات لهذا الطلب')
            reused = (PaymentReceipt.objects.filter(sha256=digest).exclude(request=req)
                      .exclude(request__status=S.REJECTED).exists())
            if reused or req.receipts.filter(sha256=digest).exists():
                raise Conflict('هذا الإيصال مرفوع مسبقاً')

            receipt = PaymentReceipt(
                request=req,
                original_name=sanitize_display_name(uploaded.name),
                content_type=ALLOWED_RECEIPT_TYPES[kind],
                size=len(data),
                sha256=digest,
                reference_number=(reference_number or '')[:60],
                uploaded_ip=ip,
            )
            receipt.file.save('receipt', ContentFile(data), save=False)
            saved_name = receipt.file.name
            receipt.save()

            if req.status == S.PENDING_PAYMENT:
                req.status = S.PENDING_APPROVAL
                req.save(update_fields=['status', 'updated_at'])
            log_event(req, 'receipt_uploaded', f'{receipt.original_name} ({receipt.content_type}, {receipt.size}B)')
    except Exception:
        # لا نترك ملفاً يتيماً على القرص إن فشلت المعاملة
        if saved_name:
            try:
                PaymentReceipt._meta.get_field('file').storage.delete(saved_name)
            except Exception:                                       # noqa: BLE001
                logger.warning('could not clean orphan receipt %s', saved_name)
        raise
    return receipt


# ------------------------------------------------------------------ review flow
def reject_request(req_id, admin, reason):
    with transaction.atomic():
        req = _lock(req_id)
        if req.status not in (S.PENDING_PAYMENT, S.PENDING_APPROVAL):
            raise Conflict('لا يمكن رفض طلب في هذه الحالة')
        req.status = S.REJECTED
        req.rejection_reason = reason
        req.reviewed_by = admin
        req.reviewed_at = timezone.now()
        req.admin_password_hash = ''
        req.save()
        log_event(req, 'rejected', reason, admin)
    return req


def begin_provisioning(req_id, admin, retry=False):
    """ينقل الطلب إلى PROVISIONING (مقفولاً بصف واحد) — يمنع موافقتين متزامنتين."""
    with transaction.atomic():
        req = _lock(req_id)
        now = timezone.now()
        stale = (req.status == S.PROVISIONING and req.provisioning_started_at
                 and req.provisioning_started_at < now - timedelta(minutes=STALE_PROVISIONING_MINUTES))
        if retry:
            if req.status != S.FAILED and not stale:
                raise Conflict('إعادة المحاولة متاحة فقط للطلبات الفاشلة أو العالقة')
        elif req.status != S.PENDING_APPROVAL:
            raise Conflict('يمكن الموافقة فقط على الطلبات بانتظار الموافقة')
        if (req.source == RegistrationRequest.Source.SELF_SERVICE and not req.receipts.exists()):
            raise serializers.ValidationError('لا يوجد إيصال دفع مرفق بهذا الطلب')
        if not req.admin_password_hash:
            raise Conflict('بيانات مدير المسجد غير متوفرة؛ يجب إنشاء طلب جديد')

        req.status = S.PROVISIONING
        req.reviewed_by = req.reviewed_by or admin
        req.reviewed_at = req.reviewed_at or now
        req.provisioning_started_at = now
        req.provisioning_attempts += 1
        req.provisioning_error = ''
        req.save()
        log_event(req, 'provisioning_retry' if retry else 'approved', f'attempt {req.provisioning_attempts}', admin)
    return req


def dispatch_provisioning(req_id):
    if getattr(settings, 'PROVISIONING_ASYNC', False):
        try:
            from .tasks import provision_registration_task
            provision_registration_task.delay(str(req_id))
            return 'queued'
        except Exception:                                           # noqa: BLE001
            logger.exception('Celery unavailable, provisioning synchronously')
    run_provisioning(req_id)
    return 'done'


def _ensure_tenant(req):
    if req.tenant_id:
        return req.tenant
    if Tenant.objects.filter(subdomain=req.subdomain).exists():
        raise ProvisioningError('يوجد مسجد بنفس النطاق الفرعي مسبقاً')
    tenant = Tenant.objects.create(
        name=req.mosque_name,
        subdomain=req.subdomain,
        db_name=derive_db_name(req.subdomain),
        db_user='', db_password_hash='',
        contact_phone=req.contact_phone,
        contact_email=req.contact_email or None,
        is_active=False,                       # لا يُفعَّل (ولا يُسمح بالدخول) قبل اكتمال التجهيز
    )
    req.tenant = tenant
    req.save(update_fields=['tenant', 'updated_at'])
    return tenant


def run_provisioning(req_id):
    """ينفّذ الإنشاء الفعلي. آمن للاستدعاء المتكرر (idempotent)."""
    req = RegistrationRequest.objects.select_related('plan').get(pk=req_id)
    if req.status != S.PROVISIONING:
        return req
    try:
        tenant = _ensure_tenant(req)
        create_tenant_database(
            tenant,
            center_lat=req.center_latitude, center_lng=req.center_longitude,
            admin_password_hash=req.admin_password_hash,
            admin_username=req.admin_username, admin_first_name=req.admin_first_name,
            admin_email=req.contact_email or None,
        )
        _finalize_success(req, tenant)
    except ProvisioningError as exc:
        _mark_failed(req_id, str(exc))
    except Exception as exc:                                        # noqa: BLE001
        logger.exception('unexpected provisioning failure for request %s', req_id)
        _mark_failed(req_id, f'خطأ غير متوقع ({exc.__class__.__name__})')
    return RegistrationRequest.objects.get(pk=req_id)


def _finalize_success(req, tenant):
    with transaction.atomic():
        tenant.is_active = True
        tenant.save(update_fields=['is_active', 'updated_at'])

        if req.plan and not Subscription.objects.filter(tenant=tenant).exists():
            now = timezone.now()
            months = 12 if req.plan.billing_cycle == 'ANNUAL' else 1
            sub = Subscription.objects.create(
                tenant=tenant, plan=req.plan, status='ACTIVE',
                starts_at=now, ends_at=_add_months(now, months), auto_renew=False,
            )
            if req.source == RegistrationRequest.Source.SELF_SERVICE and req.amount_usd is not None:
                ref = req.receipts.exclude(reference_number='').values_list('reference_number', flat=True).first()
                PaymentTransaction.objects.get_or_create(
                    transaction_id=f'REG-{req.id}',
                    defaults={'subscription': sub, 'amount': req.amount_usd, 'currency': 'USD',
                              'payment_method': 'SHAM_CASH', 'status': 'SUCCESS'},
                )
                if ref:
                    log_event(req, 'payment_reference', ref)

        req.status = S.APPROVED
        req.admin_password_hash = ''             # لم نعد بحاجتها: المسجد صار يملك مستخدمه
        req.provisioning_error = ''
        req.save()
        log_event(req, 'provisioned', f'tenant={tenant.id}')


def _mark_failed(req_id, message):
    with transaction.atomic():
        req = _lock(req_id)
        req.status = S.FAILED
        req.provisioning_error = message[:500]
        req.save(update_fields=['status', 'provisioning_error', 'updated_at'])
        log_event(req, 'provisioning_failed', message)


# ------------------------------------------------------------------ manual creation by platform admin
def create_mosque_manually(data, admin):
    """
    إضافة مسجد وتعيين مسؤوله مباشرة من الأدمن العام دون مسار الدفع.
    يعيد (الطلب, كلمة المرور المولَّدة إن لم تُرسَل — تُعرض مرة واحدة فقط).
    """
    generated = None
    password = data.get('admin_password')
    if not password:
        generated = password = generate_password()
    plan = data.get('plan')
    try:
        with transaction.atomic():
            if Tenant.objects.filter(subdomain=data['subdomain']).exists():
                raise serializers.ValidationError({'subdomain': 'هذا النطاق الفرعي مستخدم'})
            now = timezone.now()
            req = RegistrationRequest.objects.create(
                source=RegistrationRequest.Source.ADMIN_CREATED,
                status=S.PROVISIONING,
                mosque_name=data['mosque_name'],
                subdomain=data['subdomain'],
                contact_phone=data['contact_phone'],
                contact_email=data.get('contact_email', ''),
                center_latitude=data.get('center_latitude'),
                center_longitude=data.get('center_longitude'),
                admin_username=data.get('admin_username') or 'manager',
                admin_first_name=data.get('admin_full_name', ''),
                admin_password_hash=make_password(password),
                plan=plan,
                amount_usd=plan.price_usd if plan else None,
                reviewed_by=admin, reviewed_at=now,
                provisioning_started_at=now, provisioning_attempts=1,
                submitted_ip=None,
            )
            log_event(req, 'created_by_admin', f'plan={plan.code if plan else "-"}', admin)
    except IntegrityError:
        raise serializers.ValidationError({'subdomain': 'هذا النطاق الفرعي محجوز لطلب آخر'})
    return req, generated

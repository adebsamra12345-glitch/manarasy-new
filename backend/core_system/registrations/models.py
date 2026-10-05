import os
import uuid

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models
from django.db.models import Q

from core_system.subscriptions.models import Plan
from core_system.tenants.models import Tenant

from .utils import ALLOWED_RECEIPT_TYPES

_EXT_BY_MIME = {mime: ext for ext, mime in ALLOWED_RECEIPT_TYPES.items()}


class PrivateReceiptStorage(FileSystemStorage):
    """تخزين خاص: المسار يُقرأ من settings.PRIVATE_MEDIA_ROOT وقت الاستخدام، ولا يوجد له URL عام إطلاقاً."""

    @property
    def base_location(self):
        return settings.PRIVATE_MEDIA_ROOT

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    def url(self, name):
        raise ValueError('ملفات الإيصالات خاصة ولا تملك رابطاً عاماً')


def receipt_storage():
    return PrivateReceiptStorage()


def receipt_upload_to(instance, filename):
    """اسم الملف على القرص يُولَّد على الخادم بالكامل (UUID + امتداد من النوع المتحقق منه)."""
    ext = _EXT_BY_MIME.get(instance.content_type, 'bin')
    return f'receipts/{instance.request_id}/{uuid.uuid4().hex}.{ext}'


class RegistrationRequest(models.Model):
    class Status(models.TextChoices):
        PENDING_PAYMENT = 'PENDING_PAYMENT', 'بانتظار إيصال الدفع'
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'بانتظار موافقة الأدمن'
        PROVISIONING = 'PROVISIONING', 'جارٍ تجهيز قاعدة البيانات'
        APPROVED = 'APPROVED', 'مقبول'
        REJECTED = 'REJECTED', 'مرفوض'
        FAILED = 'PROVISIONING_FAILED', 'فشل التجهيز'

    class Source(models.TextChoices):
        SELF_SERVICE = 'SELF_SERVICE', 'تسجيل ذاتي'
        ADMIN_CREATED = 'ADMIN_CREATED', 'أضافه أدمن المنصة'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.SELF_SERVICE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_PAYMENT, db_index=True)

    # بيانات المسجد
    mosque_name = models.CharField(max_length=150)
    subdomain = models.CharField(max_length=63)
    contact_phone = models.CharField(max_length=20)
    contact_email = models.EmailField(max_length=100, blank=True, default='')
    center_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    center_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    # مسؤول المسجد: كلمة المرور تُخزَّن مُجزَّأة (Django hasher) ولا تُحفظ خام أبداً، وتُمسح بعد نجاح التجهيز
    admin_username = models.CharField(max_length=150, default='manager')
    admin_first_name = models.CharField(max_length=150, blank=True, default='')
    admin_password_hash = models.CharField(max_length=255, blank=True, default='')

    # الاشتراك (لقطة من الخطة وقت الطلب؛ السعر لا يأتي من العميل)
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='registration_requests', null=True, blank=True)
    amount_usd = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # رمز رفع الإيصال: يُعاد للمسجِّل مرة واحدة، ونحفظ sha256 فقط
    upload_token_hash = models.CharField(max_length=64, blank=True, default='')

    # المراجعة
    rejection_reason = models.TextField(blank=True, default='')
    reviewed_by = models.ForeignKey('platform_auth.PlatformAdmin', null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='reviewed_registrations')
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # نتيجة التجهيز
    tenant = models.OneToOneField(Tenant, null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name='registration_request')
    provisioning_error = models.TextField(blank=True, default='')
    provisioning_attempts = models.PositiveSmallIntegerField(default=0)
    provisioning_started_at = models.DateTimeField(null=True, blank=True)

    submitted_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'registration_requests'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['status', '-created_at'], name='regreq_status_created_idx')]
        constraints = [
            # لا يجوز لطلبين مفتوحين حجز نفس الـ subdomain (الرفض يحرّر الاسم)
            models.UniqueConstraint(
                fields=['subdomain'], condition=~Q(status='REJECTED'), name='uniq_open_registration_subdomain'),
        ]

    def __str__(self):
        return f'{self.mosque_name} ({self.subdomain}) [{self.status}]'


class PaymentReceipt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request = models.ForeignKey(RegistrationRequest, on_delete=models.CASCADE, related_name='receipts')
    file = models.FileField(upload_to=receipt_upload_to, storage=receipt_storage, max_length=255)
    original_name = models.CharField(max_length=120)          # للعرض فقط
    content_type = models.CharField(max_length=50)            # من فحص البايتات، لا من العميل
    size = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64, db_index=True)   # لكشف إعادة استخدام نفس الإيصال
    reference_number = models.CharField(max_length=60, blank=True, default='')   # رقم عملية شام كاش (اختياري)
    uploaded_ip = models.GenericIPAddressField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'registration_receipts'
        ordering = ['uploaded_at']

    def __str__(self):
        return f'{self.original_name} ({self.request_id})'


class RegistrationEvent(models.Model):
    """سجل تدقيق append-only لكل ما يحدث على الطلب."""
    request = models.ForeignKey(RegistrationRequest, on_delete=models.CASCADE, related_name='events')
    actor = models.ForeignKey('platform_auth.PlatformAdmin', null=True, blank=True, on_delete=models.SET_NULL)
    actor_label = models.CharField(max_length=150, default='applicant')   # بريد الأدمن وقت الحدث، أو applicant/system
    action = models.CharField(max_length=40)
    detail = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'registration_events'
        ordering = ['created_at']

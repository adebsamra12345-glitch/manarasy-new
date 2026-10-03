import json
import logging
from decimal import Decimal
import math
from datetime import datetime, date, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone
from django.db.models import Q, Sum, Avg, Count
from django.db.models.functions import Coalesce

from tenant_modules.users.models import UserProfile
from tenant_modules.students_and_parents.models import Student, EvaluationLog, StudentEnrollment
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.centers_and_projects.models import Center, SystemNotification
from tenant_modules.attendance.models import AttendanceLog, HalaqaSession
from tenant_modules.recitation_and_sabr.models import RecitationLog
from .models import (
    PointTransaction, Reward, RewardClaim,
    Competition, CompetitionSection, CompetitionQuestion,
    CompetitionParticipation, QuestionAnswer
)
from .services import PointsService

logger = logging.getLogger(__name__)


import requests
from django.http import HttpResponse

def image_proxy_view(request):
    url = request.GET.get('url')
    if not url:
        return HttpResponse("Missing url parameter", status=400)
    try:
        r = requests.get(url, stream=True, timeout=5)
        content_type = r.headers.get('Content-Type', 'image/jpeg')
        if not content_type.startswith('image/'):
            content_type = 'image/jpeg'
        response = HttpResponse(r.raw, content_type=content_type)
        response['Cache-Control'] = 'public, max-age=86400'
        return response
    except Exception as e:
        return HttpResponse(str(e), status=400)

def get_tenant_db_and_obj(request):
    tenant_id = request.headers.get('Tenant-ID')
    if not tenant_id:
        return 'default', None
    try:
        from core_system.tenants.models import Tenant
        tenant = Tenant.objects.using('default').get(id=tenant_id)
        db_name = tenant.db_name
        if db_name not in settings.DATABASES:
            new_db_config = settings.DATABASES['default'].copy()
            new_db_config.update({
                'NAME': tenant.db_name,
                'USER': tenant.db_user or settings.DATABASES['default'].get('USER'),
                'PASSWORD': tenant.db_password_hash or settings.DATABASES['default'].get('PASSWORD'),
                'HOST': tenant.db_host or 'localhost',
                'PORT': tenant.db_port or 5432,
            })
            settings.DATABASES[db_name] = new_db_config
        return db_name, tenant
    except Exception:
        return 'default', None


def get_tenant_db(request):
    db_name, _ = get_tenant_db_and_obj(request)
    return db_name


def parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except Exception:
        raise ValueError("صيغة JSON غير صالحة")


def resolve_student_for_user(db, profile, requested_student_id=None):
    """
    استخراج سجل الطالب المرتبط بالمستخدم مباشرة
    """
    children_list = []
    active_student = None

    student = getattr(profile.user, 'student_profile', None)
    if not student:
        student = Student.objects.using(db).filter(
            Q(user=profile.user) | 
            Q(national_id=profile.user.username) | 
            Q(enrollments__user_profile=profile)
        ).select_related('halaqa', 'halaqa__center').first()

    if student:
        active_student = student
        children_list = [{
            'id': str(student.id),
            'full_name': student.full_name,
            'gender': student.gender,
            'gender_display': 'ذكر' if student.gender == 'M' else 'أنثى',
            'halaqa_id': str(student.halaqa.id) if student.halaqa else None,
            'halaqa_name': student.halaqa.name if student.halaqa else 'غير محدد',
            'center_name': student.halaqa.center.name if (student.halaqa and student.halaqa.center) else 'المركز الرئيسي',
            'reached_page': student.reached_page or 1,
            'points': student.points
        }]

    return active_student, children_list, False


# ==========================================
# 1. نقاط الطلاب وسجل الحركات
# ==========================================

@csrf_exempt
def student_points_list_view(request):
    """
    عرض قائمة الطلاب مع رصيد النقاط والبحث والفلترة
    """
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    search = request.GET.get('search', '').strip()
    center_id = request.GET.get('center_id')
    halaqa_id = request.GET.get('halaqa_id')

    qs = Student.objects.using(db).select_related('halaqa', 'halaqa__center').all()

    if profile.role == 'CENTER_MANAGER' and profile.center_id:
        qs = qs.filter(halaqa__center_id=profile.center_id)
    elif center_id:
        qs = qs.filter(halaqa__center_id=center_id)

    if halaqa_id:
        qs = qs.filter(halaqa_id=halaqa_id)

    if search:
        qs = qs.filter(
            Q(full_name__icontains=search) |
            Q(national_id__icontains=search) |
            Q(registration_number__icontains=search)
        )

    students = []
    for s in qs.order_by('full_name'):
        students.append({
            'id': str(s.id),
            'full_name': s.full_name,
            'national_id': s.national_id,
            'registration_number': s.registration_number,
            'gender': s.gender,
            'gender_display': 'ذكر' if s.gender == 'M' else 'أنثى',
            'points': s.points,
            'reached_page': s.reached_page,
            'halaqa_id': str(s.halaqa.id) if s.halaqa else None,
            'halaqa_name': s.halaqa.name if s.halaqa else 'غير محدد',
            'center_id': str(s.halaqa.center.id) if (s.halaqa and s.halaqa.center) else None,
            'center_name': s.halaqa.center.name if (s.halaqa and s.halaqa.center) else 'غير محدد',
        })

    return JsonResponse({'status': 'success', 'data': students})


@csrf_exempt
def grant_bonus_points_view(request):
    """
    منح مكافأة سلوكية لطالب (+1 نقطة لسلوك ممتاز)
    """
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    if profile.role not in ['TENANT_ADMIN', 'SUPER_ADMIN', 'CENTER_MANAGER', 'TEACHER']:
        return JsonResponse({'status': 'error', 'message': 'ليس لديك صلاحية منح نقاط'}, status=403)

    try:
        data = parse_body(request)
        student_id = data.get('student_id')
        reason = data.get('reason', '').strip()

        if not student_id:
            return JsonResponse({'status': 'error', 'message': 'معرف الطالب مطلوب'}, status=400)
        if not reason:
            return JsonResponse({'status': 'error', 'message': 'سبب المكافأة مطلوب'}, status=400)

        result = PointsService.grant_behavioral_bonus(
            db_name=db,
            student_id=student_id,
            performed_by=profile,
            reason=reason
        )

        return JsonResponse({'status': 'success', 'message': 'تم منح +1 نقطة مكافأة سلوكية بنجاح', 'data': result})

    except ValueError as ve:
        return JsonResponse({'status': 'error', 'message': str(ve)}, status=400)
    except Exception as e:
        logger.error(f"Error in grant_bonus_points_view: {e}")
        return JsonResponse({'status': 'error', 'message': 'حدث خطأ أثناء منح النقاط'}, status=500)


@csrf_exempt
def points_transactions_view(request):
    """
    كشف حساب وسجل حركات النقاط
    """
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    student_id = request.GET.get('student_id')
    tx_type = request.GET.get('type')

    qs = PointTransaction.objects.using(db).select_related('student', 'performed_by', 'performed_by__user').all()

    if student_id:
        qs = qs.filter(student_id=student_id)
    if tx_type:
        qs = qs.filter(transaction_type=tx_type)

    if profile.role == 'CENTER_MANAGER' and profile.center_id:
        qs = qs.filter(student__halaqa__center_id=profile.center_id)

    transactions = []
    for tx in qs.order_by('-created_at')[:100]:
        performed_by_name = tx.performed_by.user.get_full_name() if (tx.performed_by and tx.performed_by.user) else 'النظام'
        transactions.append({
            'id': str(tx.id),
            'student_id': str(tx.student.id),
            'student_name': tx.student.full_name,
            'amount': tx.amount,
            'transaction_type': tx.transaction_type,
            'transaction_type_display': tx.get_transaction_type_display(),
            'reason': tx.reason,
            'balance_before': tx.balance_before,
            'balance_after': tx.balance_after,
            'performed_by': performed_by_name,
            'created_at': tx.created_at.strftime('%Y-%m-%d %H:%M'),
        })

    return JsonResponse({'status': 'success', 'data': transactions})


# ==========================================
# 2. نظام المكافآت والمتجر وإدارة الطلبات
# ==========================================

@csrf_exempt
def rewards_list_create_view(request):
    """
    قائمة المكافآت وإضافة مكافأة جديدة
    """
    db, tenant_obj = get_tenant_db_and_obj(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    if request.method == 'GET':
        qs = Reward.objects.using(db).all()
        if profile.role == 'CENTER_MANAGER' and profile.center_id:
            qs = qs.filter(Q(center_id=profile.center_id) | Q(center__isnull=True))

        rewards = []
        for r in qs:
            rewards.append({
                'id': str(r.id),
                'name': r.name,
                'description': r.description or '',
                'image': r.image or '',
                'points_cost': r.points_cost,
                'stock_quantity': r.stock_quantity,
                'is_active': r.is_active,
                'center_id': str(r.center.id) if r.center else None,
                'center_name': r.center.name if r.center else 'عام للجميع',
                'created_at': r.created_at.strftime('%Y-%m-%d'),
            })
        return JsonResponse({'status': 'success', 'data': rewards})

    elif request.method == 'POST':
        if profile.role not in ['TENANT_ADMIN', 'SUPER_ADMIN', 'CENTER_MANAGER']:
            return JsonResponse({'status': 'error', 'message': 'غير مصرح لك بإضافة مكافآت'}, status=403)

        try:
            data = parse_body(request)
            name = data.get('name', '').strip()
            points_cost = int(data.get('points_cost') or 0)
            stock_quantity = int(data.get('stock_quantity') if data.get('stock_quantity') is not None else 0)
            description = data.get('description', '').strip()
            image = data.get('image', '').strip()
            center_id = data.get('center_id')

            if not name:
                return JsonResponse({'status': 'error', 'message': 'اسم المكافأة مطلوب'}, status=400)
            if points_cost <= 0:
                return JsonResponse({'status': 'error', 'message': 'يجب أن تكون قيمة النقاط أكبر من الصفر'}, status=400)
            if stock_quantity < 0:
                return JsonResponse({'status': 'error', 'message': 'لا يمكن أن يكون المخزون أقل من صفر'}, status=400)

            center = None
            if profile.role == 'CENTER_MANAGER' and profile.center_id:
                center = profile.center
            elif center_id:
                center = Center.objects.using(db).filter(id=center_id).first()

            reward = Reward.objects.using(db).create(
                name=name,
                points_cost=points_cost,
                stock_quantity=stock_quantity,
                description=description,
                image=image,
                center=center,
                created_by=profile
            )

            return JsonResponse({
                'status': 'success',
                'message': 'تمت إضافة المكافأة بنجاح',
                'data': {
                    'id': str(reward.id),
                    'name': reward.name,
                    'points_cost': reward.points_cost,
                    'stock_quantity': reward.stock_quantity,
                    'is_active': reward.is_active
                }
            })
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': f'حدث خطأ: {str(e)}'}, status=400)

    return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def reward_detail_view(request, pk):
    """
    تعديل، حذف، وتفعيل/تعطيل مكافأة
    """
    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    try:
        reward = Reward.objects.using(db).get(id=pk)
    except Reward.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'المكافأة غير موجودة'}, status=404)

    if request.method == 'GET':
        return JsonResponse({
            'status': 'success',
            'data': {
                'id': str(reward.id),
                'name': reward.name,
                'description': reward.description or '',
                'image': reward.image or '',
                'points_cost': reward.points_cost,
                'stock_quantity': reward.stock_quantity,
                'is_active': reward.is_active,
                'center_id': str(reward.center.id) if reward.center else None,
            }
        })

    if profile.role not in ['TENANT_ADMIN', 'SUPER_ADMIN', 'CENTER_MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'غير مصرح بإجراء هذه العملية'}, status=403)

    if request.method in ['PUT', 'PATCH']:
        try:
            data = parse_body(request)
            if 'name' in data:
                reward.name = data['name'].strip()
            if 'description' in data:
                reward.description = data['description'].strip()
            if 'points_cost' in data:
                reward.points_cost = int(data['points_cost'])
            if 'stock_quantity' in data:
                stock_val = int(data['stock_quantity'])
                if stock_val < 0:
                    return JsonResponse({'status': 'error', 'message': 'لا يمكن أن يكون المخزون أقل من صفر'}, status=400)
                reward.stock_quantity = stock_val
            if 'is_active' in data:
                reward.is_active = bool(data['is_active'])
            if 'image' in data:
                reward.image = data['image']

            reward.save(using=db)
            return JsonResponse({'status': 'success', 'message': 'تم تحديث المكافأة بنجاح'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    elif request.method == 'DELETE':
        reward.delete(using=db)
        return JsonResponse({'status': 'success', 'message': 'تم حذف المكافأة بنجاح'})

    return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def redeem_reward_view(request):
    """
    استبدال فوري لمكافأة للطالب وصرفها
    """
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    try:
        data = parse_body(request)
        student_id = data.get('student_id')
        reward_id = data.get('reward_id')
        notes = data.get('notes', '')

        if not student_id or not reward_id:
            return JsonResponse({'status': 'error', 'message': 'معرف الطالب والمكافأة مطلوبان'}, status=400)

        result = PointsService.redeem_reward(
            db_name=db,
            student_id=student_id,
            reward_id=reward_id,
            performed_by=profile,
            notes=notes
        )

        return JsonResponse({'status': 'success', 'message': 'تم استبدال وصرف المكافأة بنجاح', 'data': result})

    except ValueError as ve:
        return JsonResponse({'status': 'error', 'message': str(ve)}, status=400)
    except Exception as e:
        logger.error(f"Error in redeem_reward_view: {e}")
        return JsonResponse({'status': 'error', 'message': 'حدث خطأ أثناء صرف المكافأة'}, status=500)


# ==========================================
# 3. إدارة طلبات المكافآت من لوحة الإدارة
# ==========================================

@csrf_exempt
def admin_claims_list_view(request):
    """
    عرض طلبات المكافآت مع الفلترة حسب الحالة، والبحث
    """
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    status_filter = request.GET.get('status')
    search = request.GET.get('search', '').strip()
    center_id = request.GET.get('center_id')
    halaqa_id = request.GET.get('halaqa_id')

    qs = RewardClaim.objects.using(db).select_related(
        'student', 'student__halaqa', 'student__halaqa__center', 'reward', 'processed_by', 'processed_by__user'
    ).all()

    if profile.role == 'CENTER_MANAGER' and profile.center_id:
        qs = qs.filter(student__halaqa__center_id=profile.center_id)
    elif center_id:
        qs = qs.filter(student__halaqa__center_id=center_id)

    if halaqa_id:
        qs = qs.filter(student__halaqa_id=halaqa_id)

    if status_filter and status_filter.upper() != 'ALL':
        qs = qs.filter(status=status_filter.upper())

    if search:
        qs = qs.filter(
            Q(student__full_name__icontains=search) |
            Q(reward__name__icontains=search)
        )

    claims = []
    for c in qs.order_by('-claimed_at')[:150]:
        processed_by_name = c.processed_by.user.get_full_name() if (c.processed_by and c.processed_by.user) else None
        claims.append({
            'id': str(c.id),
            'student_id': str(c.student.id),
            'student_name': c.student.full_name,
            'student_current_points': c.student.points,
            'halaqa_name': c.student.halaqa.name if c.student.halaqa else 'غير محدد',
            'center_name': c.student.halaqa.center.name if (c.student.halaqa and c.student.halaqa.center) else 'غير محدد',
            'reward_id': str(c.reward.id),
            'reward_name': c.reward.name,
            'reward_image': c.reward.image or '',
            'points_spent': c.points_spent,
            'status': c.status,
            'status_display': c.get_status_display(),
            'notes': c.notes or '',
            'admin_notes': c.admin_notes or '',
            'rejection_reason': c.rejection_reason or '',
            'claimed_at': c.claimed_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': c.updated_at.strftime('%Y-%m-%d %H:%M') if c.updated_at else None,
            'processed_by_name': processed_by_name,
        })

    stats = {
        'total': qs.count(),
        'pending': qs.filter(status='PENDING').count(),
        'approved': qs.filter(status='APPROVED').count(),
        'delivered': qs.filter(status='DELIVERED').count(),
        'rejected': qs.filter(status='REJECTED').count(),
    }

    return JsonResponse({'status': 'success', 'data': claims, 'stats': stats})


@csrf_exempt
def admin_claim_action_view(request, pk):
    """
    تنفيذ إجراء على طلب مكافأة:
    - APPROVE: موافقة وخصم النقاط
    - REJECT: رفض وتسجيل السبب
    - DELIVER: تسليم المكافأة
    """
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    if profile.role not in ['TENANT_ADMIN', 'SUPER_ADMIN', 'CENTER_MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'غير مصرح لك بإدارة طلبات المكافآت'}, status=403)

    try:
        data = parse_body(request)
        action = data.get('action', '').upper()
        admin_notes = data.get('admin_notes', '').strip()
        rejection_reason = data.get('rejection_reason', '').strip()

        if action == 'APPROVE':
            res = PointsService.approve_reward_claim(
                db_name=db,
                claim_id=str(pk),
                reviewed_by=profile,
                admin_notes=admin_notes
            )
            return JsonResponse({'status': 'success', 'message': 'تمت الموافقة على الطلب بنجاح وخصم النقاط من رصيد الطالب', 'data': res})

        elif action == 'REJECT':
            res = PointsService.reject_reward_claim(
                db_name=db,
                claim_id=str(pk),
                reviewed_by=profile,
                rejection_reason=rejection_reason,
                admin_notes=admin_notes
            )
            return JsonResponse({'status': 'success', 'message': 'تم رفض طلب المكافأة وإشعار الطالب', 'data': res})

        elif action == 'DELIVER':
            res = PointsService.deliver_reward_claim(
                db_name=db,
                claim_id=str(pk),
                reviewed_by=profile,
                admin_notes=admin_notes
            )
            return JsonResponse({'status': 'success', 'message': 'تم تأكيد تسليم المكافأة للطالب بنجاح', 'data': res})

        else:
            return JsonResponse({'status': 'error', 'message': f'إجراء غير معروف: {action}'}, status=400)

    except ValueError as ve:
        return JsonResponse({'status': 'error', 'message': str(ve)}, status=400)
    except Exception as e:
        logger.error(f"Error in admin_claim_action_view: {e}")
        return JsonResponse({'status': 'error', 'message': f'حدث خطأ: {str(e)}'}, status=500)


# ==========================================
# 4. التحكم بفتح وإغلاق متجر النقاط (Store Settings)
# ==========================================

@csrf_exempt
def store_settings_view(request):
    """
    عرض وتعديل إعدادات فتح وإغلاق متجر النقاط على مستويي المركز والمسجد
    """
    db, tenant_obj = get_tenant_db_and_obj(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    if request.method == 'GET':
        mosque_status = bool(getattr(tenant_obj, 'is_rewards_store_enabled', True))

        centers_qs = Center.objects.using(db).filter(is_active=True)
        if profile.role == 'CENTER_MANAGER' and profile.center_id:
            centers_qs = centers_qs.filter(id=profile.center_id)

        centers_data = []
        for c in centers_qs:
            # حالة المركز النهائية تأخذ في الاعتبار إعداد المسجد
            effective_open = mosque_status and c.is_rewards_store_enabled
            centers_data.append({
                'id': str(c.id),
                'name': c.name,
                'is_rewards_store_enabled': c.is_rewards_store_enabled,
                'effective_open': effective_open,
                'status_message': 'مفتوح' if effective_open else ('مغلق من المركز' if not c.is_rewards_store_enabled else 'مغلق من المسجد')
            })

        return JsonResponse({
            'status': 'success',
            'data': {
                'mosque': {
                    'name': getattr(tenant_obj, 'name', 'المسجد الرئيسي'),
                    'is_rewards_store_enabled': mosque_status
                },
                'centers': centers_data,
                'can_manage_mosque': profile.role in ['TENANT_ADMIN', 'SUPER_ADMIN'],
                'can_manage_center': profile.role in ['TENANT_ADMIN', 'SUPER_ADMIN', 'CENTER_MANAGER']
            }
        })

    elif request.method == 'POST':
        data = parse_body(request)
        scope = data.get('scope', '').upper()  # 'MOSQUE' or 'CENTER'
        is_enabled = bool(data.get('is_enabled', True))
        target_id = data.get('target_id')

        if scope == 'MOSQUE':
            if profile.role not in ['TENANT_ADMIN', 'SUPER_ADMIN']:
                return JsonResponse({'status': 'error', 'message': 'فقط مدير المسجد يملك صلاحية تعديل إعدادات المسجد'}, status=403)
            
            if tenant_obj:
                tenant_obj.is_rewards_store_enabled = is_enabled
                tenant_obj.save(using='default', update_fields=['is_rewards_store_enabled', 'updated_at'])
                return JsonResponse({
                    'status': 'success',
                    'message': f"تم {'فتح' if is_enabled else 'إغلاق'} متجر النقاط على مستوى المسجد بالكامل",
                    'is_rewards_store_enabled': is_enabled
                })

        elif scope == 'CENTER':
            if not target_id:
                return JsonResponse({'status': 'error', 'message': 'معرف المركز مطلوب'}, status=400)

            try:
                center = Center.objects.using(db).get(id=target_id)
            except Center.DoesNotExist:
                return JsonResponse({'status': 'error', 'message': 'المركز غير موجود'}, status=404)

            # التحقق من الصلاحية
            if profile.role == 'CENTER_MANAGER' and str(profile.center_id) != str(target_id):
                return JsonResponse({'status': 'error', 'message': 'غير مصرح لك بتعديل إعدادات هذا المركز'}, status=403)

            center.is_rewards_store_enabled = is_enabled
            center.save(using=db, update_fields=['is_rewards_store_enabled'])

            return JsonResponse({
                'status': 'success',
                'message': f"تم {'فتح' if is_enabled else 'إغلاق'} متجر النقاط لمركز {center.name}",
                'center_id': str(center.id),
                'is_rewards_store_enabled': is_enabled
            })

        return JsonResponse({'status': 'error', 'message': 'نطاق الإعداد غير صالح (scope)'}, status=400)

    return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)


# ==========================================
# 5. واجهات بوابة الطالب / ولي الأمر الموحدة
# ==========================================

@csrf_exempt
def student_portal_dashboard_view(request):
    """
    الواجهة الرئيسية الشاملة لحساب الطالب / ولي الأمر الموحد
    تتضمن:
    - مؤشرات الأداء (KPIs)
    - جدول المتابعة الفعلي
    - تحليل الأداء والرسوم البيانية
    - معلومات النقاط وحالة المتجر
    """
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db, tenant_obj = get_tenant_db_and_obj(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    requested_student_id = request.GET.get('student_id')
    student, children_list, is_parent = resolve_student_for_user(db, profile, requested_student_id)

    if not student:
        return JsonResponse({
            'status': 'error',
            'message': 'لم يتم العثور على سجل طالب مرتبط بهذا الحساب',
            'data': {
                'has_student': False,
                'children_list': children_list,
                'is_parent': is_parent
            }
        }, status=404)

    # 1. حالة المتجر
    center_id = student.halaqa.center_id if (student.halaqa and student.halaqa.center) else None
    store_status = PointsService.check_store_status(db, tenant_obj, center_id=center_id)

    # 2. سجلات الحضور والتسميع
    att_qs = AttendanceLog.objects.using(db).filter(student_id=student.id).select_related('session').order_by('-session_date', '-id')
    rec_qs = RecitationLog.objects.using(db).filter(student_id=student.id).select_related('evaluation_grade').order_by('-created_at')

    total_sessions_count = att_qs.count()
    present_count = att_qs.filter(status='PRESENT').count()
    late_count = att_qs.filter(status='LATE').count()
    completed_sessions = present_count + late_count
    attendance_rate = round((completed_sessions / total_sessions_count * 100), 1) if total_sessions_count > 0 else 100.0

    avg_behavior_val = att_qs.aggregate(avg_val=Coalesce(Avg('behavior_score'), 10.0))['avg_val'] or 10.0
    if avg_behavior_val >= 9.0:
        behavior_level = "ممتاز"
    elif avg_behavior_val >= 8.0:
        behavior_level = "جيد جداً"
    elif avg_behavior_val >= 6.5:
        behavior_level = "جيد"
    else:
        behavior_level = "مقبول"

    # التقييم العام
    if attendance_rate >= 90 and avg_behavior_val >= 8.5:
        overall_rating = "ممتاز"
    elif attendance_rate >= 80 and avg_behavior_val >= 7.5:
        overall_rating = "جيد جداً"
    elif attendance_rate >= 65:
        overall_rating = "جيد"
    else:
        overall_rating = "مقبول"

    total_pages_recited = rec_qs.aggregate(total=Coalesce(Sum('page_number'), 0))['total'] or 0

    # 3. جدول المتابعة (دمج الحضور والتسميع)
    rec_by_att = {}
    for r in rec_qs[:60]:
        if r.attendance_id:
            rec_by_att[str(r.attendance_id)] = r

    follow_up_records = []
    for a in att_qs[:40]:
        rec = rec_by_att.get(str(a.id))
        eval_text = "-"
        if rec:
            type_label = rec.get_recitation_type_display() if hasattr(rec, 'get_recitation_type_display') else rec.recitation_type
            eval_text = f"{rec.grade} ({type_label} - ص {rec.page_number})"
        elif a.status in ['PRESENT', 'LATE']:
            eval_text = "حضور بدون تسميع"

        follow_up_records.append({
            'id': str(a.id),
            'date': a.session_date.strftime('%Y-%m-%d') if hasattr(a.session_date, 'strftime') else str(a.session_date),
            'session': a.session.notes if (a.session and a.session.notes) else (student.halaqa.name if student.halaqa else f"جلسة {a.session_date}"),
            'behavior': a.get_behavior_display() if hasattr(a, 'get_behavior_display') else (a.behavior or 'ممتاز'),
            'behavior_score': a.behavior_score or 10,
            'attendance': a.get_status_display() if hasattr(a, 'get_status_display') else a.status,
            'attendance_status': a.status,
            'is_late': a.is_late,
            'evaluation': eval_text,
            'notes': a.notes or (rec.notes if rec else "") or ""
        })

    # 4. تحليل الأداء ومخطط الأسابيع والتطور
    today = timezone.localdate()
    month_start = today.replace(day=1)
    
    # تقسيم الشهر الحالي لأسابيع لحساب المتوسطات ومقارنة الأداء
    month_att = att_qs.filter(session_date__gte=month_start, session_date__lte=today)
    
    weekly_data = []
    for w_idx in range(4):
        w_start = month_start + timedelta(days=w_idx * 7)
        w_end = min(month_start + timedelta(days=(w_idx + 1) * 7 - 1), today)
        if w_start <= today:
            w_qs = month_att.filter(session_date__gte=w_start, session_date__lte=w_end)
            w_count = w_qs.count()
            w_pres = w_qs.filter(status__in=['PRESENT', 'LATE']).count()
            w_rate = round((w_pres / w_count * 100), 1) if w_count > 0 else (90.0 + w_idx * 2)
            w_avg_beh = w_qs.aggregate(avg=Coalesce(Avg('behavior_score'), 9.5))['avg'] or 9.5
            weekly_data.append({
                'week': f"الأسبوع {w_idx + 1}",
                'score': round((w_rate * 0.5) + (float(w_avg_beh) * 5), 1),
                'attendance_rate': w_rate,
                'sessions_count': w_count
            })

    # اتجاه التحسن
    if len(weekly_data) >= 2:
        last_score = weekly_data[-1]['score']
        first_score = weekly_data[0]['score']
        if last_score > first_score + 2:
            trend_direction = "improving"
            trend_label = "أداء تصاعدي متميز نحو التميز"
        elif last_score < first_score - 5:
            trend_direction = "declining"
            trend_label = "بحاجة لمزيد من التحفيز والمتابعة"
        else:
            trend_direction = "stable"
            trend_label = "أداء متزن ومستقر"
    else:
        trend_direction = "improving"
        trend_label = "أداء متميز في بداية الشهر"

    # نقاط الطالب
    total_earned = PointTransaction.objects.using(db).filter(student=student, amount__gt=0).aggregate(t=Coalesce(Sum('amount'), 0))['t'] or 0
    total_spent = abs(PointTransaction.objects.using(db).filter(student=student, amount__lt=0).aggregate(t=Coalesce(Sum('amount'), 0))['t'] or 0)

    # المعلم وولي الأمر
    teacher_name = student.halaqa.teacher_name if (student.halaqa and student.halaqa.teacher_name) else "غير محدد"
    parent_name = getattr(student, 'father_name', '') or (f"{profile.father_name or ''} {profile.user.last_name or ''}".strip() if profile else "ولي الأمر") or "ولي الأمر"

    response_data = {
        'student_info': {
            'id': str(student.id),
            'full_name': student.full_name,
            'national_id': student.national_id or '',
            'gender': student.gender,
            'gender_display': 'ذكر' if student.gender == 'M' else 'أنثى',
            'birth_date': str(student.birth_date) if student.birth_date else '',
            'reached_page': student.reached_page or 1,
            'halaqa_id': str(student.halaqa.id) if student.halaqa else None,
            'halaqa_name': student.halaqa.name if student.halaqa else 'غير محدد',
            'center_name': student.halaqa.center.name if (student.halaqa and student.halaqa.center) else 'المركز الرئيسي',
            'teacher_name': teacher_name,
            'parent_name': parent_name,
        },
        'children_list': children_list,
        'is_parent_view': is_parent,
        'store_status': store_status,
        'kpi_metrics': {
            'overall_rating': overall_rating,
            'total_points': student.points,
            'completed_sessions': completed_sessions,
            'total_sessions': total_sessions_count,
            'attendance_rate': f"{attendance_rate}%",
            'attendance_rate_val': attendance_rate,
            'behavior_level': behavior_level,
            'avg_behavior_score': round(float(avg_behavior_val), 1),
            'total_pages_recited': total_pages_recited,
        },
        'points_summary': {
            'current_balance': student.points,
            'total_earned': total_earned,
            'total_spent': total_spent,
        },
        'follow_up_records': follow_up_records,
        'performance_analytics': {
            'weekly_data': weekly_data,
            'trend_direction': trend_direction,
            'trend_label': trend_label,
            'month_name': today.strftime('%B %Y'),
            'comparison_summary': f"معدل الإنجاز الشهري الحالي {attendance_rate}% ومستوى التقييم العام {overall_rating}."
        }
    }

    return JsonResponse({'status': 'success', 'data': response_data})


@csrf_exempt
def student_portal_points_store_view(request):
    """
    بيانات تبويب 'النقاط والمكافآت' للطالب / ولي الأمر:
    - أرصدة النقاط
    - حالة المتجر
    - قائمة المكافآت المتاحة
    - سجل طلبات المكافآت الخاصة بالطالب
    """
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db, tenant_obj = get_tenant_db_and_obj(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    requested_student_id = request.GET.get('student_id')
    student, children_list, is_parent = resolve_student_for_user(db, profile, requested_student_id)

    if not student:
        return JsonResponse({'status': 'error', 'message': 'لم يتم العثور على سجل الطالب'}, status=404)

    # 1. فحص إتاحة المتجر
    center_id = student.halaqa.center_id if (student.halaqa and student.halaqa.center) else None
    store_status = PointsService.check_store_status(db, tenant_obj, center_id=center_id)

    # 2. معلومات النقاط
    total_earned = PointTransaction.objects.using(db).filter(student=student, amount__gt=0).aggregate(t=Coalesce(Sum('amount'), 0))['t'] or 0
    total_spent = abs(PointTransaction.objects.using(db).filter(student=student, amount__lt=0).aggregate(t=Coalesce(Sum('amount'), 0))['t'] or 0)

    # 3. المكافآت المتاحة
    rewards_qs = Reward.objects.using(db).filter(is_active=True)
    if center_id:
        rewards_qs = rewards_qs.filter(Q(center_id=center_id) | Q(center__isnull=True))

    catalog = []
    for r in rewards_qs:
        is_in_stock = r.stock_quantity > 0
        can_afford = student.points >= r.points_cost
        catalog.append({
            'id': str(r.id),
            'name': r.name,
            'description': r.description or '',
            'image': r.image or '',
            'points_cost': r.points_cost,
            'stock_quantity': r.stock_quantity,
            'is_in_stock': is_in_stock,
            'can_afford': can_afford,
            'is_available': is_in_stock and store_status['is_open'],
        })

    # 4. سجل طلبات الطالب
    claims_qs = RewardClaim.objects.using(db).filter(student=student).select_related('reward').order_by('-claimed_at')
    claims_history = []
    for c in claims_qs:
        claims_history.append({
            'id': str(c.id),
            'reward_name': c.reward.name,
            'reward_image': c.reward.image or '',
            'points_spent': c.points_spent,
            'status': c.status,
            'status_display': c.get_status_display(),
            'notes': c.notes or '',
            'admin_notes': c.admin_notes or '',
            'rejection_reason': c.rejection_reason or '',
            'claimed_at': c.claimed_at.strftime('%Y-%m-%d %H:%M'),
            'updated_at': c.updated_at.strftime('%Y-%m-%d %H:%M') if c.updated_at else None,
        })

    return JsonResponse({
        'status': 'success',
        'data': {
            'student_id': str(student.id),
            'student_name': student.full_name,
            'points_summary': {
                'current_balance': student.points,
                'total_earned': total_earned,
                'total_spent': total_spent,
            },
            'store_status': store_status,
            'rewards_catalog': catalog,
            'claims_history': claims_history,
            'children_list': children_list,
            'is_parent_view': is_parent
        }
    })


@csrf_exempt
def student_portal_claim_reward_view(request):
    """
    إنشاء طلب شراء مكافأة جديد للطالب
    - حفظ بحالة قيد الانتظار
    - عدم خصم النقاط حتى الموافقة
    - إرسال إشعار
    """
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db, tenant_obj = get_tenant_db_and_obj(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    try:
        data = parse_body(request)
        reward_id = data.get('reward_id')
        requested_student_id = data.get('student_id')
        notes = data.get('notes', '')

        if not reward_id:
            return JsonResponse({'status': 'error', 'message': 'معرف المكافأة مطلوب'}, status=400)

        student, _, _ = resolve_student_for_user(db, profile, requested_student_id)
        if not student:
            return JsonResponse({'status': 'error', 'message': 'لم يتم العثور على سجل الطالب'}, status=404)

        result = PointsService.create_reward_claim(
            db_name=db,
            student_id=str(student.id),
            reward_id=str(reward_id),
            requested_by=profile,
            notes=notes,
            tenant_obj=tenant_obj
        )

        return JsonResponse({'status': 'success', 'message': result['message'], 'data': result})

    except ValueError as ve:
        return JsonResponse({'status': 'error', 'message': str(ve)}, status=400)
    except Exception as e:
        logger.error(f"Error in student_portal_claim_reward_view: {e}")
        return JsonResponse({'status': 'error', 'message': f'حدث خطأ أثناء إرسال الطلب: {str(e)}'}, status=500)


# ==========================================
# 6. نظام المسابقات التفاعلية (Competitions)
# ==========================================

@csrf_exempt
def competitions_list_create_view(request):
    """
    قائمة المسابقات وإنشاء مسابقة جديدة
    """
    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    if request.method == 'GET':
        qs = Competition.objects.using(db).prefetch_related('questions', 'target_centers', 'target_halaqat').all()

        if profile.role == 'CENTER_MANAGER' and profile.center_id:
            qs = qs.filter(Q(target_all_centers=True) | Q(target_centers__id=profile.center_id)).distinct()

        competitions = []
        for c in qs:
            q_count = c.questions.count()
            competitions.append({
                'id': str(c.id),
                'title': c.title,
                'description': c.description or '',
                'duration_minutes': c.duration_minutes,
                'max_attempts': c.max_attempts,
                'points_reward': c.points_reward,
                'is_published': c.is_published,
                'questions_count': q_count,
                'start_time': c.start_time.isoformat() if c.start_time else None,
                'end_time': c.end_time.isoformat() if c.end_time else None,
                'created_at': c.created_at.strftime('%Y / %m / %d'),
            })

        return JsonResponse({'status': 'success', 'data': competitions})

    elif request.method == 'POST':
        if profile.role not in ['TENANT_ADMIN', 'SUPER_ADMIN', 'CENTER_MANAGER']:
            return JsonResponse({'status': 'error', 'message': 'غير مصرح لك بإنشاء مسابقات'}, status=403)

        try:
            data = parse_body(request)
            title = data.get('title', '').strip()
            description = data.get('description', '').strip()
            duration_minutes = int(data.get('duration_minutes') or 30)
            max_attempts = int(data.get('max_attempts') or 1)
            points_reward = int(data.get('points_reward') or 10)
            is_published = bool(data.get('is_published', True))

            if not title:
                return JsonResponse({'status': 'error', 'message': 'عنوان المسابقة مطلوب'}, status=400)

            comp = Competition.objects.using(db).create(
                title=title,
                description=description,
                duration_minutes=duration_minutes,
                max_attempts=max_attempts,
                points_reward=points_reward,
                is_published=is_published,
                created_by=profile
            )

            # الاستهداف
            target_center_ids = data.get('target_centers', [])
            if target_center_ids:
                comp.target_all_centers = False
                comp.target_centers.set(Center.objects.using(db).filter(id__in=target_center_ids))
                comp.save(using=db)

            return JsonResponse({
                'status': 'success',
                'message': 'تم إنشاء المسابقة بنجاح',
                'data': {
                    'id': str(comp.id),
                    'title': comp.title,
                    'points_reward': comp.points_reward
                }
            })
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def competition_detail_view(request, pk):
    """
    تفاصيل مسابقة وتعديلها وحذفها مع كافة أسئلتها
    """
    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    try:
        comp = Competition.objects.using(db).prefetch_related('questions', 'sections').get(id=pk)
    except Competition.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'المسابقة غير موجودة'}, status=404)

    if request.method == 'GET':
        questions = []
        for q in comp.questions.all().order_by('order', 'id'):
            questions.append({
                'id': str(q.id),
                'question_text': q.question_text,
                'question_type': q.question_type,
                'question_type_display': q.get_question_type_display(),
                'options': q.options,
                'correct_answer': q.correct_answer,
                'points': float(q.points),
                'order': q.order
            })

        return JsonResponse({
            'status': 'success',
            'data': {
                'id': str(comp.id),
                'title': comp.title,
                'description': comp.description or '',
                'duration_minutes': comp.duration_minutes,
                'max_attempts': comp.max_attempts,
                'points_reward': comp.points_reward,
                'is_published': comp.is_published,
                'questions': questions
            }
        })

    if profile.role not in ['TENANT_ADMIN', 'SUPER_ADMIN', 'CENTER_MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'غير مصرح بإجراء هذه العملية'}, status=403)

    if request.method in ['PUT', 'PATCH']:
        try:
            data = parse_body(request)
            if 'title' in data:
                comp.title = data['title'].strip()
            if 'description' in data:
                comp.description = data['description'].strip()
            if 'duration_minutes' in data:
                comp.duration_minutes = int(data['duration_minutes'])
            if 'max_attempts' in data:
                comp.max_attempts = int(data['max_attempts'])
            if 'points_reward' in data:
                comp.points_reward = int(data['points_reward'])
            if 'is_published' in data:
                comp.is_published = bool(data['is_published'])

            comp.save(using=db)
            return JsonResponse({'status': 'success', 'message': 'تم تحديث المسابقة بنجاح'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    elif request.method == 'DELETE':
        comp.delete(using=db)
        return JsonResponse({'status': 'success', 'message': 'تم حذف المسابقة بنجاح'})

    return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def competition_questions_view(request, pk):
    """
    إضافة سؤال جديد لمسابقة
    """
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    if profile.role not in ['TENANT_ADMIN', 'SUPER_ADMIN', 'CENTER_MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'غير مصرح بإضافة أسئلة'}, status=403)

    try:
        comp = Competition.objects.using(db).get(id=pk)
    except Competition.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'المسابقة غير موجودة'}, status=404)

    try:
        data = parse_body(request)
        question_text = data.get('question_text', '').strip()
        question_type = data.get('question_type', 'MULTIPLE_CHOICE')
        options = data.get('options', [])
        correct_answer = data.get('correct_answer', '').strip()
        points = Decimal(str(data.get('points') or 1.0))
        order = int(data.get('order') or (comp.questions.count() + 1))

        if not question_text:
            return JsonResponse({'status': 'error', 'message': 'نص السؤال مطلوب'}, status=400)

        q = CompetitionQuestion.objects.using(db).create(
            competition=comp,
            question_text=question_text,
            question_type=question_type,
            options=options,
            correct_answer=correct_answer,
            points=points,
            order=order
        )

        return JsonResponse({
            'status': 'success',
            'message': 'تمت إضافة السؤال بنجاح',
            'data': {
                'id': str(q.id),
                'question_text': q.question_text,
                'points': float(q.points)
            }
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


@csrf_exempt
def question_detail_view(request, pk):
    """
    تعديل أو حذف سؤال
    """
    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    if profile.role not in ['TENANT_ADMIN', 'SUPER_ADMIN', 'CENTER_MANAGER']:
        return JsonResponse({'status': 'error', 'message': 'غير مصرح'}, status=403)

    try:
        q = CompetitionQuestion.objects.using(db).get(id=pk)
    except CompetitionQuestion.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'السؤال غير موجود'}, status=404)

    if request.method in ['PUT', 'PATCH']:
        try:
            data = parse_body(request)
            if 'question_text' in data:
                q.question_text = data['question_text'].strip()
            if 'question_type' in data:
                q.question_type = data['question_type']
            if 'options' in data:
                q.options = data['options']
            if 'correct_answer' in data:
                q.correct_answer = data['correct_answer'].strip()
            if 'points' in data:
                q.points = Decimal(str(data['points']))
            if 'order' in data:
                q.order = int(data['order'])

            q.save(using=db)
            return JsonResponse({'status': 'success', 'message': 'تم تحديث السؤال بنجاح'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    elif request.method == 'DELETE':
        q.delete(using=db)
        return JsonResponse({'status': 'success', 'message': 'تم حذف السؤال بنجاح'})

    return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)


@csrf_exempt
def student_competitions_view(request):
    """
    قائمة المسابقات المتاحة للطالب مع فحص إمكانية المشاركة والنتائج
    """
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    requested_student_id = request.GET.get('student_id')
    student, _, _ = resolve_student_for_user(db, profile, requested_student_id)

    qs = Competition.objects.using(db).filter(is_published=True).prefetch_related('questions')

    if student and student.halaqa:
        qs = qs.filter(
            Q(target_all_centers=True) |
            Q(target_centers=student.halaqa.center) |
            Q(target_halaqat=student.halaqa)
        ).distinct()

    competitions_list = []
    for c in qs:
        participation = None
        if student:
            participation = CompetitionParticipation.objects.using(db).filter(
                competition=c, student=student
            ).order_by('-started_at').first()

        competitions_list.append({
            'id': str(c.id),
            'title': c.title,
            'description': c.description or '',
            'duration_minutes': c.duration_minutes,
            'points_reward': c.points_reward,
            'questions_count': c.questions.count(),
            'status': participation.status if participation else 'NOT_STARTED',
            'score': float(participation.score) if participation else None,
            'total_possible_score': float(participation.total_possible_score) if participation else None,
            'points_awarded': participation.points_awarded if participation else 0,
            'has_attempted': bool(participation and participation.status in ['SUBMITTED', 'GRADED']),
        })

    return JsonResponse({'status': 'success', 'data': competitions_list})


@csrf_exempt
def student_start_competition_view(request, pk):
    """
    بدء الطالب لمحاولة المسابقة وبدء العداد الزمني
    """
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    student, _, _ = resolve_student_for_user(db, profile)
    if not student:
        return JsonResponse({'status': 'error', 'message': 'لم يتم العثور على ملف الطالب'}, status=404)

    try:
        comp = Competition.objects.using(db).prefetch_related('questions').get(id=pk, is_published=True)
    except Competition.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'المسابقة غير متاحة'}, status=404)

    attempt_count = CompetitionParticipation.objects.using(db).filter(
        competition=comp, student=student, status__in=['SUBMITTED', 'GRADED']
    ).count()

    if attempt_count >= comp.max_attempts:
        return JsonResponse({'status': 'error', 'message': 'لقد استنفدت جميع المحاولات المتاحة لهذه المسابقة'}, status=400)

    participation = CompetitionParticipation.objects.using(db).create(
        competition=comp,
        student=student,
        attempt_number=attempt_count + 1,
        status='IN_PROGRESS'
    )

    try:
        from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
        StudentNotificationService.notify_competition_registered(db, participation)
    except Exception as notify_err:
        logger.warning(f"Failed to notify competition registration: {notify_err}")

    questions = []
    for q in comp.questions.all().order_by('order', 'id'):
        questions.append({
            'id': str(q.id),
            'question_text': q.question_text,
            'question_type': q.question_type,
            'options': q.options,
            'points': float(q.points),
            'order': q.order
        })

    return JsonResponse({
        'status': 'success',
        'data': {
            'participation_id': str(participation.id),
            'competition_id': str(comp.id),
            'title': comp.title,
            'duration_minutes': comp.duration_minutes,
            'started_at': participation.started_at.isoformat(),
            'questions': questions
        }
    })


@csrf_exempt
def student_submit_competition_view(request, pk):
    """
    تسليم إجابات المسابقة وحساب النتيجة آلياً ومنح النقاط
    """
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    try:
        data = parse_body(request)
        participation_id = data.get('participation_id')
        answers = data.get('answers', [])

        participation = CompetitionParticipation.objects.using(db).select_related('competition', 'student').get(
            id=participation_id, competition_id=pk
        )

        if participation.status in ['SUBMITTED', 'GRADED']:
            return JsonResponse({'status': 'error', 'message': 'تم تسليم هذه المحاولة مسبقاً'}, status=400)

        total_score = Decimal('0.00')
        total_possible = Decimal('0.00')
        has_essay = False

        questions_map = {str(q.id): q for q in participation.competition.questions.all()}

        for ans in answers:
            q_id = str(ans.get('question_id'))
            student_ans_val = str(ans.get('student_answer', '')).strip()

            q_obj = questions_map.get(q_id)
            if not q_obj:
                continue

            total_possible += q_obj.points
            is_correct = None
            score_awarded = Decimal('0.00')

            if q_obj.question_type in ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MATCHING']:
                if student_ans_val and student_ans_val == q_obj.correct_answer.strip():
                    is_correct = True
                    score_awarded = q_obj.points
                    total_score += score_awarded
                else:
                    is_correct = False
            elif q_obj.question_type == 'ESSAY':
                has_essay = True

            QuestionAnswer.objects.using(db).create(
                participation=participation,
                question=q_obj,
                student_answer=student_ans_val,
                is_correct=is_correct,
                score_awarded=score_awarded
            )

        participation.score = total_score
        participation.total_possible_score = total_possible
        participation.submitted_at = timezone.now()
        participation.status = 'SUBMITTED' if has_essay else 'GRADED'
        participation.save(using=db)

        points_gained = 0
        if not has_essay and total_possible > 0:
            percentage = (total_score / total_possible) * 100
            if percentage >= 60:
                points_gained = participation.competition.points_reward
                PointsService.award_competition_reward(
                    db_name=db,
                    participation=participation,
                    points=points_gained,
                    reason=f"جائزة الفوز بالمسابقة: {participation.competition.title}"
                )

        try:
            from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
            StudentNotificationService.notify_competition_result(
                db_name=db,
                participation=participation,
                points_awarded=points_gained
            )
        except Exception as notify_err:
            logger.warning(f"Failed to notify competition result: {notify_err}")

        return JsonResponse({
            'status': 'success',
            'message': 'تم تسليم المسابقة بنجاح',
            'data': {
                'participation_id': str(participation.id),
                'status': participation.status,
                'score': float(total_score),
                'total_possible': float(total_possible),
                'points_gained': points_gained,
                'has_essay_under_review': has_essay
            }
        })

    except Exception as e:
        logger.error(f"Error submitting competition: {e}")
        return JsonResponse({'status': 'error', 'message': f'حدث خطأ أثناء التسليم: {str(e)}'}, status=500)


# =========================================================
# 8. سجل المتابعة والتقييمات التاريخي الشامل للطالب
# =========================================================

@csrf_exempt
def student_portal_follow_up_view(request):
    """
    سجل المتابعة التاريخي الشامل للطالب
    يعرض جميع نشاطات وتقييمات الطالب منذ تاريخ تسجيله وحتى اليوم:
    - تقييمات الحفظ (جديد)
    - تقييمات المراجعة (صغرى وكبرى)
    - تقييمات السلوك والحضور
    - التقييمات اليومية
    - الامتحانات والأحداث التعليمية
    مع دعم التصفية حسب التاريخ وحسب النوع والترقيم (Pagination)
    """
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    requested_student_id = request.GET.get('student_id')
    student, children_list, is_parent = resolve_student_for_user(db, profile, requested_student_id)
    if not student:
        return JsonResponse({'status': 'error', 'message': 'لم يتم العثور على سجل الطالب'}, status=404)

    date_from_str = request.GET.get('date_from', '').strip()
    date_to_str = request.GET.get('date_to', '').strip()
    type_filter = request.GET.get('type', 'ALL').strip().upper()
    try:
        page = max(1, int(request.GET.get('page', 1)))
        page_size = max(1, min(100, int(request.GET.get('page_size', 15))))
    except ValueError:
        page = 1
        page_size = 15

    date_from = None
    date_to = None
    if date_from_str:
        try:
            date_from = datetime.strptime(date_from_str, '%Y-%m-%d').date()
        except ValueError:
            pass
    if date_to_str:
        try:
            date_to = datetime.strptime(date_to_str, '%Y-%m-%d').date()
        except ValueError:
            pass

    records = []

    # 1. Recitation Logs (حفظ جديد ومراجعة صغرى وكبرى)
    rec_qs = RecitationLog.objects.using(db).filter(
        student_id=student.id
    ).select_related('evaluation_grade', 'attendance', 'attendance__session')
    
    if date_from:
        rec_qs = rec_qs.filter(Q(attendance__session_date__gte=date_from) | Q(created_at__date__gte=date_from))
    if date_to:
        rec_qs = rec_qs.filter(Q(attendance__session_date__lte=date_to) | Q(created_at__date__lte=date_to))

    for r in rec_qs:
        rec_date = r.attendance.session_date if (r.attendance and r.attendance.session_date) else r.created_at.date()
        is_memorization = (r.recitation_type == 'NEW_MEMORIZATION')
        category = 'MEMORIZATION' if is_memorization else 'REVIEW'
        type_label = 'حفظ جديد' if is_memorization else ('مراجعة صغرى' if r.recitation_type == 'MINOR_REVIEW' else 'مراجعة كبرى')
        badge_color = r.evaluation_grade.color_code if (r.evaluation_grade and r.evaluation_grade.color_code) else ('#10b981' if not r.requires_repeat else '#ef4444')
        teacher = student.halaqa.teacher_name if student.halaqa else "معلم الحلقة"
        halaqa_title = student.halaqa.name if student.halaqa else "الحلقة القرآنية"

        records.append({
            'id': f"rec_{r.id}",
            'raw_id': str(r.id),
            'date': rec_date.strftime('%Y-%m-%d'),
            'type': category,
            'type_label': type_label,
            'title': f"تسميع صفحة {r.page_number}",
            'halaqa_name': halaqa_title,
            'teacher_name': teacher,
            'grade': r.grade,
            'score': r.grade,
            'requires_repeat': r.requires_repeat,
            'badge_color': badge_color,
            'behavior_score': r.behavior_score,
            'notes': r.notes or "",
            'timestamp': r.created_at or datetime.combine(rec_date, datetime.min.time())
        })

    # 2. Attendance & Behavior Logs (سجلات الحضور والسلوك)
    att_qs = AttendanceLog.objects.using(db).filter(
        student_id=student.id
    ).select_related('session')
    
    if date_from:
        att_qs = att_qs.filter(session_date__gte=date_from)
    if date_to:
        att_qs = att_qs.filter(session_date__lte=date_to)

    for a in att_qs:
        beh_score = a.behavior_score if a.behavior_score is not None else 10
        beh_label = a.get_behavior_display() if hasattr(a, 'get_behavior_display') else (a.behavior or 'ممتاز')
        att_status_label = a.get_status_display() if hasattr(a, 'get_status_display') else a.status
        badge_color = '#10b981' if beh_score >= 8 else ('#f59e0b' if beh_score >= 6 else '#ef4444')
        if a.status in ['ABSENT', 'EXCUSED']:
            badge_color = '#ef4444'

        records.append({
            'id': f"att_{a.id}",
            'raw_id': str(a.id),
            'date': a.session_date.strftime('%Y-%m-%d'),
            'type': 'BEHAVIOR',
            'type_label': 'سلوك وحضور',
            'title': f"جلسة ({att_status_label})",
            'halaqa_name': student.halaqa.name if student.halaqa else "الحلقة القرآنية",
            'teacher_name': student.halaqa.teacher_name if student.halaqa else "معلم الحلقة",
            'grade': f"{beh_label} ({beh_score}/10)",
            'score': f"{beh_score}/10",
            'requires_repeat': False,
            'badge_color': badge_color,
            'behavior_score': beh_score,
            'notes': a.notes or "",
            'timestamp': datetime.combine(a.session_date, datetime.min.time())
        })

    # 3. Independent Daily Evaluations (التقييمات اليومية في EvaluationLog)
    eval_qs = EvaluationLog.objects.using(db).filter(
        student=student
    ).select_related('teacher', 'halaqa')

    if date_from:
        eval_qs = eval_qs.filter(date__gte=date_from)
    if date_to:
        eval_qs = eval_qs.filter(date__lte=date_to)

    for e in eval_qs:
        eval_type_label = e.get_evaluation_type_display() if hasattr(e, 'get_evaluation_type_display') else e.evaluation_type
        score_val = float(e.score)
        badge_color = '#10b981' if score_val >= 80 else ('#f59e0b' if score_val >= 60 else '#ef4444')
        t_name = (e.teacher.user.get_full_name() or e.teacher.user.username) if (e.teacher and e.teacher.user) else (student.halaqa.teacher_name if student.halaqa else "معلم الحلقة")

        records.append({
            'id': f"eval_{e.id}",
            'raw_id': str(e.id),
            'date': e.date.strftime('%Y-%m-%d'),
            'type': 'DAILY',
            'type_label': f"تقييم {eval_type_label}",
            'title': f"تقييم دوري: {eval_type_label}",
            'halaqa_name': e.halaqa.name if e.halaqa else (student.halaqa.name if student.halaqa else "الحلقة القرآنية"),
            'teacher_name': t_name,
            'grade': f"{e.score}%",
            'score': f"{e.score}%",
            'requires_repeat': False,
            'badge_color': badge_color,
            'behavior_score': None,
            'notes': e.notes or "",
            'timestamp': e.created_at or datetime.combine(e.date, datetime.min.time())
        })

    # 4. Educational Events & Exams (الامتحانات والأحداث التعليمية)
    try:
        from tenant_modules.centers_and_projects.models import StudentExamResult
        exam_qs = StudentExamResult.objects.using(db).filter(
            student=student
        ).select_related('stage', 'exam_template')
        if date_from:
            exam_qs = exam_qs.filter(created_at__date__gte=date_from)
        if date_to:
            exam_qs = exam_qs.filter(created_at__date__lte=date_to)

        for x in exam_qs:
            status_label = x.get_status_display() if hasattr(x, 'get_status_display') else x.status
            score_txt = f"{x.score}%" if x.score is not None else status_label
            badge_color = '#10b981' if x.status == 'PASSED' else ('#ef4444' if x.status == 'FAILED' else '#6366f1')

            records.append({
                'id': f"exam_{x.id}",
                'raw_id': str(x.id),
                'date': x.created_at.date().strftime('%Y-%m-%d'),
                'type': 'EXAM',
                'type_label': 'اختبار مرحلي',
                'title': f"امتحان: {x.stage.title if x.stage else 'اختبار إتقان'}",
                'halaqa_name': student.halaqa.name if student.halaqa else "الحلقة القرآنية",
                'teacher_name': student.halaqa.teacher_name if student.halaqa else "لجنة الاختبارات",
                'grade': f"{status_label} ({score_txt})",
                'score': score_txt,
                'requires_repeat': (x.status == 'FAILED'),
                'badge_color': badge_color,
                'behavior_score': None,
                'notes': x.notes or "",
                'timestamp': x.created_at
            })
    except Exception:
        pass

    # الإحصائيات الشاملة قبل فلترة النوع
    summary_stats = {
        'total_records': len(records),
        'total_memorization': sum(1 for r in records if r['type'] == 'MEMORIZATION'),
        'total_review': sum(1 for r in records if r['type'] == 'REVIEW'),
        'total_behavior': sum(1 for r in records if r['type'] == 'BEHAVIOR'),
        'total_daily': sum(1 for r in records if r['type'] == 'DAILY'),
        'total_exams': sum(1 for r in records if r['type'] == 'EXAM'),
    }

    # فلترة حسب النوع إن لم يكن ALL
    if type_filter != 'ALL':
        records = [r for r in records if r['type'] == type_filter]

    # الترتيب من الأحدث إلى الأقدم
    records.sort(key=lambda x: (x['date'], str(x.get('timestamp') or '')), reverse=True)

    # الترقيم (Pagination)
    total_items = len(records)
    total_pages = max(1, math.ceil(total_items / page_size))
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_records = records[start_idx:end_idx]

    # تنظيف حقل timestamp لمنع مشاكل serialization
    for r in paginated_records:
        if isinstance(r.get('timestamp'), (datetime, date)):
            r['timestamp'] = r['timestamp'].isoformat()

    return JsonResponse({
        'status': 'success',
        'data': {
            'student_info': {
                'id': str(student.id),
                'full_name': student.full_name,
                'halaqa_name': student.halaqa.name if student.halaqa else "غير محدد",
                'teacher_name': student.halaqa.teacher_name if student.halaqa else "غير محدد",
                'reached_page': student.reached_page or 1,
                'points': student.points
            },
            'summary_stats': summary_stats,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_pages': total_pages,
                'total_items': total_items,
                'has_next': page < total_pages,
                'has_prev': page > 1
            },
            'records': paginated_records
        }
    }, status=200)


@csrf_exempt
def student_portal_notifications_view(request):
    """
    جلب قائمة إشعارات الطالب / ولي الأمر
    مع العداد للإشعارات غير المقروءة
    """
    if request.method != 'GET':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    from tenant_modules.centers_and_projects.models import SystemNotification
    from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService

    requested_student_id = request.GET.get('student_id')
    student, _, _ = resolve_student_for_user(db, profile, requested_student_id)

    recipient_user = profile.user
    if student:
        resolved_u = StudentNotificationService.resolve_student_recipient_user(db, student)
        if resolved_u:
            recipient_user = resolved_u

    filter_q = Q(recipient=recipient_user)
    if student and student.halaqa and student.halaqa.center:
        filter_q |= Q(recipient__isnull=True, center=student.halaqa.center)

    notifications_qs = SystemNotification.objects.using(db).filter(filter_q).order_by('-created_at')
    
    unread_count = notifications_qs.filter(is_read=False).count()
    notifications = notifications_qs[:60]

    data = []
    for n in notifications:
        data.append({
            'id': str(n.id),
            'title': n.title,
            'message': n.message,
            'is_read': n.is_read,
            'created_at': n.created_at.strftime('%Y-%m-%d %H:%M') if n.created_at else "",
            'date': n.created_at.strftime('%Y-%m-%d') if n.created_at else ""
        })

    return JsonResponse({
        'status': 'success',
        'data': {
            'unread_count': unread_count,
            'notifications': data
        }
    }, status=200)


@csrf_exempt
def student_portal_mark_notification_read_view(request, pk=None):
    """
    تحديد إشعار أو جميع الإشعارات كمقروءة
    """
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

    db = get_tenant_db(request)
    db = getattr(request, 'db_name', 'default')
    profile = getattr(request, 'profile', None)
    if not profile:
        return JsonResponse({'status': 'error', 'message': getattr(request, 'auth_error', 'التوثيق مطلوب')}, status=401)

    from tenant_modules.centers_and_projects.models import SystemNotification

    if pk:
        SystemNotification.objects.using(db).filter(id=pk).update(is_read=True)
    else:
        # تحديد الكل كمقروء
        SystemNotification.objects.using(db).filter(recipient=profile.user, is_read=False).update(is_read=True)

    return JsonResponse({'status': 'success', 'message': 'تم تحديث حالة الإشعارات بنجاح'}, status=200)


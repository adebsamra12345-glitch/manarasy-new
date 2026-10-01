import json
import traceback
import jwt
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone
from django.db.models import Q
from core_system.tenants.models import Tenant
from tenant_modules.centers_and_projects.models import Center, Project
from tenant_modules.users.models import UserProfile
from .models import Halaqa

def parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        raise ValueError("بيانات غير صالحة")

def get_tenant_db(request):
    tenant_id = request.headers.get('Tenant-ID')
    if not tenant_id:
        raise ValueError("ترويسة Tenant-ID مفقودة في الطلب")
    
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
        
    return db_name

def check_halaqa_permission(request, db_name, center=None):
    """التحقق من صلاحيات مدير النظام أو مدير المركز لعمليات الحلقات"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False
    token = auth_header.split(' ')[1]
    
    try:
        jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        role = payload.get('role')
        username = payload.get('username')
        user_id = payload.get('user_id')

        # الأدمن يملك كامل الصلاحيات
        if role == 'TENANT_ADMIN':
            return True

        # المعلم وولي الأمر لا يملكان صلاحية الإضافة أو التعديل أو الحذف
        if role in ['TEACHER', 'PARENT']:
            return False

        if role != 'CENTER_MANAGER':
            return False

        # بالنسبة لمدير المركز، يجب أن يكون مديراً للمركز التابعة له الحلقة
        if center:
            if not center.manager:
                return False
            if center.manager.username != username and (not user_id or str(center.manager.id) != str(user_id)):
                return False

        return True
    except Exception:
        return False


def validate_and_get_teacher(db_name, center, teacher_id=None, teacher_name=None):
    """
    التحقق من أن المعلم ينتمي كمعلم نشط لنفس المركز المحدد
    """
    if not center:
        raise ValueError("يجب تحديد المركز أولاً لربطه بالمعلم والحلقة")

    if not teacher_id and not teacher_name:
        raise ValueError("اسم المعلم أو معرف المعلم (teacher_name / teacher_id) مطلوب")

    teacher_qs = UserProfile.objects.using(db_name).filter(
        role='TEACHER',
        is_active=True,
        center=center
    ).select_related('user')

    target_profile = None

    if teacher_id:
        target_profile = teacher_qs.filter(
            Q(id=teacher_id) | Q(user__id=teacher_id)
        ).first()

    if not target_profile and teacher_name:
        clean_name = str(teacher_name).strip().lower()
        for prof in teacher_qs:
            full_name = f"{prof.user.first_name} {prof.user.last_name}".strip().lower()
            username = prof.user.username.lower()
            first_name = prof.user.first_name.lower()
            last_name = prof.user.last_name.lower()

            if clean_name in [full_name, username, first_name, last_name] or clean_name == username or clean_name == full_name:
                target_profile = prof
                break

    if not target_profile:
        raise ValueError(f"عذراً، المعلم المحدد '{teacher_name or teacher_id}' غير موجود كمعلم نشط ينتمي لنفس المركز ({center.name})")

    display_name = f"{target_profile.user.first_name} {target_profile.user.last_name}".strip() or target_profile.user.username
    return target_profile, display_name


@csrf_exempt
def halaqa_list_create_view(request):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    if request.method == 'GET':
        try:
            halaqat = Halaqa.objects.using(db_name).filter(is_active=True).select_related('center', 'project').order_by('-created_at')
            res = []
            for h in halaqat:
                res.append({
                    "id": str(h.id),
                    "center_id": str(h.center.id) if h.center else None,
                    "center_name": h.center.name if h.center else None,
                    "project_id": str(h.project.id) if h.project else None,
                    "project_title": h.project.title if h.project else None,
                    "name": h.name,
                    "teacher_name": h.teacher_name,
                    "max_students": h.max_students,
                    "is_active": h.is_active,
                    "created_at": h.created_at.isoformat() if h.created_at else None,
                    "deleted_at": h.deleted_at.isoformat() if h.deleted_at else None
                })
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء جلب الحلقات", "details": str(e)}, status=500)

    elif request.method == 'POST':
        try:
            data = parse_body(request)
            name = data.get('name')
            teacher_name = data.get('teacher_name')
            teacher_id = data.get('teacher_id')
            center_id = data.get('center_id')
            project_id = data.get('project_id')
            confirm_duplicate = data.get('confirm_duplicate', False)

            if not name or (not teacher_name and not teacher_id):
                return JsonResponse({"status": "error", "message": "اسم الحلقة واسم/معرف المعلم مطلوبان"}, status=400)

            if not center_id:
                return JsonResponse({"status": "error", "message": "يجب اختيار وتحديد المركز (center_id) لربطه بالحلقة والمعلم"}, status=400)

            try:
                center = Center.objects.using(db_name).get(id=center_id)
            except Center.DoesNotExist:
                return JsonResponse({"status": "error", "message": "المركز المحدد غير موجود"}, status=404)

            project = None
            if project_id:
                try:
                    project = Project.objects.using(db_name).get(id=project_id)
                except Project.DoesNotExist:
                    return JsonResponse({"status": "error", "message": "المشروع المحدد غير موجود"}, status=404)

            # التحقق من الصلاحيات (أدمن أو مدير مركز)
            if not check_halaqa_permission(request, db_name, center=center):
                return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لإنشاء حلقة. لا يحق للمعلم أو ولي الأمر القيام بذلك."}, status=403)

            # التحقق من أن المعلم ينتمي كمعلم نشط لنفس المركز
            try:
                teacher_prof, resolved_teacher_name = validate_and_get_teacher(db_name, center, teacher_id=teacher_id, teacher_name=teacher_name)
            except ValueError as ve:
                return JsonResponse({"status": "error", "message": str(ve)}, status=400)

            clean_name = name.strip()
            # فحص وجود حلقة نشطة بنفس الاسم
            existing_halaqat = Halaqa.objects.using(db_name).filter(is_active=True, name__iexact=clean_name)

            if existing_halaqat.exists():
                same_center = False
                other_center = False

                for eh in existing_halaqat:
                    if center and eh.center and str(eh.center.id) == str(center.id):
                        same_center = True
                    elif not center and not eh.center:
                        same_center = True
                    else:
                        other_center = True

                if same_center and not confirm_duplicate:
                    return JsonResponse({
                        "status": "warning_duplicate",
                        "message": "توجد حلقة بنفس الاسم في هذا المسجد/المركز، هل ترغب في الاستمرار في الإنشاء أم لا؟",
                        "requires_confirmation": True
                    }, status=400)

                elif other_center and not confirm_duplicate:
                    return JsonResponse({
                        "status": "warning_other_center",
                        "message": "تنبيه: توجد حلقة بنفس الاسم في مركز آخر، هل ترغب في الاستمرار في الإنشاء أم لا؟",
                        "requires_confirmation": True
                    }, status=400)

            halaqa = Halaqa.objects.using(db_name).create(
                name=clean_name,
                teacher_name=resolved_teacher_name,
                center=center,
                project=project,
                max_students=data.get('max_students', 20),
                is_active=True
            )

            return JsonResponse({
                "status": "success",
                "message": "تم إضافة الحلقة القرآنية بنجاح",
                "data": {
                    "id": str(halaqa.id),
                    "name": halaqa.name,
                    "teacher_name": halaqa.teacher_name,
                    "center_id": str(halaqa.center.id) if halaqa.center else None,
                    "center_name": halaqa.center.name if halaqa.center else None,
                    "project_id": str(halaqa.project.id) if halaqa.project else None,
                    "project_title": halaqa.project.title if halaqa.project else None,
                    "max_students": halaqa.max_students,
                    "is_active": halaqa.is_active,
                    "created_at": halaqa.created_at.isoformat()
                }
            }, status=201)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ عند حفظ الحلقة", "details": str(e)}, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def halaqa_detail_view(request, pk):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    try:
        halaqa = Halaqa.objects.using(db_name).select_related('center', 'project').get(id=pk)
    except Halaqa.DoesNotExist:
        return JsonResponse({"status": "error", "message": "الحلقة المطلوبة غير موجودة"}, status=404)

    if request.method == 'GET':
        return JsonResponse({
            "status": "success",
            "data": {
                "id": str(halaqa.id),
                "center_id": str(halaqa.center.id) if halaqa.center else None,
                "center_name": halaqa.center.name if halaqa.center else None,
                "project_id": str(halaqa.project.id) if halaqa.project else None,
                "project_title": halaqa.project.title if halaqa.project else None,
                "name": halaqa.name,
                "teacher_name": halaqa.teacher_name,
                "max_students": halaqa.max_students,
                "is_active": halaqa.is_active,
                "created_at": halaqa.created_at.isoformat() if halaqa.created_at else None,
                "deleted_at": halaqa.deleted_at.isoformat() if halaqa.deleted_at else None
            }
        }, status=200)

    elif request.method == 'PUT':
        data = parse_body(request)
        center = halaqa.center
        if data.get('center_id'):
            try:
                center = Center.objects.using(db_name).get(id=data['center_id'])
            except Center.DoesNotExist:
                return JsonResponse({"status": "error", "message": "المركز المحدد غير موجود"}, status=404)

        if not check_halaqa_permission(request, db_name, center=center):
            return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لتعديل بيانات الحلقة."}, status=403)

        try:
            resolved_teacher_name = halaqa.teacher_name
            if 'teacher_name' in data or 'teacher_id' in data:
                _, resolved_teacher_name = validate_and_get_teacher(
                    db_name,
                    center,
                    teacher_id=data.get('teacher_id'),
                    teacher_name=data.get('teacher_name', halaqa.teacher_name)
                )

            if 'project_id' in data:
                if data['project_id']:
                    try:
                        halaqa.project = Project.objects.using(db_name).get(id=data['project_id'])
                    except Project.DoesNotExist:
                        return JsonResponse({"status": "error", "message": "المشروع المحدد غير موجود"}, status=404)
                else:
                    halaqa.project = None

            halaqa.name = data.get('name', halaqa.name).strip()
            halaqa.teacher_name = resolved_teacher_name
            halaqa.center = center
            halaqa.max_students = data.get('max_students', halaqa.max_students)
            if 'is_active' in data:
                halaqa.is_active = data['is_active']
            halaqa.save(using=db_name)

            return JsonResponse({"status": "success", "message": "تم تعديل بيانات الحلقة بنجاح"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل تعديل بيانات الحلقة", "details": str(e)}, status=500)

    elif request.method == 'PATCH':
        if not check_halaqa_permission(request, db_name, center=halaqa.center):
            return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لتعديل حالة الحلقة."}, status=403)

        try:
            data = parse_body(request)
            if 'is_active' in data:
                halaqa.is_active = data['is_active']
                if not halaqa.is_active and not halaqa.deleted_at:
                    halaqa.deleted_at = timezone.now()
                elif halaqa.is_active:
                    halaqa.deleted_at = None
                halaqa.save(using=db_name)
                state = "تفعيل" if halaqa.is_active else "إلغاء تنشيط"
                return JsonResponse({"status": "success", "message": f"تم {state} الحلقة بنجاح"})
            return JsonResponse({"status": "error", "message": "يجب تمرير حالة is_active"}, status=400)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل تغيير حالة الحلقة", "details": str(e)}, status=500)

    elif request.method == 'DELETE':
        if not check_halaqa_permission(request, db_name, center=halaqa.center):
            return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لحذف الحلقة. لا يحق للمعلم أو ولي الأمر القيام بذلك."}, status=403)

        try:
            halaqa.is_active = False
            halaqa.deleted_at = timezone.now()
            halaqa.save(using=db_name)
            return JsonResponse({"status": "success", "message": "تم حذف (إلغاء تنشيط) الحلقة بنجاح"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل حذف الحلقة", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

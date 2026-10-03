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
from tenant_modules.students_and_parents.models import Student
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


def get_token_payload(request):
    """استخراج بيانات التوكن من الطلب بدون رمي استثناء."""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    try:
        jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        return jwt.decode(token, jwt_secret, algorithms=["HS256"])
    except Exception:
        return None


def get_teacher_name_from_token(request, db_name):
    """
    يُعيد (teacher_name: str) إذا كان المستخدم معلماً مصادقاً،
    أو يُعيد (None) إذا كان أدمناً أو مديراً (لا حاجة للتصفية),
    أو يرمي ValueError بكود مناسب إذا فشل التحقق.

    أكواد الخطأ:
        - "AUTH_REQUIRED"    : لا يوجد توكن أو التوكن غير صالح
        - "FORBIDDEN"        : الدور غير مسموح له بالوصول
        - "TEACHER_NOT_FOUND": المعلم غير موجود أو غير نشط في قاعدة البيانات
    """
    payload = get_token_payload(request)
    if payload is None:
        raise ValueError("AUTH_REQUIRED")

    role = payload.get('role', '')

    # الأدمن ومدير المركز يملكان صلاحية رؤية كل الحلقات — لا تصفية
    if role in ('TENANT_ADMIN', 'CENTER_MANAGER'):
        return None

    if role != 'TEACHER':
        raise ValueError("FORBIDDEN")

    user_id = payload.get('user_id')
    if not user_id:
        raise ValueError("AUTH_REQUIRED")

    try:
        prof = UserProfile.objects.using(db_name).select_related('user').get(
            user__id=user_id, role='TEACHER', is_active=True
        )
    except UserProfile.DoesNotExist:
        raise ValueError("TEACHER_NOT_FOUND")

    teacher_name = f"{prof.user.first_name} {prof.user.last_name}".strip() or prof.user.username
    return teacher_name


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

        # المعلم والطالب لا يملكان صلاحية الإضافة أو التعديل أو الحذف
        if role in ['TEACHER', 'STUDENT']:
            return False

        if role != 'CENTER_MANAGER':
            return False

        # بالنسبة لمدير المركز، يجب أن يكون مديراً للمركز التابعة له الحلقة
        if center:
            is_manager_of_center = False
            if center.manager and (center.manager.username == username or (user_id and str(center.manager.id) == str(user_id))):
                is_manager_of_center = True
            elif user_id and UserProfile.objects.using(db_name).filter(user__id=user_id, center=center, role='CENTER_MANAGER').exists():
                is_manager_of_center = True
            elif username and UserProfile.objects.using(db_name).filter(user__username=username, center=center, role='CENTER_MANAGER').exists():
                is_manager_of_center = True

            if not is_manager_of_center:
                return False

        return True
    except Exception:
        return False


def validate_and_get_teacher(db_name, center, teacher_id=None, teacher_name=None, exclude_halaqa_id=None):
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
    
    # Check max load/capacity constraint (e.g. 3 circles)
    from .models import Halaqa
    active_circles_qs = Halaqa.objects.using(db_name).filter(
        teacher_name=display_name,
        is_active=True,
        deleted_at__isnull=True
    )
    if exclude_halaqa_id:
        active_circles_qs = active_circles_qs.exclude(id=exclude_halaqa_id)
        
    MAX_CIRCLES = 3
    if active_circles_qs.count() >= MAX_CIRCLES:
        raise ValueError(f"عذراً، المعلم {display_name} وصل للحد الأقصى لعدد الحلقات المسموح بها ({MAX_CIRCLES}).")

    return target_profile, display_name


@csrf_exempt
def halaqa_list_create_view(request):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    if request.method == 'GET':
        try:
            # --- تحديد المعلم من التوكن وتصفية الحلقات بناءً على صلاحيته ---
            try:
                teacher_name = get_teacher_name_from_token(request, db_name)
            except ValueError as auth_err:
                err_code = str(auth_err)
                if err_code == "AUTH_REQUIRED":
                    return JsonResponse({"status": "error", "message": "يجب تسجيل الدخول للوصول إلى الحلقات"}, status=401)
                elif err_code == "FORBIDDEN":
                    return JsonResponse({"status": "error", "message": "لا تملك صلاحية الوصول إلى الحلقات"}, status=403)
                elif err_code == "TEACHER_NOT_FOUND":
                    return JsonResponse({"status": "error", "message": "لم يُعثر على ملف المعلم النشط"}, status=403)
                else:
                    return JsonResponse({"status": "error", "message": "خطأ في التحقق من الهوية"}, status=401)

            halaqat = Halaqa.objects.using(db_name).filter(is_active=True, deleted_at__isnull=True)

            # إذا كان المستخدم معلماً، نُصفّي الحلقات المخصصة له فقط
            if teacher_name is not None:
                halaqat = halaqat.filter(teacher_name=teacher_name)

            payload = get_token_payload(request)
            if payload and payload.get('role') == 'CENTER_MANAGER':
                username = payload.get('username')
                user_id = payload.get('user_id')
                try:
                    prof = UserProfile.objects.using(db_name).get(user__username=username) if username else None
                    if not prof and user_id:
                        prof = UserProfile.objects.using(db_name).get(user__id=user_id)
                    if prof and prof.center:
                        halaqat = halaqat.filter(center=prof.center)
                    else:
                        halaqat = halaqat.none()
                except Exception:
                    halaqat = halaqat.none()

            halaqat = halaqat.select_related('center', 'project').order_by('-created_at')
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
                    "students_count": Student.objects.using(db_name).filter(
                        Q(halaqa=h) | Q(enrollments__halaqa=h, enrollments__is_active=True)
                    ).distinct().count(),
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
            teacher_id = data.get('teacher_id')
            center_id = data.get('center_id')
            project_id = data.get('project_id')
            confirm_duplicate = data.get('confirm_duplicate', False)

            if not name or not teacher_id:
                return JsonResponse({"status": "error", "message": "اسم الحلقة ومعرف المعلم (teacher_id) مطلوبان"}, status=400)

            if not center_id:
                return JsonResponse({"status": "error", "message": "يجب اختيار وتحديد المركز (center_id) لربطه بالحلقة والمعلم"}, status=400)

            try:
                center = Center.objects.using(db_name).get(id=center_id)
            except Center.DoesNotExist:
                return JsonResponse({"status": "error", "message": "المركز المحدد غير موجود"}, status=404)

            if not project_id:
                return JsonResponse({"status": "error", "message": "المشروع حقل إلزامي. لا يمكن إنشاء أي حلقة دون اختيار مشروع."}, status=400)

            try:
                project = Project.objects.using(db_name).get(id=project_id)
            except Project.DoesNotExist:
                return JsonResponse({"status": "error", "message": "المشروع المحدد غير موجود"}, status=404)

            if not project.is_global and not project.centers.filter(id=center.id).exists():
                return JsonResponse({"status": "error", "message": f"عذراً، المشروع '{project.title}' غير مرتبط بالمركز المحدد '{center.name}'."}, status=400)

            # التحقق من الصلاحيات (أدمن أو مدير مركز)
            if not check_halaqa_permission(request, db_name, center=center):
                return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لإنشاء حلقة. لا يحق للمعلم أو ولي الأمر القيام بذلك."}, status=403)

            # التحقق من أن المعلم ينتمي كمعلم نشط لنفس المركز
            try:
                teacher_prof, resolved_teacher_name = validate_and_get_teacher(db_name, center, teacher_id=teacher_id)
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
                    "students_count": 0,
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
        # --- التحقق من صلاحية الوصول: المعلم يرى حلقته فقط ---
        try:
            teacher_name = get_teacher_name_from_token(request, db_name)
        except ValueError as auth_err:
            err_code = str(auth_err)
            if err_code == "AUTH_REQUIRED":
                return JsonResponse({"status": "error", "message": "يجب تسجيل الدخول للوصول إلى تفاصيل الحلقة"}, status=401)
            elif err_code in ("FORBIDDEN", "TEACHER_NOT_FOUND"):
                return JsonResponse({"status": "error", "message": "لا تملك صلاحية الوصول إلى هذه الحلقة"}, status=403)
            else:
                return JsonResponse({"status": "error", "message": "خطأ في التحقق من الهوية"}, status=401)

        # إذا كان معلماً، نتحقق أن الحلقة مخصصة له بالضبط
        if teacher_name is not None and halaqa.teacher_name != teacher_name:
            return JsonResponse({"status": "error", "message": "غير مصرح لك بالوصول إلى هذه الحلقة"}, status=403)

        payload = get_token_payload(request)
        if payload and payload.get('role') == 'CENTER_MANAGER':
            username = payload.get('username')
            user_id = payload.get('user_id')
            try:
                prof = UserProfile.objects.using(db_name).get(user__username=username) if username else None
                if not prof and user_id:
                    prof = UserProfile.objects.using(db_name).get(user__id=user_id)
                if not prof or not prof.center or not halaqa.center or str(prof.center.id) != str(halaqa.center.id):
                    return JsonResponse({"status": "error", "message": "غير مصرح لمدير المركز بالوصول إلى حلقات خارج مركزه"}, status=403)
            except Exception:
                return JsonResponse({"status": "error", "message": "غير مصرح لمدير المركز بالوصول إلى حلقات خارج مركزه"}, status=403)

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
                "students_count": Student.objects.using(db_name).filter(
                    Q(halaqa=halaqa) | Q(enrollments__halaqa=halaqa, enrollments__is_active=True)
                ).distinct().count(),
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
                    teacher_name=data.get('teacher_name', halaqa.teacher_name),
                    exclude_halaqa_id=halaqa.id
                )

            if 'project_id' in data:
                if not data['project_id']:
                    return JsonResponse({"status": "error", "message": "المشروع حقل إلزامي لجميع الحلقات ولا يمكن إزالته"}, status=400)
                try:
                    halaqa.project = Project.objects.using(db_name).get(id=data['project_id'])
                except Project.DoesNotExist:
                    return JsonResponse({"status": "error", "message": "المشروع المحدد غير موجود"}, status=404)

            if halaqa.project and not halaqa.project.is_global and not halaqa.project.centers.filter(id=center.id).exists():
                return JsonResponse({"status": "error", "message": f"عذراً، المشروع '{halaqa.project.title}' غير مرتبط بالمركز المحدد '{center.name}'."}, status=400)

            new_name = data.get('name', halaqa.name).strip()
            confirm_duplicate = data.get('confirm_duplicate', False)

            if not new_name:
                return JsonResponse({"status": "error", "message": "اسم الحلقة لا يمكن أن يكون فارغاً"}, status=400)

            # فحص وجود حلقة نشطة بنفس الاسم مع استثناء الحلقة الحالية
            existing_halaqat = Halaqa.objects.using(db_name).filter(
                is_active=True,
                deleted_at__isnull=True,
                name__iexact=new_name
            ).exclude(id=halaqa.id)

            if existing_halaqat.exists() and not confirm_duplicate:
                same_center = False
                other_center = False
                for eh in existing_halaqat:
                    if center and eh.center and str(eh.center.id) == str(center.id):
                        same_center = True
                    elif not center and not eh.center:
                        same_center = True
                    else:
                        other_center = True

                if same_center:
                    return JsonResponse({
                        "status": "warning_duplicate",
                        "message": "توجد حلقة أخرى بنفس الاسم في هذا المسجد/المركز، هل ترغب في الاستمرار بالتعديل أم لا؟",
                        "requires_confirmation": True
                    }, status=400)
                elif other_center:
                    return JsonResponse({
                        "status": "warning_other_center",
                        "message": "تنبيه: توجد حلقة بنفس الاسم في مركز آخر، هل ترغب في الاستمرار بالتعديل أم لا؟",
                        "requires_confirmation": True
                    }, status=400)

            halaqa.name = new_name
            halaqa.teacher_name = resolved_teacher_name
            halaqa.center = center
            if 'is_active' in data:
                halaqa.is_active = data['is_active']
            halaqa.save(using=db_name)

            return JsonResponse({
                "status": "success",
                "message": "تم تعديل بيانات الحلقة القرآنية بنجاح",
                "data": {
                    "id": str(halaqa.id),
                    "name": halaqa.name,
                    "teacher_name": halaqa.teacher_name,
                    "center_id": str(halaqa.center.id) if halaqa.center else None,
                    "center_name": halaqa.center.name if halaqa.center else None,
                    "project_id": str(halaqa.project.id) if halaqa.project else None,
                    "project_title": halaqa.project.title if halaqa.project else None,
                    "is_active": halaqa.is_active
                }
            }, status=200)
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
            halaqa_name = halaqa.name
            halaqa.is_active = False
            halaqa.deleted_at = timezone.now()
            halaqa.save(using=db_name)
            return JsonResponse({"status": "success", "message": f"تم حذف حلقة ({halaqa_name}) بنجاح"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل حذف الحلقة", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

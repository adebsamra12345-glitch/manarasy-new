import json
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.users.models import UserProfile
from .models import Student, Parent, StudentEnrollment
from .utils import resolve_stage_and_part, check_student_project_uniqueness

def parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        raise ValueError("صيغة بيانات غير صالحة")

def get_tenant_db(request):
    tenant_id = request.headers.get('Tenant-ID')
    if not tenant_id:
        return 'default'
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
        return db_name
    except Exception:
        return 'default'

@csrf_exempt
def parent_list_create_view(request):
    db_name = get_tenant_db(request)
    
    if request.method == 'GET':
        try:
            parents = Parent.objects.using(db_name).all().order_by('-created_at')
            res = []
            for p in parents:
                res.append({
                    "id": str(p.id),
                    "full_name": p.full_name,
                    "phone": p.phone,
                    "email": p.email,
                    "created_at": p.created_at.isoformat()
                })
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء جلب قائمة أولياء الأمور", "details": str(e)}, status=500)

    elif request.method == 'POST':
        try:
            data = parse_body(request)
            
            if not data.get('full_name') or not data.get('phone'):
                return JsonResponse({"status": "error", "message": "الاسم الكامل ورقم الهاتف مطلوبان"}, status=400)

            parent = Parent.objects.using(db_name).create(
                full_name=data['full_name'],
                phone=data['phone'],
                email=data.get('email')
            )
            return JsonResponse({
                "status": "success",
                "message": "تم إضافة ولي الأمر بنجاح",
                "data": {"id": str(parent.id), "full_name": parent.full_name, "phone": parent.phone}
            }, status=201)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء إضافة ولي الأمر", "details": str(e)}, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def student_list_create_view(request):
    db_name = get_tenant_db(request)

    if request.method == 'GET':
        try:
            students = Student.objects.using(db_name).select_related('parent', 'halaqa').prefetch_related(
                'enrollments__halaqa__project',
                'enrollments__current_stage',
                'enrollments__current_part'
            ).all().order_by('-created_at')
            
            res = []
            for s in students:
                enrollments_data = []
                for en in s.enrollments.filter(is_active=True):
                    enrollments_data.append({
                        "enrollment_id": str(en.id),
                        "halaqa_id": str(en.halaqa.id) if en.halaqa else None,
                        "halaqa_name": en.halaqa.name if en.halaqa else None,
                        "project_id": str(en.project.id) if en.project else None,
                        "project_title": en.project.title if en.project else None,
                        "reached_page": en.reached_page,
                        "stage_id": str(en.current_stage.id) if en.current_stage else None,
                        "stage_title": en.current_stage.title if en.current_stage else None,
                        "part_id": str(en.current_part.id) if en.current_part else None,
                        "part_title": en.current_part.title if en.current_part else None,
                    })

                res.append({
                    "id": str(s.id),
                    "full_name": s.full_name,
                    "national_id": s.national_id,
                    "birth_date": s.birth_date.isoformat() if s.birth_date else None,
                    "parent_name": s.parent.full_name if s.parent else None,
                    "halaqa_name": s.halaqa.name if s.halaqa else None,
                    "reached_page": s.reached_page,
                    "enrollments": enrollments_data,
                    "created_at": s.created_at.isoformat()
                })
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ عند استرجاع ملفات الطلاب", "details": str(e)}, status=500)

    elif request.method == 'POST':
        try:
            data = parse_body(request)
            
            if not data.get('full_name'):
                return JsonResponse({"status": "error", "message": "الاسم الكامل للطالب مطلوب"}, status=400)

            reached_page = data.get('reached_page', 1)

            parent = None
            if data.get('parent_id'):
                try:
                    parent = Parent.objects.using(db_name).get(id=data['parent_id'])
                except Parent.DoesNotExist:
                    return JsonResponse({"status": "error", "message": "ولي الأمر المرتبط غير موجود"}, status=404)

            halaqa = None
            if data.get('halaqa_id'):
                try:
                    halaqa = Halaqa.objects.using(db_name).get(id=data['halaqa_id'])
                except Halaqa.DoesNotExist:
                    return JsonResponse({"status": "error", "message": "الحلقة القرآنية غير موجودة"}, status=404)

            student = Student.objects.using(db_name).create(
                full_name=data['full_name'],
                parent=parent,
                halaqa=halaqa,
                national_id=data.get('national_id'),
                birth_date=data.get('birth_date'),
                reached_page=reached_page
            )

            enrollment_info = None
            if halaqa:
                # التحقق من عدم الانضمام لأكثر من حلقة بنفس المشروع
                is_valid, err_msg = check_student_project_uniqueness(db_name, student=student, target_halaqa=halaqa)
                if not is_valid:
                    student.delete(using=db_name)
                    return JsonResponse({"status": "error", "message": err_msg}, status=400)

                # احتساب المرحلة والجزء بناءً على صفحة الوصول والمشروع
                stage, part = resolve_stage_and_part(db_name, halaqa.project, reached_page)

                enrollment = StudentEnrollment.objects.using(db_name).create(
                    student=student,
                    halaqa=halaqa,
                    project=halaqa.project,
                    reached_page=reached_page,
                    current_stage=stage,
                    current_part=part,
                    is_active=True
                )

                enrollment_info = {
                    "enrollment_id": str(enrollment.id),
                    "halaqa_id": str(halaqa.id),
                    "halaqa_name": halaqa.name,
                    "project_id": str(halaqa.project.id) if halaqa.project else None,
                    "project_title": halaqa.project.title if halaqa.project else None,
                    "reached_page": reached_page,
                    "stage_id": str(stage.id) if stage else None,
                    "stage_title": stage.title if stage else None,
                    "part_id": str(part.id) if part else None,
                    "part_title": part.title if part else None
                }

            return JsonResponse({
                "status": "success",
                "message": "تم إنشاء ملف الطالب وتحديد بيانات حفظه بنجاح",
                "data": {
                    "id": str(student.id),
                    "full_name": student.full_name,
                    "reached_page": student.reached_page,
                    "enrollment": enrollment_info
                }
            }, status=201)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ عند إضافة الطالب", "details": str(e)}, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def student_enrollment_view(request):
    """
    إسناد الطالب إلى حلقة قرآنية وتحديد/تحديث معلومات الحفظ (صفحة الوصول والمشروع والمرحلة والجزء)
    في عملية منفصلة
    """
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name = get_tenant_db(request)
        data = parse_body(request)

        student_id = data.get('student_id')
        user_profile_id = data.get('user_profile_id')
        halaqa_id = data.get('halaqa_id')
        reached_page = data.get('reached_page')

        if not halaqa_id or (not student_id and not user_profile_id):
            return JsonResponse({"status": "error", "message": "معرف الطالب (student_id / user_profile_id) ومعرف الحلقة (halaqa_id) مطلوبان"}, status=400)

        student = None
        user_profile = None

        if student_id:
            try:
                student = Student.objects.using(db_name).get(id=student_id)
            except Student.DoesNotExist:
                return JsonResponse({"status": "error", "message": "ملف الطالب غير موجود"}, status=404)

        if user_profile_id:
            try:
                user_profile = UserProfile.objects.using(db_name).get(id=user_profile_id)
            except UserProfile.DoesNotExist:
                return JsonResponse({"status": "error", "message": "حساب المستفيد (UserProfile) غير موجود"}, status=404)

        try:
            halaqa = Halaqa.objects.using(db_name).get(id=halaqa_id)
        except Halaqa.DoesNotExist:
            return JsonResponse({"status": "error", "message": "الحلقة القرآنية غير موجودة"}, status=404)

        # التحقق من شرط عدم الانضمام لأكثر من حلقة بنفس المشروع
        is_valid, err_msg = check_student_project_uniqueness(
            db_name,
            student=student,
            user_profile=user_profile,
            target_halaqa=halaqa
        )
        if not is_valid:
            return JsonResponse({"status": "error", "message": err_msg}, status=400)

        # تحديد صفحة الوصول
        target_page = reached_page
        if target_page is None:
            if student and student.reached_page:
                target_page = student.reached_page
            elif user_profile and user_profile.reached_page:
                target_page = user_profile.reached_page
            else:
                target_page = 1

        target_page = int(target_page)

        # تحديث صفحة الوصول والحلقة بالملف الأساسي
        if student:
            student.reached_page = target_page
            student.halaqa = halaqa
            student.save(using=db_name)

        if user_profile:
            user_profile.reached_page = target_page
            user_profile.save(using=db_name)

        # تحديث/احتساب المرحلة والجزء للمشروع
        stage, part = resolve_stage_and_part(db_name, halaqa.project, target_page)

        enrollment, created = StudentEnrollment.objects.using(db_name).update_or_create(
            student=student,
            user_profile=user_profile,
            halaqa=halaqa,
            defaults={
                'project': halaqa.project,
                'reached_page': target_page,
                'current_stage': stage,
                'current_part': part,
                'is_active': True
            }
        )

        action_str = "تم ضم الطالب بنجاح للحلقة وتحديد مرحلته وجزئه" if created else "تم تحديث معلومات التسجيل والحفظ للطالب بنجاح"
        return JsonResponse({
            "status": "success",
            "message": action_str,
            "data": {
                "enrollment_id": str(enrollment.id),
                "student_id": str(student.id) if student else None,
                "user_profile_id": str(user_profile.id) if user_profile else None,
                "halaqa_id": str(halaqa.id),
                "halaqa_name": halaqa.name,
                "project_id": str(halaqa.project.id) if halaqa.project else None,
                "project_title": halaqa.project.title if halaqa.project else None,
                "reached_page": target_page,
                "stage_id": str(stage.id) if stage else None,
                "stage_title": stage.title if stage else None,
                "part_id": str(part.id) if part else None,
                "part_title": part.title if part else None
            }
        }, status=201 if created else 200)

    except Exception as e:
        return JsonResponse({"status": "error", "message": "حدث خطأ أثناء تسجيل الطالب في الحلقة", "details": str(e)}, status=500)

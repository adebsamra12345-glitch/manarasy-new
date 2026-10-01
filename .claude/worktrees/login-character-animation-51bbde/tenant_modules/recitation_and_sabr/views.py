import json
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from tenant_modules.attendance.models import AttendanceLog, HalaqaSession
from tenant_modules.students_and_parents.models import Student, StudentEnrollment
from tenant_modules.centers_and_projects.models import EvaluationGrade
from tenant_modules.students_and_parents.utils import resolve_stage_and_part
from .models import RecitationLog

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
def recitation_evaluate_view(request):
    """
    تسجيل تقييم المعلم لتسميع الصفحة وسلوك الطالب
    """
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name = get_tenant_db(request)
        data = parse_body(request)

        attendance_id = data.get('attendance_id')
        student_id = data.get('student_id')
        page_number = data.get('page_number')
        evaluation_grade_id = data.get('evaluation_grade_id')
        grade_input = data.get('grade')
        behavior_score = data.get('behavior_score', 10)
        recitation_type = data.get('recitation_type', 'NEW_MEMORIZATION')
        notes = data.get('notes', '')

        if not attendance_id and not student_id:
            return JsonResponse({"status": "error", "message": "معرف الحضور (attendance_id) أو معرف الطالب (student_id) مطلوب"}, status=400)

        # استخراج سجل الحضور
        att = None
        if attendance_id:
            try:
                att = AttendanceLog.objects.using(db_name).get(id=attendance_id)
            except AttendanceLog.DoesNotExist:
                return JsonResponse({"status": "error", "message": "سجل الحضور المطلوب غير موجود"}, status=404)

        student = None
        target_student_id = student_id or (att.student_id if att else None)
        if target_student_id:
            try:
                student = Student.objects.using(db_name).select_related('halaqa__project').get(id=target_student_id)
            except Student.DoesNotExist:
                return JsonResponse({"status": "error", "message": "الطالب غير موجود"}, status=404)

        if not att and student and student.halaqa:
            # إنشاء سجل حضور سريع إن لم يكن موجوداً
            att, _ = AttendanceLog.objects.using(db_name).get_or_create(
                student_id=student.id,
                halaqa_id=student.halaqa.id,
                defaults={'status': 'PRESENT', 'behavior_score': behavior_score}
            )

        # الصفحة المراد تسميعها
        page_num = page_number
        if page_num is None:
            page_num = (student.reached_page or 1) + 1 if student else 1
        page_num = int(page_num)

        # تحديد فئة التقييم ومؤشر الإعادة
        eval_grade = None
        grade_name = grade_input or "مقبول"
        requires_repeat = False

        if evaluation_grade_id:
            try:
                eval_grade = EvaluationGrade.objects.using(db_name).get(id=evaluation_grade_id)
                grade_name = eval_grade.name
                requires_repeat = eval_grade.requires_repeat
            except EvaluationGrade.DoesNotExist:
                return JsonResponse({"status": "error", "message": "فئة التقييم المحددة غير موجودة"}, status=404)
        elif grade_input:
            if "إعادة" in grade_input or "اعادة" in grade_input or grade_input.lower() == "repeat":
                requires_repeat = True

        # ضبط تقييم السلوك (من 1 إلى 10)
        try:
            b_score = int(behavior_score)
            b_score = max(1, min(10, b_score))
        except (ValueError, TypeError):
            b_score = 10

        if att:
            att.behavior_score = b_score
            att.save(using=db_name)

        # تسجيل عملية التسميع
        rec = RecitationLog.objects.using(db_name).create(
            attendance=att,
            student_id=student.id if student else att.student_id,
            recitation_type=recitation_type,
            page_number=page_num,
            evaluation_grade=eval_grade,
            grade=grade_name,
            requires_repeat=requires_repeat,
            behavior_score=b_score,
            notes=notes
        )

        can_recite_next = True
        next_page = page_num + 1
        stage_title = None
        part_title = None

        if requires_repeat:
            # في حال الإعادة: يمنع الطالب من التسميع للصفحة التالية ويبقى عند صفحته الحالية
            can_recite_next = False
            next_page = page_num
            msg = f"تم تسجيل تقييم الإعادة للصفحة ({page_num}). تم إيقاف التسميع لهذا اليوم وتكرار الصفحة في الجلسة القادمة."
        else:
            # في حال النجاح في الصفحة: يتم تحديث صفحة الوصول واحتساب المرحلة والجزء
            if student:
                student.reached_page = page_num
                student.save(using=db_name)

                # تحديث سجل التسجيل في المشروع (Enrollment)
                enrollment = StudentEnrollment.objects.using(db_name).filter(student=student, is_active=True).first()
                if enrollment:
                    enrollment.reached_page = page_num
                    stage, part = resolve_stage_and_part(db_name, enrollment.project, page_num, student=student)
                    enrollment.current_stage = stage
                    enrollment.current_part = part
                    enrollment.save(using=db_name)
                    stage_title = stage.title if stage else None
                    part_title = part.title if part else None

            msg = f"تم تسجيل تقييم الصفحة ({page_num}) بنجاح. الطالب متاح لتسميع الصفحة التالية ({next_page})."

        return JsonResponse({
            "status": "success",
            "message": msg,
            "data": {
                "recitation_id": str(rec.id),
                "student_id": str(student.id) if student else str(att.student_id),
                "student_name": student.full_name if student else "طالب",
                "page_number": page_num,
                "grade": grade_name,
                "requires_repeat": requires_repeat,
                "can_recite_next": can_recite_next,
                "next_page": next_page,
                "behavior_score": b_score,
                "reached_page": student.reached_page if student else page_num,
                "stage_title": stage_title,
                "part_title": part_title
            }
        }, status=201)

    except Exception as e:
        return JsonResponse({"status": "error", "message": "فشل تسجيل تقييم التسميع", "details": str(e)}, status=500)


@csrf_exempt
def recitation_list_create_view(request):
    db_name = get_tenant_db(request)

    if request.method == 'GET':
        try:
            logs = RecitationLog.objects.using(db_name).select_related('attendance', 'evaluation_grade').all().order_by('-created_at')
            res = []
            for r in logs:
                st = Student.objects.using(db_name).filter(id=r.student_id).first()
                res.append({
                    "id": str(r.id),
                    "attendance_id": str(r.attendance.id) if r.attendance else None,
                    "student_id": str(r.student_id),
                    "student_name": st.full_name if st else "طالب",
                    "recitation_type": r.recitation_type,
                    "page_number": r.page_number,
                    "grade": r.grade,
                    "requires_repeat": r.requires_repeat,
                    "behavior_score": r.behavior_score,
                    "created_at": r.created_at.isoformat()
                })
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء جلب سجل التسميع", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

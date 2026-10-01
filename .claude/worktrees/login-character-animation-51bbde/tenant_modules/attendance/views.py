import json
import uuid
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.db import IntegrityError
from core_system.tenants.models import Tenant
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student, StudentEnrollment
from tenant_modules.centers_and_projects.models import Project, EvaluationTemplate
from .models import HalaqaSession, AttendanceLog

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
def session_start_view(request):
    """
    بدء جلسة/حصة جديدة للحلقة وتسجيل الحضور والغياب تلقائياً
    (يكون جميع الطلاب بالحالة "حاضر" افتراضياً مع إمكانية تحديد الطلاب الغائبين)
    """
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name = get_tenant_db(request)
        data = parse_body(request)

        halaqa_id = data.get('halaqa_id')
        teacher_id = data.get('teacher_id')
        absent_student_ids = data.get('absent_student_ids', [])
        notes = data.get('notes', '')

        if not halaqa_id:
            return JsonResponse({"status": "error", "message": "معرف الحلقة (halaqa_id) مطلوب"}, status=400)

        try:
            halaqa = Halaqa.objects.using(db_name).select_related('project', 'center').get(id=halaqa_id)
        except Halaqa.DoesNotExist:
            return JsonResponse({"status": "error", "message": "الحلقة القرآنية غير موجودة"}, status=404)

        # إنشاء سجل الجلسة
        session = HalaqaSession.objects.using(db_name).create(
            halaqa_id=halaqa.id,
            teacher_id=teacher_id,
            notes=notes,
            is_active=True
        )

        # استخراج كافة الطلاب الانتمين للحلقة
        students = Student.objects.using(db_name).filter(halaqa=halaqa).order_by('full_name')

        absent_ids_set = set(str(sid) for sid in absent_student_ids)

        attendance_records = []
        students_payload = []

        # استخراج نموذج التقييم المعتمد للمشروع
        eval_template_data = None
        project = halaqa.project
        if project and project.evaluation_template:
            tmpl = project.evaluation_template
            grades = tmpl.grades.all().order_by('order', 'id')
            eval_template_data = {
                "id": str(tmpl.id),
                "title": tmpl.title,
                "grades": [
                    {
                        "id": str(g.id),
                        "name": g.name,
                        "requires_repeat": g.requires_repeat,
                        "order": g.order,
                        "color_code": g.color_code
                    } for g in grades
                ]
            }

        for st in students:
            is_absent = str(st.id) in absent_ids_set
            status_val = 'ABSENT' if is_absent else 'PRESENT'

            att = AttendanceLog.objects.using(db_name).create(
                session=session,
                student_id=st.id,
                halaqa_id=halaqa.id,
                teacher_id=teacher_id,
                status=status_val,
                behavior_score=10
            )

            # الصفحة المقترحة للتسميع هي (صفحة الوصول + 1)
            current_reached = st.reached_page or 1
            next_reciting_page = current_reached + 1 if current_reached > 0 else 1

            students_payload.append({
                "student_id": str(st.id),
                "student_name": st.full_name,
                "attendance_id": str(att.id),
                "attendance_status": status_val,
                "reached_page": current_reached,
                "next_reciting_page": next_reciting_page,
                "behavior_score": 10
            })

        return JsonResponse({
            "status": "success",
            "message": "تم بدء الجلسة وتسجيل الحضور والغياب بنجاح",
            "data": {
                "session_id": str(session.id),
                "session_date": session.session_date.isoformat(),
                "halaqa_id": str(halaqa.id),
                "halaqa_name": halaqa.name,
                "project_id": str(project.id) if project else None,
                "project_title": project.title if project else None,
                "evaluation_template": eval_template_data,
                "students": students_payload
            }
        }, status=201)

    except Exception as e:
        return JsonResponse({"status": "error", "message": "حدث خطأ أثناء بدء الجلسة", "details": str(e)}, status=500)


@csrf_exempt
def session_detail_view(request, pk):
    """جلب تفاصيل الجلسة وقائمة الحضور للطلاب"""
    db_name = get_tenant_db(request)
    try:
        session = HalaqaSession.objects.using(db_name).get(id=pk)
    except HalaqaSession.DoesNotExist:
        return JsonResponse({"status": "error", "message": "الجلسة غير موجودة"}, status=404)

    if request.method == 'GET':
        logs = session.attendance_logs.using(db_name).all()
        res = []
        for l in logs:
            st = Student.objects.using(db_name).filter(id=l.student_id).first()
            res.append({
                "attendance_id": str(l.id),
                "student_id": str(l.student_id),
                "student_name": st.full_name if st else "طالب",
                "status": l.status,
                "behavior_score": l.behavior_score,
                "reached_page": st.reached_page if st else 1
            })
        return JsonResponse({"status": "success", "session_id": str(session.id), "attendance": res}, status=200)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def attendance_list_create_view(request):
    db_name = get_tenant_db(request)
    
    if request.method == 'GET':
        try:
            logs = AttendanceLog.objects.using(db_name).all().order_by('-session_date')
            res = []
            for log in logs:
                res.append({
                    "id": str(log.id),
                    "student_id": str(log.student_id),
                    "halaqa_id": str(log.halaqa_id),
                    "teacher_id": str(log.teacher_id) if log.teacher_id else None,
                    "session_date": log.session_date.isoformat(),
                    "status": log.status,
                    "behavior_score": log.behavior_score,
                    "check_in_time": log.check_in_time.isoformat() if log.check_in_time else None,
                    "notes": log.notes
                })
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ عند استرجاع سجل الحضور", "details": str(e)}, status=500)

    elif request.method == 'POST':
        try:
            data = parse_body(request)
            req = ['student_id', 'halaqa_id', 'status']
            for r in req:
                if not data.get(r):
                    return JsonResponse({"status": "error", "message": f"الحقل {r} مطلوب"}, status=400)

            att = AttendanceLog.objects.using(db_name).create(
                student_id=data['student_id'],
                halaqa_id=data['halaqa_id'],
                teacher_id=data.get('teacher_id'),
                status=data['status'],
                behavior_score=data.get('behavior_score', 10),
                notes=data.get('notes')
            )
            return JsonResponse({
                "status": "success",
                "message": "تم تسجيل الحضور والغياب بنجاح",
                "data": {
                    "id": str(att.id),
                    "student_id": str(att.student_id),
                    "session_date": att.session_date.isoformat(),
                    "status": att.status
                }
            }, status=201)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء تسجيل الحضور", "details": str(e)}, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

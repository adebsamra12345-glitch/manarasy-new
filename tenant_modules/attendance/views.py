import json
import uuid
import datetime
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from core_system.tenants.models import Tenant
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student, StudentEnrollment
from tenant_modules.centers_and_projects.models import Project, EvaluationTemplate, EvaluationGrade
from tenant_modules.recitation_and_sabr.models import RecitationLog
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

def parse_session_datetime(date_str, time_str, default_hour=16):
    if not date_str:
        return None
    try:
        d = datetime.datetime.strptime(str(date_str)[:10], '%Y-%m-%d').date()
    except Exception:
        d = timezone.now().date()
        
    if not time_str:
        t = datetime.time(default_hour, 0)
    elif isinstance(time_str, str) and 'T' in time_str:
        try:
            time_part = time_str.split('T')[1][:5]
            parts = time_part.split(':')
            t = datetime.time(int(parts[0]), int(parts[1]))
        except Exception:
            t = datetime.time(default_hour, 0)
    elif isinstance(time_str, str) and ':' in time_str:
        try:
            parts = time_str.split(':')
            t = datetime.time(int(parts[0]), int(parts[1][:2]))
        except Exception:
            t = datetime.time(default_hour, 0)
    else:
        t = datetime.time(default_hour, 0)
        
    return datetime.datetime.combine(d, t)

@csrf_exempt
def session_start_view(request):
    """
    بدء جلسة/حصة جديدة للحلقة وتسجيل الحضور والغياب تلقائياً
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

        session = HalaqaSession.objects.using(db_name).create(
            halaqa_id=halaqa.id,
            teacher_id=teacher_id,
            notes=notes,
            is_active=True
        )

        students = Student.objects.using(db_name).filter(halaqa=halaqa).order_by('full_name')
        absent_ids_set = set(str(sid) for sid in absent_student_ids)

        students_payload = []

        eval_template_data = None
        project = halaqa.project
        if project and project.evaluation_template:
            tmpl = project.evaluation_template
            grades = EvaluationGrade.objects.using(db_name).filter(template=tmpl).order_by('order', 'id')
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
                is_late=False,
                behavior_score=10,
                behavior='EXCELLENT'
            )

            current_reached = st.reached_page or 1
            next_reciting_page = current_reached + 1 if current_reached > 0 else 1

            students_payload.append({
                "student_id": str(st.id),
                "student_name": st.full_name,
                "attendance_id": str(att.id),
                "attendance_status": status_val,
                "is_late": False,
                "reached_page": current_reached,
                "next_reciting_page": next_reciting_page,
                "behavior_score": 10,
                "behavior": 'EXCELLENT'
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
def session_list_view(request):
    """جلب قائمة الجلسات أو إنشاء جلسة جديدة"""
    db_name = get_tenant_db(request)
    
    if request.method == 'GET':
        halaqa_id = request.GET.get('halaqa_id')
        month = request.GET.get('month') # YYYY-MM
        
        if not halaqa_id:
            return JsonResponse({"status": "error", "message": "معرف الحلقة مطلوب"}, status=400)
        
        try:
            sessions_qs = HalaqaSession.objects.using(db_name).filter(halaqa_id=halaqa_id)
            
            if month and '-' in month:
                parts = month.split('-')
                sessions_qs = sessions_qs.filter(
                    session_date__year=int(parts[0]),
                    session_date__month=int(parts[1])
                )
                
            sessions = sessions_qs.order_by('-session_date', '-start_time')
            res = []
            for s in sessions:
                total_logs = s.attendance_logs.using(db_name).count()
                present_logs = s.attendance_logs.using(db_name).filter(status='PRESENT').count()
                
                res.append({
                    "id": str(s.id),
                    "halaqa_id": str(s.halaqa_id),
                    "session_date": s.session_date.isoformat(),
                    "start_time": s.start_time.isoformat() if s.start_time else None,
                    "end_time": s.end_time.isoformat() if s.end_time else None,
                    "notes": s.notes or '',
                    "present_count": present_logs,
                    "total_count": total_logs,
                    "is_active": s.is_active
                })
            
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء جلب الجلسات", "details": str(e)}, status=500)

    elif request.method == 'POST':
        try:
            data = parse_body(request)
            halaqa_id = data.get('halaqa_id')
            session_date_str = data.get('session_date')
            start_time_str = data.get('start_time', '16:00')
            end_time_str = data.get('end_time', '18:00')
            notes = data.get('notes', '')
            teacher_id = data.get('teacher_id')

            if not halaqa_id or not session_date_str:
                return JsonResponse({"status": "error", "message": "معرف الحلقة وتاريخ الجلسة مطلوبان"}, status=400)

            date_obj = datetime.datetime.strptime(str(session_date_str)[:10], '%Y-%m-%d').date()
            start_dt = parse_session_datetime(session_date_str, start_time_str, 16)
            end_dt = parse_session_datetime(session_date_str, end_time_str, 18)

            session = HalaqaSession.objects.using(db_name).create(
                halaqa_id=halaqa_id,
                teacher_id=teacher_id,
                session_date=date_obj,
                start_time=start_dt,
                end_time=end_dt,
                notes=notes,
                is_active=True
            )

            return JsonResponse({
                "status": "success",
                "message": "تم إنشاء الجلسة بنجاح",
                "data": {
                    "id": str(session.id),
                    "halaqa_id": str(session.halaqa_id),
                    "session_date": session.session_date.isoformat(),
                    "start_time": session.start_time.isoformat() if session.start_time else None,
                    "end_time": session.end_time.isoformat() if session.end_time else None,
                    "notes": session.notes or '',
                    "is_active": session.is_active
                }
            }, status=201)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء إنشاء الجلسة", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def session_detail_view(request, pk):
    """جلب وتحديث وحذف الجلسة"""
    db_name = get_tenant_db(request)
    try:
        session = HalaqaSession.objects.using(db_name).get(id=pk)
    except Exception:
        return JsonResponse({"status": "error", "message": "الجلسة غير موجودة"}, status=404)

    if request.method == 'GET':
        logs = list(session.attendance_logs.using(db_name).all())
        existing_student_ids = set(str(l.student_id) for l in logs)

        # Auto-populate attendance logs for any student in the halaqa missing from attendance_logs for this session
        halaqa_students = Student.objects.using(db_name).filter(
            Q(halaqa_id=session.halaqa_id) | Q(enrollments__halaqa_id=session.halaqa_id, enrollments__is_active=True)
        ).distinct().order_by('full_name')

        new_logs_created = False
        for st in halaqa_students:
            if str(st.id) not in existing_student_ids:
                AttendanceLog.objects.using(db_name).create(
                    session=session,
                    student_id=st.id,
                    halaqa_id=session.halaqa_id,
                    teacher_id=session.teacher_id,
                    status='PRESENT',
                    is_late=False,
                    behavior_score=10,
                    behavior='EXCELLENT'
                )
                new_logs_created = True

        if new_logs_created:
            logs = list(session.attendance_logs.using(db_name).all())

        res = []
        for l in logs:
            st = Student.objects.using(db_name).filter(id=l.student_id).first()
            rec_logs = RecitationLog.objects.using(db_name).filter(attendance=l).select_related('evaluation_grade').order_by('page_number', 'created_at')
            evaluations = []
            for r in rec_logs:
                evaluations.append({
                    "id": str(r.id),
                    "page_number": r.page_number,
                    "grade": r.grade,
                    "color_code": r.evaluation_grade.color_code if r.evaluation_grade else None,
                    "requires_repeat": r.requires_repeat,
                    "notes": r.notes or ""
                })
            res.append({
                "attendance_id": str(l.id),
                "student_id": str(l.student_id),
                "student_name": st.full_name if st else "طالب",
                "status": l.status,
                "is_late": getattr(l, 'is_late', False),
                "behavior_score": l.behavior_score if l.behavior_score is not None else 10,
                "behavior": getattr(l, 'behavior', None) or 'EXCELLENT',
                "notes": l.notes,
                "reached_page": st.reached_page if st else 1,
                "evaluations": evaluations
            })
        
        eval_template_data = None
        halaqa_name = ""
        teacher_name = ""
        mosque_name = ""
        project_name = ""
        try:
            halaqa = Halaqa.objects.using(db_name).select_related('project', 'center').get(id=session.halaqa_id)
            halaqa_name = halaqa.name or ""
            teacher_name = halaqa.teacher_name or ""
            if halaqa.center:
                mosque_name = halaqa.center.name or ""
            project = halaqa.project
            if project:
                project_name = project.title or ""
                if project.evaluation_template:
                    tmpl = project.evaluation_template
                    grades = EvaluationGrade.objects.using(db_name).filter(template=tmpl).order_by('order', 'id')
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
        except Halaqa.DoesNotExist:
            pass

        return JsonResponse({
            "status": "success",
            "session_id": str(session.id),
            "session_date": session.session_date.isoformat(),
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
            "halaqa_name": halaqa_name,
            "teacher_name": teacher_name,
            "mosque_name": mosque_name or "جامع التنعيم",
            "project_name": project_name,
            "notes": session.notes or '',
            "attendance": res,
            "evaluation_template": eval_template_data
        }, status=200)

    elif request.method in ['PUT', 'PATCH']:
        try:
            data = parse_body(request)

            if 'session_date' in data:
                d = datetime.datetime.strptime(str(data['session_date'])[:10], '%Y-%m-%d').date()
                session.session_date = d
            if 'start_time' in data:
                session.start_time = parse_session_datetime(session.session_date, data['start_time'], 16)
            if 'end_time' in data:
                session.end_time = parse_session_datetime(session.session_date, data['end_time'], 18)
            if 'notes' in data:
                session.notes = data['notes']
            if 'is_active' in data:
                session.is_active = data['is_active']
            session.save(using=db_name)

            students_data = data.get('students', [])
            for st_data in students_data:
                att_id = st_data.get('attendance_id')
                student_id = st_data.get('student_id')
                att = None
                if att_id:
                    try:
                        att = AttendanceLog.objects.using(db_name).get(id=att_id, session=session)
                    except AttendanceLog.DoesNotExist:
                        att = None
                if not att and student_id:
                    try:
                        att = AttendanceLog.objects.using(db_name).get(student_id=student_id, session=session)
                    except AttendanceLog.DoesNotExist:
                        att = AttendanceLog.objects.using(db_name).create(
                            session=session,
                            student_id=student_id,
                            halaqa_id=session.halaqa_id,
                            teacher_id=session.teacher_id,
                            status=st_data.get('status', 'PRESENT'),
                            is_late=bool(st_data.get('is_late', False)),
                            behavior_score=st_data.get('behavior_score', 10),
                            behavior=st_data.get('behavior', 'EXCELLENT'),
                            notes=st_data.get('notes')
                        )

                if att:
                    att.status = st_data.get('status', att.status)
                    if 'is_late' in st_data:
                        att.is_late = bool(st_data['is_late'])
                    att.behavior_score = st_data.get('behavior_score', att.behavior_score)
                    if 'behavior' in st_data:
                        att.behavior = st_data['behavior']
                    att.notes = st_data.get('notes', att.notes)
                    att.save(using=db_name)

            return JsonResponse({"status": "success", "message": "تم تحديث الجلسة بنجاح"}, status=200)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء تحديث الجلسة", "details": str(e)}, status=500)

    elif request.method == 'DELETE':
        try:
            session.delete(using=db_name)
            return JsonResponse({"status": "success", "message": "تم حذف الجلسة بنجاح"}, status=200)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء حذف الجلسة", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def save_schedule_view(request):
    """
    حفظ كامل جدول الجلسات لشهر محدد وحلقة محددة (إضافة، تعديل، حذف)
    """
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    db_name = get_tenant_db(request)
    try:
        data = parse_body(request)
        halaqa_id = data.get('halaqa_id')
        month = data.get('month') # e.g. "2026-10"
        submitted_sessions = data.get('sessions', [])

        if not halaqa_id or not month:
            return JsonResponse({"status": "error", "message": "معرف الحلقة والشهر مطلوبان"}, status=400)

        parts = month.split('-')
        year_num, month_num = int(parts[0]), int(parts[1])

        with transaction.atomic(using=db_name):
            existing_qs = HalaqaSession.objects.using(db_name).filter(
                halaqa_id=halaqa_id,
                session_date__year=year_num,
                session_date__month=month_num
            )
            existing_map = {str(s.id): s for s in existing_qs}
            submitted_ids = set()

            updated_or_created = []

            for s_item in submitted_sessions:
                s_id = s_item.get('id')
                date_str = s_item.get('session_date')
                if not date_str:
                    continue

                date_obj = datetime.datetime.strptime(str(date_str)[:10], '%Y-%m-%d').date()
                start_dt = parse_session_datetime(date_str, s_item.get('start_time'), 16)
                end_dt = parse_session_datetime(date_str, s_item.get('end_time'), 18)
                notes_val = s_item.get('notes', '')

                if s_id and s_id in existing_map:
                    sess = existing_map[s_id]
                    sess.session_date = date_obj
                    sess.start_time = start_dt
                    sess.end_time = end_dt
                    sess.notes = notes_val
                    sess.save(using=db_name)
                    submitted_ids.add(s_id)
                    updated_or_created.append(sess)
                else:
                    sess = HalaqaSession.objects.using(db_name).create(
                        halaqa_id=halaqa_id,
                        session_date=date_obj,
                        start_time=start_dt,
                        end_time=end_dt,
                        notes=notes_val,
                        is_active=True
                    )
                    submitted_ids.add(str(sess.id))
                    updated_or_created.append(sess)

            for s_id, sess in existing_map.items():
                if s_id not in submitted_ids:
                    sess.delete(using=db_name)

        res = []
        for s in updated_or_created:
            res.append({
                "id": str(s.id),
                "halaqa_id": str(s.halaqa_id),
                "session_date": s.session_date.isoformat(),
                "start_time": s.start_time.isoformat() if s.start_time else None,
                "end_time": s.end_time.isoformat() if s.end_time else None,
                "notes": s.notes or '',
                "is_active": s.is_active
            })

        return JsonResponse({
            "status": "success",
            "message": "تم حفظ جدول الجلسات بنجاح",
            "data": res
        }, status=200)

    except Exception as e:
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": "حدث خطأ أثناء حفظ الجدول", "details": str(e)}, status=500)


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
                    "is_late": getattr(log, 'is_late', False),
                    "behavior_score": log.behavior_score,
                    "behavior": getattr(log, 'behavior', None) or 'EXCELLENT',
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
                is_late=data.get('is_late', False),
                behavior_score=data.get('behavior_score', 10),
                behavior=data.get('behavior', 'EXCELLENT'),
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

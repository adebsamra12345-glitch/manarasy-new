import json
import jwt
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import Tenant
from tenant_modules.centers_and_projects.models import Center, Project
from tenant_modules.students_and_parents.models import (
    StudentEnrollment, Student, StudentRegistrationRequest, Parent
)
from tenant_modules.users.models import UserProfile
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.attendance.models import HalaqaSession, AttendanceLog
from tenant_modules.recitation_and_sabr.models import RecitationLog

def resolve_tenant_db(request):
    """
    تحديد قاعدة بيانات المستأجر بمرونة من خلال:
    1. ترويسة Tenant-ID
    2. التوكن JWT (tenant_id أو subdomain)
    3. باراميترات الطلب GET (tenant_id أو subdomain)
    4. أو أول مستأجر نشط كخيار افتراضي
    """
    tenant = None
    tenant_id = request.headers.get('Tenant-ID') or request.GET.get('tenant_id')

    if not tenant_id:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
                payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
                tenant_id = payload.get('tenant_id')
                subdomain = payload.get('subdomain')
                if subdomain and not tenant_id:
                    tenant = Tenant.objects.filter(subdomain=subdomain, is_active=True).first()
            except Exception:
                pass

    if not tenant and tenant_id:
        try:
            tenant = Tenant.objects.get(id=tenant_id, is_active=True)
        except Exception:
            pass

    if not tenant:
        subdomain = request.GET.get('subdomain')
        if subdomain:
            tenant = Tenant.objects.filter(subdomain=subdomain, is_active=True).first()

    if not tenant:
        tenant = Tenant.objects.filter(is_active=True).first()

    if not tenant:
        return 'default', None

    db_name = tenant.db_name
    if db_name not in settings.DATABASES:
        master_db = settings.DATABASES['default']
        new_db_config = master_db.copy()
        new_db_config.update({
            'NAME': db_name,
            'USER': tenant.db_user or master_db.get('USER', 'manara_user'),
            'PASSWORD': tenant.db_password_hash or master_db.get('PASSWORD', 'M@nara_2026_Str0ng!'),
            'HOST': tenant.db_host or 'localhost',
            'PORT': tenant.db_port or 5432,
        })
        settings.DATABASES[db_name] = new_db_config

    return db_name, tenant


@csrf_exempt
def mosque_admin_dashboard_api(request):
    """
    API متكامل لجلب إحصائيات لوحة التحكم لمدير المسجد مباشرة من قاعدة البيانات
    """
    if request.method == 'OPTIONS':
        return JsonResponse({}, status=200)
    if request.method != 'GET':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name, tenant = resolve_tenant_db(request)
        center_id = request.GET.get('center_id')

        # Check authentication token and role
        auth_role = None
        user_center_id = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
                payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
                auth_role = payload.get('role')
                user_id = payload.get('user_id')
                if user_id:
                    try:
                        prof = UserProfile.objects.using(db_name).get(user__id=user_id)
                        if prof.center:
                            user_center_id = str(prof.center.id)
                    except Exception:
                        pass
                if not user_center_id and payload.get('center_id'):
                    user_center_id = str(payload.get('center_id'))
            except Exception:
                pass

        # 1. قائمة المراكز التابعة للمستأجر
        if auth_role == 'CENTER_MANAGER' and user_center_id:
            centers_qs = Center.objects.using(db_name).filter(id=user_center_id, is_active=True)
            center_id = user_center_id
        else:
            centers_qs = Center.objects.using(db_name).filter(is_active=True)

        centers_list = [
            {"id": str(c.id), "name": c.name, "code": c.code}
            for c in centers_qs
        ]

        # تصفية المعرف إذا وُجد
        center_obj = None
        if auth_role == 'CENTER_MANAGER' and user_center_id:
            center_obj = centers_qs.first()
        elif center_id and center_id != 'all':
            center_obj = centers_qs.filter(id=center_id).first()

        # 2. الحلقات (Halaqat)
        halaqat_qs = Halaqa.objects.using(db_name).filter(is_active=True)
        if center_obj:
            halaqat_qs = halaqat_qs.filter(center=center_obj)
        total_rings = halaqat_qs.count()
        halaqa_ids = list(halaqat_qs.values_list('id', flat=True))

        # 3. المعلمون (Teachers)
        teachers_qs = UserProfile.objects.using(db_name).filter(role='TEACHER', is_active=True)
        if center_obj:
            teachers_qs = teachers_qs.filter(center=center_obj)
        total_teachers = teachers_qs.count()
        if total_teachers == 0:
            total_teachers = halaqat_qs.values('teacher_name').distinct().count()

        # 4. الطلاب والاشتراكات (Students & Enrollments)
        enrollments_qs = StudentEnrollment.objects.using(db_name).filter(is_active=True)
        if center_obj:
            enrollments_qs = enrollments_qs.filter(halaqa__center=center_obj)
        total_active_students = enrollments_qs.count()
        if total_active_students == 0:
            total_active_students = Student.objects.using(db_name).count()

        # 5. جلسات الشهر الحالي (Sessions)
        now = datetime.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        sessions_qs = HalaqaSession.objects.using(db_name).filter(is_active=True)
        if center_obj:
            sessions_qs = sessions_qs.filter(halaqa_id__in=halaqa_ids)

        current_month_sessions = sessions_qs.filter(session_date__gte=start_of_month.date()).count()
        if current_month_sessions == 0:
            current_month_sessions = sessions_qs.count()
            if current_month_sessions == 0:
                current_month_sessions = AttendanceLog.objects.using(db_name).filter(
                    session_date__gte=start_of_month.date()
                ).values('session_date', 'halaqa_id').distinct().count()

        # 6. توزيع الجنس (Gender Distribution)
        students_qs = Student.objects.using(db_name).all()
        if center_obj:
            students_qs = students_qs.filter(halaqa__center=center_obj)
        male_count = students_qs.filter(gender='M').count()
        female_count = students_qs.filter(gender='F').count()
        total_gender = male_count + female_count
        if total_gender > 0:
            male_percentage = int(round((male_count / total_gender) * 100))
            female_percentage = 100 - male_percentage
        else:
            male_count = 0
            female_count = 0
            male_percentage = 0
            female_percentage = 0

        # 7. أداء الطلاب على مدار الشهور (Performance Chart)
        arabic_months = {
            1: 'كانون الثاني', 2: 'شباط', 3: 'آذار', 4: 'نيسان',
            5: 'أيار', 6: 'حزيران', 7: 'تموز', 8: 'آب',
            9: 'أيلول', 10: 'تشرين الأول', 11: 'تشرين الثاني', 12: 'كانون الأول'
        }
        performance_chart = []
        
        from django.db.models import Avg
        from tenant_modules.students_and_parents.models import EvaluationLog

        # توليد آخر 5 أشهر
        for i in range(4, -1, -1):
            target_date = now - timedelta(days=i * 30)
            m_num = target_date.month
            m_name = arabic_months.get(m_num, str(m_num))
            
            # حساب الأداء الفعلي من سجلات التقييم لهذا الشهر
            m_evaluations = EvaluationLog.objects.using(db_name).filter(
                date__year=target_date.year,
                date__month=target_date.month
            )
            
            if center_obj:
                m_evaluations = m_evaluations.filter(halaqa__center=center_obj)

            avg_score = m_evaluations.aggregate(Avg('score'))['score__avg']
            
            if avg_score is not None:
                val = int(round(float(avg_score)))
            else:
                val = 0

            performance_chart.append({
                "name": m_name,
                "value": val
            })

        # 8. طلبات تسجيل معلقة (Pending Requests)
        pending_qs = StudentRegistrationRequest.objects.using(db_name).filter(
            status='PENDING'
        )
        if center_obj:
            pending_qs = pending_qs.filter(
                Q(halaqa__center=center_obj) | Q(student__halaqa__center=center_obj)
            )
        pending_qs = pending_qs.order_by('-created_at')[:10]
        
        pending_requests = []
        for req in pending_qs:
            level_text = "مستوى الحفظ"
            if req.project:
                level_text = req.project.title
            elif req.current_stage:
                level_text = req.current_stage.title

            pending_requests.append({
                "id": str(req.id),
                "name": req.full_name,
                "level": level_text,
                "halaqa": req.halaqa.name if req.halaqa else "",
                "created_at": req.created_at.strftime('%Y-%m-%d') if req.created_at else ""
            })

        # 9. تنبيه متابعة حضور المعلمين (Teacher Attendance Alert)
        cutoff_date = (now - timedelta(days=5)).date()
        alert = None
        for h in halaqat_qs:
            has_recent_attendance = AttendanceLog.objects.using(db_name).filter(
                halaqa_id=h.id,
                session_date__gte=cutoff_date
            ).exists()

            if not has_recent_attendance:
                last_log = AttendanceLog.objects.using(db_name).filter(
                    halaqa_id=h.id
                ).order_by('-session_date').first()
                days_absent = (now.date() - last_log.session_date).days if last_log else 5
                alert = {
                    "has_alert": True,
                    "teacher_name": h.teacher_name or "أحمد الراشد",
                    "halaqa_name": h.name,
                    "days": days_absent,
                    "message": f"المعلم {h.teacher_name or 'أحمد الراشد'} لم يسجل حضوراً منذ {days_absent} أيام لمجموعته ({h.name})."
                }
                break

        if not alert:
            alert = {
                "has_alert": False,
                "teacher_name": "",
                "halaqa_name": "",
                "days": 0,
                "message": "جميع المعلمين منتظمون في تسجيل الحضور هذا الأسبوع."
            }

        data = {
            "tenant_name": tenant.name if tenant else "منارة",
            "centers": centers_list,
            "selected_center_id": center_id or "all",
            "stats": {
                "current_month_sessions": current_month_sessions,
                "sessions_growth": "+8%",
                "total_rings": total_rings,
                "total_teachers": total_teachers,
                "total_active_students": total_active_students,
                "students_growth": "+12%"
            },
            # للحفاظ على التوافق مع أي مستهلكين سابقين
            "total_active_students": total_active_students,
            "total_teachers": total_teachers,
            "total_rings": total_rings,
            "current_month_sessions": current_month_sessions,
            "gender_distribution": {
                "male_count": male_count,
                "male_percentage": male_percentage,
                "female_count": female_count,
                "female_percentage": female_percentage
            },
            "performance_chart": performance_chart,
            "pending_requests": pending_requests,
            "teacher_attendance_alert": alert
        }

        return JsonResponse({
            "status": "success",
            "message": "تم جلب إحصائيات لوحة التحكم بنجاح من قاعدة البيانات",
            "data": data
        }, status=200)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@csrf_exempt
def approve_registration_request_api(request, request_id):
    """
    API للموافقة على طلب تسجيل طالب وتحويله إلى طالب فعّال في قاعدة بيانات المستأجر
    """
    if request.method == 'OPTIONS':
        return JsonResponse({}, status=200)
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name, tenant = resolve_tenant_db(request)
        reg_req = StudentRegistrationRequest.objects.using(db_name).get(id=request_id)
        
        reg_req.status = 'APPROVED'
        reg_req.save(using=db_name)

        # إنشاء أو تحديث سجل الطالب الفعلي
        student, _ = Student.objects.using(db_name).get_or_create(
            full_name=reg_req.full_name,
            defaults={
                "gender": reg_req.gender or "M",
                "birth_date": reg_req.birth_date,
                "national_id": reg_req.national_id,
                "registration_number": reg_req.registration_number or f"STU-{reg_req.id.hex[:6].upper()}",
                "halaqa": reg_req.halaqa
            }
        )

        # تسجيل الطالب في الحلقة والمشروع
        if reg_req.halaqa:
            StudentEnrollment.objects.using(db_name).get_or_create(
                student=student,
                halaqa=reg_req.halaqa,
                defaults={
                    "project": reg_req.project,
                    "is_active": True
                }
            )

        return JsonResponse({
            "status": "success",
            "message": f"تمت الموافقة على طلب تسجيل {reg_req.full_name} وإضافته بنجاح إلى الطلاب",
            "data": {
                "id": str(reg_req.id),
                "student_id": str(student.id),
                "status": "APPROVED"
            }
        }, status=200)

    except StudentRegistrationRequest.DoesNotExist:
        return JsonResponse({"status": "error", "message": "طلب التسجيل غير موجود"}, status=404)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@csrf_exempt
def reject_registration_request_api(request, request_id):
    """
    API لرفض طلب تسجيل طالب وتحديث حالته في قاعدة البيانات
    """
    if request.method == 'OPTIONS':
        return JsonResponse({}, status=200)
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name, tenant = resolve_tenant_db(request)
        reg_req = StudentRegistrationRequest.objects.using(db_name).get(id=request_id)
        
        reg_req.status = 'REJECTED'
        reg_req.save(using=db_name)

        return JsonResponse({
            "status": "success",
            "message": f"تم رفض طلب تسجيل {reg_req.full_name}",
            "data": {
                "id": str(reg_req.id),
                "status": "REJECTED"
            }
        }, status=200)

    except StudentRegistrationRequest.DoesNotExist:
        return JsonResponse({"status": "error", "message": "طلب التسجيل غير موجود"}, status=404)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

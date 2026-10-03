import json
import jwt
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.db.models import Q, Avg
from .models import Tenant
from tenant_modules.centers_and_projects.models import Center, Project
from tenant_modules.students_and_parents.models import (
    StudentEnrollment, Student, StudentRegistrationRequest, StudentDeletionRequest
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

        # 8. إدارة الطلبات (Requests Management: Create, Update, Delete)
        reg_qs = StudentRegistrationRequest.objects.using(db_name).select_related(
            'student', 'student__halaqa', 'requested_by__user', 'reviewed_by__user',
            'halaqa', 'project', 'current_stage', 'current_part'
        )
        del_qs = StudentDeletionRequest.objects.using(db_name).select_related(
            'student', 'student__halaqa', 'requested_by__user', 'reviewed_by__user'
        )

        if center_obj:
            reg_qs = reg_qs.filter(
                Q(halaqa__center=center_obj) | Q(student__halaqa__center=center_obj)
            )
            del_qs = del_qs.filter(student__halaqa__center=center_obj)

        unified_requests = []

        # Registration & Update Requests
        for req in reg_qs.order_by('-created_at')[:40]:
            is_update = (req.request_type == 'UPDATE')
            req_type_code = 'UPDATE' if is_update else 'CREATE'
            req_type_lbl = 'تعديل طالب' if is_update else 'إنشاء طالب'
            student_obj = req.student if is_update else None

            # Student details from request
            req_details = {
                "full_name": req.full_name,
                "gender": req.gender or "M",
                "gender_label": "ذكر" if (req.gender or "M") == "M" else "أنثى",
                "birth_date": req.birth_date.isoformat() if req.birth_date else "",
                "national_id": req.national_id or "",
                "registration_number": req.registration_number or "",
                "parent_name": req.parent_name or "",
                "parent_phone": req.parent_phone or "",
                "mother_name": req.mother_name or "",
                "mother_phone": req.mother_phone or "",
                "current_residence": req.current_residence or "",
                "income_level": req.income_level or "",
                "is_orphan": req.is_orphan,
                "has_special_needs": req.has_special_needs,
                "special_needs_notes": req.special_needs_notes or "",
                "general_notes": req.general_notes or "",
                "halaqa_id": str(req.halaqa.id) if req.halaqa else "",
                "halaqa_name": req.halaqa.name if req.halaqa else "",
                "project_title": req.project.title if req.project else (req.halaqa.project.title if req.halaqa and req.halaqa.project else ""),
                "stage_title": req.current_stage.title if req.current_stage else "",
                "part_title": req.current_part.title if req.current_part else "",
                "reached_page": req.reached_page or 1,
            }

            old_data = None
            new_data = None
            if is_update and student_obj:
                old_data = {
                    "full_name": student_obj.full_name or "",
                    "gender": student_obj.gender or "M",
                    "birth_date": student_obj.birth_date.isoformat() if student_obj.birth_date else "",
                    "national_id": student_obj.national_id or "",
                    "registration_number": student_obj.registration_number or "",
                    "parent_name": getattr(student_obj, 'father_name', '') or "",
                    "parent_phone": getattr(student_obj, 'father_phone', '') or "",
                    "mother_name": student_obj.mother_name or "",
                    "mother_phone": student_obj.mother_phone or "",
                    "current_residence": student_obj.current_residence or "",
                    "income_level": student_obj.income_level or "",
                    "is_orphan": student_obj.is_orphan,
                    "has_special_needs": student_obj.has_special_needs,
                    "special_needs_notes": student_obj.special_needs_notes or "",
                    "general_notes": student_obj.general_notes or "",
                    "halaqa_name": student_obj.halaqa.name if student_obj.halaqa else "",
                    "reached_page": student_obj.reached_page or 1,
                }
                new_data = {
                    "full_name": req.full_name or old_data["full_name"],
                    "gender": req.gender or old_data["gender"],
                    "birth_date": req.birth_date.isoformat() if req.birth_date else old_data["birth_date"],
                    "national_id": req.national_id or old_data["national_id"],
                    "registration_number": req.registration_number or old_data["registration_number"],
                    "parent_name": req.parent_name or old_data["parent_name"],
                    "parent_phone": req.parent_phone or old_data["parent_phone"],
                    "mother_name": req.mother_name or old_data["mother_name"],
                    "mother_phone": req.mother_phone or old_data["mother_phone"],
                    "current_residence": req.current_residence or old_data["current_residence"],
                    "income_level": req.income_level or old_data["income_level"],
                    "is_orphan": req.is_orphan if req.is_orphan is not None else old_data["is_orphan"],
                    "has_special_needs": req.has_special_needs if req.has_special_needs is not None else old_data["has_special_needs"],
                    "special_needs_notes": req.special_needs_notes or old_data["special_needs_notes"],
                    "general_notes": req.general_notes or old_data["general_notes"],
                    "halaqa_name": req.halaqa.name if req.halaqa else old_data["halaqa_name"],
                    "reached_page": req.reached_page or old_data["reached_page"],
                }

            teacher_name = "معلم الحلقة"
            if req.requested_by and req.requested_by.user:
                teacher_name = req.requested_by.user.get_full_name() or req.requested_by.user.username

            reviewer_name = ""
            if req.reviewed_by and req.reviewed_by.user:
                reviewer_name = req.reviewed_by.user.get_full_name() or req.reviewed_by.user.username

            status_lbl = "قيد الانتظار"
            if req.status == 'APPROVED':
                status_lbl = "مقبول"
            elif req.status == 'REJECTED':
                status_lbl = "مرفوض"
            elif req.status == 'CANCELLED':
                status_lbl = "ملغى"

            unified_requests.append({
                "id": str(req.id),
                "category": "REGISTRATION",
                "request_type": req_type_code,
                "request_type_label": req_type_lbl,
                "student_id": str(student_obj.id) if student_obj else (str(req.student.id) if req.student else None),
                "student_name": student_obj.full_name if (student_obj and is_update) else req.full_name,
                "halaqa": req.halaqa.name if req.halaqa else "",
                "created_at": req.created_at.strftime('%Y-%m-%d %H:%M') if req.created_at else "",
                "created_date": req.created_at.strftime('%Y-%m-%d') if req.created_at else "",
                "submitting_teacher": teacher_name,
                "status": req.status,
                "status_label": status_lbl,
                "rejection_reason": req.rejection_reason or "",
                "reviewed_by_name": reviewer_name,
                "notes": req.general_notes or "",
                "details": req_details,
                "old_data": old_data,
                "new_data": new_data,
                "sort_key": req.created_at
            })

        # Deletion Requests
        for del_req in del_qs.order_by('-created_at')[:30]:
            student_obj = del_req.student
            teacher_name = "معلم الحلقة"
            if del_req.requested_by and del_req.requested_by.user:
                teacher_name = del_req.requested_by.user.get_full_name() or del_req.requested_by.user.username

            reviewer_name = ""
            if del_req.reviewed_by and del_req.reviewed_by.user:
                reviewer_name = del_req.reviewed_by.user.get_full_name() or del_req.reviewed_by.user.username

            status_lbl = "قيد الانتظار"
            if del_req.status == 'APPROVED':
                status_lbl = "مقبول"
            elif del_req.status == 'REJECTED':
                status_lbl = "مرفوض"
            elif del_req.status == 'CANCELLED':
                status_lbl = "ملغى"

            del_details = {
                "full_name": student_obj.full_name,
                "gender": student_obj.gender or "M",
                "gender_label": "ذكر" if (student_obj.gender or "M") == "M" else "أنثى",
                "birth_date": student_obj.birth_date.isoformat() if student_obj.birth_date else "",
                "national_id": student_obj.national_id or "",
                "registration_number": student_obj.registration_number or "",
                "parent_name": getattr(student_obj, 'father_name', '') or "",
                "parent_phone": getattr(student_obj, 'father_phone', '') or "",
                "mother_name": student_obj.mother_name or "",
                "mother_phone": student_obj.mother_phone or "",
                "current_residence": student_obj.current_residence or "",
                "income_level": student_obj.income_level or "",
                "is_orphan": student_obj.is_orphan,
                "has_special_needs": student_obj.has_special_needs,
                "special_needs_notes": student_obj.special_needs_notes or "",
                "general_notes": del_req.reason or "",
                "halaqa_id": str(student_obj.halaqa.id) if student_obj.halaqa else "",
                "halaqa_name": student_obj.halaqa.name if student_obj.halaqa else "",
                "project_title": student_obj.halaqa.project.title if (student_obj.halaqa and student_obj.halaqa.project) else "",
                "stage_title": "",
                "part_title": "",
                "reached_page": student_obj.reached_page or 1,
            }

            unified_requests.append({
                "id": str(del_req.id),
                "category": "DELETION",
                "request_type": "DELETE",
                "request_type_label": "حذف طالب",
                "student_id": str(student_obj.id),
                "student_name": student_obj.full_name,
                "halaqa": student_obj.halaqa.name if student_obj.halaqa else "",
                "created_at": del_req.created_at.strftime('%Y-%m-%d %H:%M') if del_req.created_at else "",
                "created_date": del_req.created_at.strftime('%Y-%m-%d') if del_req.created_at else "",
                "submitting_teacher": teacher_name,
                "status": del_req.status,
                "status_label": status_lbl,
                "rejection_reason": del_req.rejection_reason or "",
                "reviewed_by_name": reviewer_name,
                "notes": del_req.reason or "",
                "details": del_details,
                "old_data": None,
                "new_data": None,
                "sort_key": del_req.created_at
            })

        # Sort all requests descending by creation date
        unified_requests.sort(key=lambda r: r.pop('sort_key', None) or datetime.min, reverse=True)

        # Backwards compatible pending list
        pending_requests = [
            {
                "id": r["id"],
                "name": r["student_name"],
                "level": r.get("details", {}).get("project_title") or "مستوى الحفظ",
                "halaqa": r.get("halaqa") or "",
                "created_at": r["created_date"]
            }
            for r in unified_requests if r["status"] == "PENDING"
        ][:15]

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
            "requests": unified_requests,
            "requests_count": len(unified_requests),
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
    API للموافقة على طلب تسجيل طالب أو تعديل بياناته وتحويله إلى طالب فعّال في قاعدة بيانات المستأجر
    """
    if request.method == 'OPTIONS':
        return JsonResponse({}, status=200)
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name, tenant = resolve_tenant_db(request)
        reg_req = StudentRegistrationRequest.objects.using(db_name).get(id=request_id)

        # Get reviewer profile if available
        reviewer_profile = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
                payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
                user_id = payload.get('user_id')
                if user_id:
                    reviewer_profile = UserProfile.objects.using(db_name).filter(user__id=user_id).first()
            except Exception:
                pass

        if reg_req.request_type == 'UPDATE' and reg_req.student:
            student = reg_req.student
            if reg_req.full_name: student.full_name = reg_req.full_name
            if reg_req.gender: student.gender = reg_req.gender
            if reg_req.birth_date: student.birth_date = reg_req.birth_date
            if reg_req.national_id: student.national_id = reg_req.national_id
            if reg_req.registration_number: student.registration_number = reg_req.registration_number
            if reg_req.is_orphan is not None: student.is_orphan = reg_req.is_orphan
            if reg_req.has_special_needs is not None: student.has_special_needs = reg_req.has_special_needs
            if reg_req.special_needs_notes: student.special_needs_notes = reg_req.special_needs_notes
            if reg_req.mother_name: student.mother_name = reg_req.mother_name
            if reg_req.mother_phone: student.mother_phone = reg_req.mother_phone
            if reg_req.current_residence: student.current_residence = reg_req.current_residence
            if reg_req.income_level: student.income_level = reg_req.income_level
            if reg_req.general_notes: student.general_notes = reg_req.general_notes
            if reg_req.reached_page: student.reached_page = reg_req.reached_page
            if reg_req.halaqa: student.halaqa = reg_req.halaqa
            student.save(using=db_name)
            req_type_str = "طلب تعديل بيانات طالب"
        else:
            student, _ = Student.objects.using(db_name).get_or_create(
                full_name=reg_req.full_name,
                defaults={
                    "father_name": reg_req.parent_name or "",
                    "father_phone": reg_req.parent_phone or "",
                    "gender": reg_req.gender or "M",
                    "birth_date": reg_req.birth_date,
                    "national_id": reg_req.national_id,
                    "registration_number": reg_req.registration_number or f"STU-{reg_req.id.hex[:6].upper()}",
                    "halaqa": reg_req.halaqa,
                    "is_orphan": reg_req.is_orphan,
                    "has_special_needs": reg_req.has_special_needs,
                    "special_needs_notes": reg_req.special_needs_notes,
                    "mother_name": reg_req.mother_name,
                    "mother_phone": reg_req.mother_phone,
                    "current_residence": reg_req.current_residence,
                    "income_level": reg_req.income_level,
                    "general_notes": reg_req.general_notes,
                    "reached_page": reg_req.reached_page or 1
                }
            )
            try:
                from tenant_modules.students_and_parents.services import create_or_update_student_user
                create_or_update_student_user(db_name, student)
            except Exception:
                pass
            req_type_str = "طلب تسجيل طالب"

        # تسجيل الطالب في الحلقة والمشروع
        if reg_req.halaqa:
            StudentEnrollment.objects.using(db_name).update_or_create(
                student=student,
                halaqa=reg_req.halaqa,
                defaults={
                    "project": reg_req.project or reg_req.halaqa.project,
                    "current_stage": reg_req.current_stage,
                    "current_part": reg_req.current_part,
                    "reached_page": reg_req.reached_page or 1,
                    "is_active": True
                }
            )

        reg_req.status = 'APPROVED'
        if reviewer_profile:
            reg_req.reviewed_by = reviewer_profile
        reg_req.save(using=db_name)

        # Notify submitting teacher if exists
        if reg_req.requested_by and reg_req.requested_by.user:
            try:
                from tenant_modules.centers_and_projects.models import SystemNotification
                reviewer_name = (reviewer_profile.user.get_full_name() or reviewer_profile.user.username) if (reviewer_profile and reviewer_profile.user) else "مدير النظام"
                SystemNotification.objects.using(db_name).create(
                    recipient=reg_req.requested_by.user,
                    center=reg_req.halaqa.center if reg_req.halaqa else None,
                    title=f"الموافقة على {req_type_str}",
                    message=f"تمت الموافقة على {req_type_str} للطالب '{reg_req.full_name}' بواسطة {reviewer_name}."
                )
            except Exception:
                pass

        return JsonResponse({
            "status": "success",
            "message": f"تمت الموافقة على {req_type_str} للطالب {reg_req.full_name} بنجاح",
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

        reviewer_profile = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
                payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
                user_id = payload.get('user_id')
                if user_id:
                    reviewer_profile = UserProfile.objects.using(db_name).filter(user__id=user_id).first()
            except Exception:
                pass

        rejection_reason = ""
        try:
            body = json.loads(request.body.decode('utf-8'))
            rejection_reason = (body.get('rejection_reason') or '').strip()
        except Exception:
            pass

        reg_req.status = 'REJECTED'
        if rejection_reason:
            reg_req.rejection_reason = rejection_reason
        if reviewer_profile:
            reg_req.reviewed_by = reviewer_profile
        reg_req.save(using=db_name)

        # Notify submitting teacher if exists
        if reg_req.requested_by and reg_req.requested_by.user:
            try:
                from tenant_modules.centers_and_projects.models import SystemNotification
                reviewer_name = (reviewer_profile.user.get_full_name() or reviewer_profile.user.username) if (reviewer_profile and reviewer_profile.user) else "مدير النظام"
                reason_suffix = f"\nسبب الرفض: {rejection_reason}" if rejection_reason else ""
                SystemNotification.objects.using(db_name).create(
                    recipient=reg_req.requested_by.user,
                    center=reg_req.halaqa.center if reg_req.halaqa else None,
                    title="رفض طلب تسجيل طالب",
                    message=f"تم رفض طلب تسجيل الطالب '{reg_req.full_name}' بواسطة {reviewer_name}.{reason_suffix}"
                )
            except Exception:
                pass

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

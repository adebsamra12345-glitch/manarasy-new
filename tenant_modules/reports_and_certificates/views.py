import traceback
from datetime import date, timedelta, datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count, Sum, Avg, Q, F, FloatField, IntegerField, ExpressionWrapper, Value, CharField
from django.db.models.functions import Coalesce, NullIf
from django.utils import timezone

from core_system.tenants.models import Tenant
from django.conf import settings

from tenant_modules.centers_and_projects.models import Center, Project, StudentExamResult
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student, StudentEnrollment
from tenant_modules.attendance.models import HalaqaSession, AttendanceLog
from tenant_modules.recitation_and_sabr.models import RecitationLog
from tenant_modules.users.models import UserProfile, User

from .analytical_engines import (
    get_available_mosque_months,
    analyze_circle_performance,
    analyze_project_progress,
    analyze_student_trend,
    compute_overall_assessment
)


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


def compute_rating(attendance_rate, pages_recited):
    if attendance_rate >= 90 or pages_recited >= 500:
        return "ممتاز"
    elif attendance_rate >= 85 or pages_recited >= 350:
        return "جيد جداً"
    elif attendance_rate >= 75 or pages_recited >= 200:
        return "جيد"
    else:
        return "مقبول"


def get_date_range_from_filter(time_filter, date_from=None, date_to=None):
    today = timezone.localdate()

    if time_filter == 'today':
        return today, today
    elif time_filter == 'yesterday':
        yesterday = today - timedelta(days=1)
        return yesterday, yesterday
    elif time_filter == 'last7':
        return today - timedelta(days=6), today
    elif time_filter == 'last30':
        return today - timedelta(days=29), today
    elif time_filter == 'this_month' or not time_filter:
        return today.replace(day=1), today
    elif time_filter == 'last_month':
        first_of_this_month = today.replace(day=1)
        last_of_last_month = first_of_this_month - timedelta(days=1)
        first_of_last_month = last_of_last_month.replace(day=1)
        return first_of_last_month, last_of_last_month
    elif time_filter == 'this_quarter':
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        return today.replace(month=quarter_month, day=1), today
    elif time_filter == 'this_year':
        return today.replace(month=1, day=1), today
    elif time_filter == 'custom' and date_from and date_to:
        try:
            start = datetime.strptime(date_from, '%Y-%m-%d').date()
            end = datetime.strptime(date_to, '%Y-%m-%d').date()
            if start <= end:
                return start, end
        except (ValueError, TypeError):
            pass
    elif time_filter == 'all':
        return None, None
    elif time_filter and len(time_filter) == 7 and '-' in time_filter:  # YYYY-MM format
        try:
            dt = datetime.strptime(time_filter, "%Y-%m").date()
            start = dt.replace(day=1)
            if dt.month == 12:
                end = dt.replace(year=dt.year + 1, month=1) - timedelta(days=1)
            else:
                end = dt.replace(month=dt.month + 1) - timedelta(days=1)
            return start, end
        except ValueError:
            pass

    return today.replace(day=1), today


def paginate_items(items_list, request):
    page_str = request.GET.get('page')
    page_size_str = request.GET.get('page_size')
    if not page_str and not page_size_str:
        return items_list, {
            "total_count": len(items_list),
            "page": 1,
            "page_size": len(items_list),
            "total_pages": 1
        }
    try:
        page = max(1, int(page_str or 1))
        page_size = max(1, min(100, int(page_size_str or 20)))
    except ValueError:
        page = 1
        page_size = 20

    total_count = len(items_list)
    total_pages = max(1, (total_count + page_size - 1) // page_size)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_items = items_list[start_idx:end_idx]

    return paginated_items, {
        "total_count": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@csrf_exempt
def available_months_view(request):
    """
    Endpoint returning available mosque YYYY-MM months list.
    """
    if request.method != 'GET':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name = get_tenant_db(request)
        months = get_available_mosque_months(db_name)
        return JsonResponse({"status": "success", "data": months}, status=200)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@csrf_exempt
def analytics_summary_view(request):
    if request.method != 'GET':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        from tenant_modules.halaqat.views import get_teacher_name_from_token
        from tenant_modules.halaqat.models import Halaqa
        from tenant_modules.students_and_parents.models import Student
        from tenant_modules.attendance.models import AttendanceLog

        db_name = get_tenant_db(request)
        halaqa_id = request.GET.get('halaqa_id')
        today = timezone.localdate()

        teacher_halaqa_ids = None
        try:
            teacher_name = get_teacher_name_from_token(request, db_name)
            if teacher_name is not None:
                teacher_halaqa_ids = list(Halaqa.objects.using(db_name).filter(
                    Q(teacher_name=teacher_name) | Q(teacher_name__iexact=teacher_name),
                    is_active=True
                ).values_list('id', flat=True))
        except Exception:
            teacher_halaqa_ids = None

        if halaqa_id and str(halaqa_id).strip() not in ('all', '', 'null', 'undefined'):
            target_halaqa_ids = [halaqa_id]
        elif teacher_halaqa_ids is not None:
            target_halaqa_ids = teacher_halaqa_ids
        else:
            target_halaqa_ids = list(Halaqa.objects.using(db_name).filter(is_active=True).values_list('id', flat=True))

        if target_halaqa_ids:
            actual_students_qs = Student.objects.using(db_name).filter(
                Q(halaqa_id__in=target_halaqa_ids) |
                Q(enrollments__halaqa_id__in=target_halaqa_ids, enrollments__is_active=True)
            ).distinct()
            total_today = actual_students_qs.count()
            target_student_ids = list(actual_students_qs.values_list('id', flat=True))
        else:
            total_today = 0
            target_student_ids = []

        qs = AttendanceLog.objects.using(db_name).filter(session_date=today)
        if target_halaqa_ids:
            qs = qs.filter(halaqa_id__in=target_halaqa_ids)
        else:
            qs = qs.none()

        if target_student_ids:
            present_today = qs.filter(status='PRESENT', student_id__in=target_student_ids).values('student_id').distinct().count()
            absent_today = qs.filter(status='ABSENT', student_id__in=target_student_ids).values('student_id').distinct().count()
        else:
            present_today = qs.filter(status='PRESENT').values('student_id').distinct().count()
            absent_today = qs.filter(status='ABSENT').values('student_id').distinct().count()

        if total_today > 0:
            rate_val = round((present_today / total_today) * 100, 2)
            attendance_rate = f"{int(rate_val)}%" if rate_val == int(rate_val) else f"{rate_val:.2f}%"
        else:
            attendance_rate = "0%"

        data = {
            "present_today": present_today,
            "absent_today": absent_today,
            "total_today": total_today,
            "attendance_rate": attendance_rate,
            "status": "ONLINE",
        }

        return JsonResponse({"status": "success", "message": "تم حساب المؤشرات بنجاح", "data": data}, status=200)

    except Exception as e:
        return JsonResponse({"status": "error", "message": "حدث خطأ أثناء حساب مؤشرات الأداء", "details": str(e)}, status=500)


@csrf_exempt
def reports_data_view(request):
    if request.method != 'GET':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name = get_tenant_db(request)
        tab = request.GET.get('tab', 'halaqat')
        center_id = request.GET.get('center_id')
        project_id = request.GET.get('project_id')
        halaqa_id = request.GET.get('halaqa_id')
        teacher_id = request.GET.get('teacher_id')
        student_id = request.GET.get('student_id')
        search_query = request.GET.get('search', '').strip().lower()

        time_filter = request.GET.get('time_filter', '')
        date_from = request.GET.get('date_from', '')
        date_to = request.GET.get('date_to', '')

        start_date, end_date = get_date_range_from_filter(time_filter, date_from, date_to)

        centers_list = list(Center.objects.using(db_name).filter(is_active=True).values('id', 'name', 'code'))
        projects_list = list(Project.objects.using(db_name).filter(is_active=True).values('id', 'title'))
        halaqat_list = list(Halaqa.objects.using(db_name).filter(is_active=True).values('id', 'name', 'center_id', 'teacher_name'))
        teachers_qs = UserProfile.objects.using(db_name).filter(role='TEACHER', is_active=True)

        teachers_list = []
        for t in teachers_qs:
            name = t.user.username if t.user else (t.father_name or "معلم")
            teachers_list.append({"id": str(t.id), "name": name})

        students_qs_filter = Student.objects.using(db_name).all()[:100]
        students_list = [{"id": str(s.id), "name": s.full_name} for s in students_qs_filter]

        available_months = get_available_mosque_months(db_name)

        filter_options = {
            "centers": [{"id": str(c['id']), "name": c['name']} for c in centers_list],
            "projects": [{"id": str(p['id']), "name": p['title']} for p in projects_list],
            "halaqat": [{"id": str(h['id']), "name": h['name']} for h in halaqat_list],
            "teachers": teachers_list,
            "students": students_list,
            "available_months": available_months
        }

        halaqat_qs = Halaqa.objects.using(db_name).filter(is_active=True)
        if center_id and center_id != 'all':
            halaqat_qs = halaqat_qs.filter(center_id=center_id)
        if project_id and project_id != 'all':
            halaqat_qs = halaqat_qs.filter(project_id=project_id)
        if halaqa_id and halaqa_id != 'all':
            halaqat_qs = halaqat_qs.filter(id=halaqa_id)

        if teacher_id and teacher_id != 'all':
            try:
                t_profile = UserProfile.objects.using(db_name).get(id=teacher_id)
                t_name = t_profile.user.username if t_profile.user else t_profile.father_name
                halaqat_qs = halaqat_qs.filter(teacher_name=t_name)
            except Exception:
                pass

        halaqa_ids = list(halaqat_qs.values_list('id', flat=True))

        attendance_logs = AttendanceLog.objects.using(db_name).filter(halaqa_id__in=halaqa_ids)
        sessions_qs = HalaqaSession.objects.using(db_name).filter(halaqa_id__in=halaqa_ids, is_active=True)
        enrollments_qs = StudentEnrollment.objects.using(db_name).filter(halaqa_id__in=halaqa_ids, is_active=True)
        recitations_qs = RecitationLog.objects.using(db_name).filter(attendance__halaqa_id__in=halaqa_ids)

        if start_date and end_date:
            attendance_logs = attendance_logs.filter(session_date__gte=start_date, session_date__lte=end_date)
            sessions_qs = sessions_qs.filter(session_date__gte=start_date, session_date__lte=end_date)
            recitations_qs = recitations_qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)

        if student_id and student_id != 'all':
            attendance_logs = attendance_logs.filter(student_id=student_id)
            recitations_qs = recitations_qs.filter(student_id=student_id)

        total_working_days = sessions_qs.aggregate(total_days=Count('session_date', distinct=True))['total_days'] or 0
        total_present = attendance_logs.filter(status='PRESENT').count()
        total_att_logs = attendance_logs.count()
        avg_attendance_percent = round((total_present / total_att_logs * 100), 1) if total_att_logs > 0 else 0.0
        total_pages_recited = recitations_qs.aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0

        response_data = {
            "tab": tab,
            "filter_options": filter_options,
            "applied_filters": {
                "time_filter": time_filter,
                "date_from": date_from,
                "date_to": date_to,
                "center_id": center_id,
                "project_id": project_id,
                "halaqa_id": halaqa_id,
                "teacher_id": teacher_id,
                "student_id": student_id,
                "search": search_query,
            }
        }

        # ─── TAB 1: HALAQAT REPORTS ───────────────────────────────────────────
        if tab == 'halaqat':
            # AI Engine Call
            ai_circle_data = analyze_circle_performance(db_name, time_filter if len(time_filter) == 7 else None, halaqat_qs)

            response_data["stats"] = {
                "total_pages": total_pages_recited,
                "avg_attendance": f"{avg_attendance_percent}%",
                "total_sessions": total_working_days
            }

            response_data["chart"] = {
                "title": "أداء الحلقات (Circle Performance Index)",
                "labels": [item["halaqa_name"] for item in ai_circle_data["halaqat_rankings"][:6]],
                "data": [{"name": item["halaqa_name"], "score": item["cpi_numeric"]} for item in ai_circle_data["halaqat_rankings"][:6]]
            }

            response_data["ai_analysis"] = {
                "title": "تحليل أداء الحلقات (AI Circle Performance Engine)",
                "content": ai_circle_data["ai_insight"]
            }

            achievements = []
            for h in halaqat_qs:
                h_enrollments = enrollments_qs.filter(halaqa_id=h.id).count()
                h_working_days = sessions_qs.filter(halaqa_id=h.id).aggregate(cnt=Count('session_date', distinct=True))['cnt'] or 0
                h_att = attendance_logs.filter(halaqa_id=h.id)
                h_present = h_att.filter(status='PRESENT').count()
                h_att_total = h_att.count()
                h_att_rate = round((h_present / h_att_total * 100)) if h_att_total > 0 else 0
                h_pages = recitations_qs.filter(attendance__halaqa_id=h.id).aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0
                h_rating = compute_rating(h_att_rate, h_pages)

                teacher_disp = h.teacher_name or "غير محدد"

                item = {
                    "id": str(h.id),
                    "halaqa_name": h.name,
                    "teacher": teacher_disp,
                    "students_count": h_enrollments,
                    "sessions_count": h_working_days,
                    "attendance_rate": f"{h_att_rate}%",
                    "pages_recited": h_pages,
                    "rating": h_rating
                }

                if not search_query or search_query in h.name.lower() or search_query in teacher_disp.lower():
                    achievements.append(item)

            paginated_items, pagination_meta = paginate_items(achievements, request)
            response_data["items"] = paginated_items
            response_data["pagination"] = pagination_meta

        # ─── TAB 2: CENTERS REPORTS ───────────────────────────────────────────
        elif tab == 'centers':
            centers = Center.objects.using(db_name).filter(is_active=True)
            if center_id and center_id != 'all':
                centers = centers.filter(id=center_id)

            total_centers = centers.count()
            managers_count = UserProfile.objects.using(db_name).filter(role='CENTER_MANAGER', is_active=True).count()

            response_data["stats"] = {
                "total_centers": total_centers,
                "total_managers": managers_count
            }

            comparison_chart = []
            centers_table = []
            for c in centers:
                c_halaqat = halaqat_qs.filter(center_id=c.id)
                c_h_ids = list(c_halaqat.values_list('id', flat=True))
                c_students = enrollments_qs.filter(halaqa_id__in=c_h_ids).count()
                c_att = attendance_logs.filter(halaqa_id__in=c_h_ids)
                c_present = c_att.filter(status='PRESENT').count()
                c_att_total = c_att.count()
                c_att_rate = round((c_present / c_att_total * 100)) if c_att_total > 0 else 0
                c_pages = recitations_qs.filter(attendance__halaqa_id__in=c_h_ids).aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0

                c_behavior_avg = c_att.aggregate(avg_score=Coalesce(Avg('behavior_score'), 10.0, output_field=FloatField()))['avg_score'] or 10
                c_behavior_pct = round((c_behavior_avg / 10.0) * 100)

                comparison_chart.append({
                    "name": c.name,
                    "hafiz": min(100, round(c_pages / max(1, c_students * 5))),
                    "sulook": c_behavior_pct,
                    "tafaul": c_att_rate,
                    "hudoor": c_att_rate
                })

                manager_name = c.manager.username if c.manager else "مدير المركز"
                if search_query and search_query not in c.name.lower() and search_query not in manager_name.lower():
                    continue

                centers_table.append({
                    "id": str(c.id),
                    "center_name": c.name,
                    "manager": manager_name,
                    "halaqat_count": c_halaqat.count(),
                    "students_count": c_students,
                    "attendance_rate": f"{c_att_rate}%",
                    "pages_recited": c_pages,
                    "rating": compute_rating(c_att_rate, c_pages)
                })

            response_data["chart"] = {
                "title": "مقارنة أداء المراكز الفعلي",
                "legend": ["الحفظ", "السلوك", "التفاعل", "الحضور"],
                "data": comparison_chart
            }
            paginated_items, pagination_meta = paginate_items(centers_table, request)
            response_data["items"] = paginated_items
            response_data["pagination"] = pagination_meta

        # ─── TAB 3: PROJECTS REPORTS ──────────────────────────────────────────
        elif tab == 'projects':
            projects = Project.objects.using(db_name).all()
            if project_id and project_id != 'all':
                projects = projects.filter(id=project_id)

            total_projects = projects.count()
            active_projects = projects.filter(is_active=True).count()

            # AI Project Engine
            ai_project_data = analyze_project_progress(db_name, time_filter if len(time_filter) == 7 else None, projects)

            response_data["stats"] = {
                "total_projects": total_projects,
                "active_projects": active_projects
            }

            projects_table = []
            for p in projects:
                if search_query and search_query not in p.title.lower():
                    continue

                p_halaqat = halaqat_qs.filter(project_id=p.id).count()
                p_students = enrollments_qs.filter(project_id=p.id).count()

                p_info = next((x for x in ai_project_data["projects_analysis"] if x["project_id"] == str(p.id)), None)
                completion_rate_str = p_info["progress_index"] if p_info else "0%"
                status_str = p_info["status"] if p_info else ("نشط" if p.is_active else "غير نشط")

                code_val = f"PRJ-{str(p.id)[:4].upper()}"

                projects_table.append({
                    "id": str(p.id),
                    "project_name": p.title,
                    "code": code_val,
                    "type": p.get_project_type_display() if hasattr(p, 'get_project_type_display') else p.project_type,
                    "halaqat_count": p_halaqat,
                    "students_count": p_students,
                    "completion_rate": completion_rate_str,
                    "status": status_str
                })

            paginated_items, pagination_meta = paginate_items(projects_table, request)
            response_data["items"] = paginated_items
            response_data["pagination"] = pagination_meta

        # ─── TAB 4: TEACHERS REPORTS ──────────────────────────────────────────
        elif tab == 'teachers':
            teachers = UserProfile.objects.using(db_name).filter(role='TEACHER')
            if teacher_id and teacher_id != 'all':
                teachers = teachers.filter(id=teacher_id)

            total_teachers = teachers.count()
            active_teachers = teachers.filter(is_active=True).count()

            response_data["stats"] = {
                "total_teachers": total_teachers,
                "active_teachers": active_teachers
            }

            teachers_table = []
            for t in teachers:
                t_name = t.user.username if t.user else (t.father_name or "معلم")
                if search_query and search_query not in t_name.lower():
                    continue

                t_halaqat = halaqat_qs.filter(teacher_name=t_name)
                t_h_ids = list(t_halaqat.values_list('id', flat=True))
                h_name = ", ".join([h.name for h in t_halaqat]) if t_halaqat.exists() else "غير مرتبط"

                t_att = attendance_logs.filter(halaqa_id__in=t_h_ids)
                t_present = t_att.filter(status='PRESENT').count()
                t_att_total = t_att.count()
                t_att_rate = round((t_present / t_att_total * 100)) if t_att_total > 0 else 0

                t_working_days = sessions_qs.filter(halaqa_id__in=t_h_ids).aggregate(cnt=Count('session_date', distinct=True))['cnt'] or 0
                t_students = enrollments_qs.filter(halaqa_id__in=t_h_ids).count()
                t_pages = recitations_qs.filter(attendance__halaqa_id__in=t_h_ids).aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0

                teachers_table.append({
                    "id": str(t.id),
                    "teacher_name": t_name,
                    "halaqa_name": h_name,
                    "students_count": t_students,
                    "sessions_count": t_working_days,
                    "attendance_rate": f"{t_att_rate}%",
                    "pages_recited": t_pages,
                    "rating": compute_rating(t_att_rate, t_pages)
                })

            paginated_items, pagination_meta = paginate_items(teachers_table, request)
            response_data["items"] = paginated_items
            response_data["pagination"] = pagination_meta

        # ─── TAB 5: STUDENTS REPORTS ──────────────────────────────────────────
        elif tab == 'students':
            students = Student.objects.using(db_name).all()
            if search_query:
                students = students.filter(full_name__icontains=search_query)
            if student_id and student_id != 'all':
                students = students.filter(id=student_id)

            total_students = students.count()

            top_students_list = []
            students_table = []

            for s in students:
                s_att = attendance_logs.filter(student_id=s.id)
                s_present = s_att.filter(status='PRESENT').count()
                s_att_total = s_att.count()
                s_att_rate = round((s_present / s_att_total * 100)) if s_att_total > 0 else 0
                s_pages = recitations_qs.filter(student_id=s.id).aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0

                halaqa_name = "غير محدد"
                try:
                    enrollment = StudentEnrollment.objects.using(db_name).filter(
                        student_id=s.id, is_active=True
                    ).select_related('halaqa').first()
                    if enrollment and enrollment.halaqa:
                        halaqa_name = enrollment.halaqa.name
                    elif s.halaqa:
                        halaqa_name = s.halaqa.name
                except Exception:
                    pass

                item = {
                    "id": str(s.id),
                    "student_name": s.full_name,
                    "halaqa_name": halaqa_name,
                    "attendance_rate": f"{s_att_rate}%",
                    "reached_page": s.reached_page or 1,
                    "pages_recited": s_pages,
                    "rating": compute_rating(s_att_rate, s_pages)
                }

                students_table.append(item)

                if s_att_rate >= 90 or s_pages >= 100:
                    top_students_list.append({
                        "student_id": str(s.id),
                        "student_name": s.full_name,
                        "halaqa_name": halaqa_name
                    })

            response_data["stats"] = {
                "total_students": total_students,
                "avg_attendance_rate": f"{avg_attendance_percent}%",
                "total_pages_memorized": total_pages_recited,
                "top_students_list": top_students_list[:10]
            }

            paginated_items, pagination_meta = paginate_items(students_table, request)
            response_data["items"] = paginated_items
            response_data["pagination"] = pagination_meta

        # ─── TAB 6: PAGES READ REPORTS ────────────────────────────────────────
        elif tab == 'pages':
            new_mem = recitations_qs.filter(recitation_type='NEW_MEMORIZATION').aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0
            minor_rev = recitations_qs.filter(recitation_type='MINOR_REVIEW').aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0
            major_rev = recitations_qs.filter(recitation_type='MAJOR_REVIEW').aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0

            response_data["stats"] = {
                "total_pages": total_pages_recited,
                "new_memorization": new_mem,
                "minor_review": minor_rev,
                "major_review": major_rev
            }

            pages_table = []
            recitations_with_student = recitations_qs.select_related('attendance').order_by('-created_at')

            for r in recitations_with_student:
                student_name = "—"
                try:
                    if r.student_id:
                        s_obj = Student.objects.using(db_name).filter(id=r.student_id).first()
                        student_name = s_obj.full_name if s_obj else "—"
                except Exception:
                    pass

                if search_query and search_query not in student_name.lower():
                    continue

                rec_type_disp = r.get_recitation_type_display() if hasattr(r, 'get_recitation_type_display') else r.recitation_type

                pages_table.append({
                    "id": str(r.id),
                    "student_name": student_name,
                    "recitation_type": rec_type_disp,
                    "page_number": r.page_number,
                    "grade": r.grade or "ممتاز",
                    "date": str(r.created_at)[:10] if r.created_at else str(timezone.localdate())
                })

            paginated_items, pagination_meta = paginate_items(pages_table, request)
            response_data["items"] = paginated_items
            response_data["pagination"] = pagination_meta

        # ─── TAB 7: GENERAL EVALUATION ────────────────────────────────────────
        elif tab == 'evaluation':
            # AI Overall Assessment Engine Call
            ai_eval_data = compute_overall_assessment(db_name, time_filter if len(time_filter) == 7 else None)

            response_data["stats"] = {
                "overall_score": ai_eval_data["overall_score"],
                "attendance_index": ai_eval_data["breakdown"][0]["score"],
                "memorization_index": ai_eval_data["breakdown"][1]["score"],
                "discipline_index": ai_eval_data["breakdown"][2]["score"]
            }

            response_data["items"] = ai_eval_data["breakdown"]

        return JsonResponse({"status": "success", "message": "تم جلب بيانات التقارير بنجاح", "data": response_data}, status=200)

    except Exception as e:
        print(f"[ERROR] Reports API failed: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({"status": "error", "message": "حدث خطأ أثناء جلب بيانات التقارير", "details": str(e)}, status=500)


@csrf_exempt
def student_activity_view(request):
    """
    Dedicated Endpoint for Student Activity Page.
    Integrated with AI Student Trend Analysis Engine.
    """
    if request.method != 'GET':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name = get_tenant_db(request)
        student_id = request.GET.get('student_id')

        if not student_id:
            return JsonResponse({"status": "error", "message": "معرف الطالب مطلوب (student_id)"}, status=400)

        student = Student.objects.using(db_name).filter(id=student_id).first()
        if not student:
            return JsonResponse({"status": "error", "message": "الطالب غير موجود"}, status=404)

        time_filter = request.GET.get('time_filter', 'all')
        date_from = request.GET.get('date_from', '')
        date_to = request.GET.get('date_to', '')
        start_date, end_date = get_date_range_from_filter(time_filter, date_from, date_to)

        halaqa_name = "غير محدد"
        teacher_name = "غير محدد"
        try:
            enrollment = StudentEnrollment.objects.using(db_name).filter(
                student_id=student.id, is_active=True
            ).select_related('halaqa').first()
            if enrollment and enrollment.halaqa:
                halaqa_name = enrollment.halaqa.name
                teacher_name = enrollment.halaqa.teacher_name or "غير محدد"
            elif student.halaqa:
                halaqa_name = student.halaqa.name
                teacher_name = student.halaqa.teacher_name or "غير محدد"
        except Exception:
            pass

        att_qs = AttendanceLog.objects.using(db_name).filter(student_id=student.id).order_by('-session_date')
        if start_date and end_date:
            att_qs = att_qs.filter(session_date__gte=start_date, session_date__lte=end_date)

        total_att = att_qs.count()
        present_count = att_qs.filter(status='PRESENT').count()
        absent_count = att_qs.filter(status='ABSENT').count()
        excused_count = att_qs.filter(status='EXCUSED').count()
        late_count = att_qs.filter(status='LATE').count()
        attendance_rate_val = round((present_count / total_att * 100), 1) if total_att > 0 else 0.0

        avg_behavior_score = att_qs.aggregate(avg_score=Coalesce(Avg('behavior_score'), 10.0, output_field=FloatField()))['avg_score'] or 10

        rec_qs = RecitationLog.objects.using(db_name).filter(student_id=student.id).order_by('-created_at')
        if start_date and end_date:
            rec_qs = rec_qs.filter(created_at__date__gte=start_date, created_at__date__lte=end_date)

        total_pages_recited = rec_qs.aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0

        # AI Student Trend Analysis Engine Call
        ai_trend = analyze_student_trend(db_name, str(student.id))

        recitations_list = []
        for r in rec_qs[:100]:
            recitations_list.append({
                "id": str(r.id),
                "date": str(r.created_at)[:10] if r.created_at else str(timezone.localdate()),
                "recitation_type": r.get_recitation_type_display() if hasattr(r, 'get_recitation_type_display') else r.recitation_type,
                "page_number": r.page_number,
                "from_surah": r.from_surah,
                "from_ayah": r.from_ayah,
                "to_surah": r.to_surah,
                "to_ayah": r.to_ayah,
                "grade": r.grade,
                "memorization_mistakes": r.memorization_mistakes_count,
                "tajweed_mistakes": r.tajweed_mistakes_count,
                "notes": r.notes or ""
            })

        attendance_list = []
        for a in att_qs[:100]:
            attendance_list.append({
                "id": str(a.id),
                "session_date": str(a.session_date),
                "status": a.get_status_display() if hasattr(a, 'get_status_display') else a.status,
                "is_late": a.is_late,
                "behavior": a.get_behavior_display() if hasattr(a, 'get_behavior_display') else a.behavior,
                "behavior_score": a.behavior_score,
                "notes": a.notes or ""
            })

        activity_data = {
            "student_info": {
                "id": str(student.id),
                "full_name": student.full_name,
                "halaqa_name": halaqa_name,
                "teacher_name": teacher_name,
                "reached_page": student.reached_page or 1,
                "national_id": student.national_id or ""
            },
            "summary_stats": {
                "attendance_rate": f"{attendance_rate_val}%",
                "present_days": present_count,
                "absent_days": absent_count,
                "excused_days": excused_count,
                "late_days": late_count,
                "total_pages_recited": total_pages_recited,
                "avg_behavior_score": avg_behavior_score,
                "rating": compute_rating(attendance_rate_val, total_pages_recited)
            },
            "ai_trend_analysis": ai_trend,
            "recitations_history": recitations_list,
            "attendance_history": attendance_list
        }

        return JsonResponse({"status": "success", "message": "تم جلب نشاط الطالب بنجاح", "data": activity_data}, status=200)

    except Exception as e:
        print(f"[ERROR] Student Activity API failed: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({"status": "error", "message": "حدث خطأ أثناء جلب نشاط الطالب", "details": str(e)}, status=500)


@csrf_exempt
def certificate_generate_view(request):
    if request.method != 'GET':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    return JsonResponse({
        "status": "success",
        "message": "شهادات التقدير",
        "data": {
            "certificates": [],
            "message": "لا توجد شهادات متاحة حالياً"
        }
    }, status=200)

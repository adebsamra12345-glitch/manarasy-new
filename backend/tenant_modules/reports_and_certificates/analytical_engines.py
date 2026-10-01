"""
Analytical & AI Engines for Reports and Evaluation in Manara Multi-tenant Platform.
Includes:
- Dynamic Available Mosque Months Extractor (No static values)
- Circle Performance Index (CPI) Engine
- Project Progress Analysis Index (PPAI) Engine
- Student Trend & Trajectory Engine (STAE)
- Overall Assessment (Explainable Score) Engine
"""

from datetime import datetime, date, timedelta
from django.utils import timezone
from django.db.models import Count, Sum, Avg, Q, FloatField, IntegerField
from django.db.models.functions import Coalesce

from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student, StudentEnrollment
from tenant_modules.attendance.models import HalaqaSession, AttendanceLog
from tenant_modules.recitation_and_sabr.models import RecitationLog
from tenant_modules.centers_and_projects.models import Project, StudentExamResult


# ─── 0. DYNAMIC AVAILABLE MOSQUE MONTHS EXTRACTOR ──────────────────────────────
def get_available_mosque_months(db_name):
    """
    Scans HalaqaSession session_date records in the tenant database to return
    all distinct historical months available for selection.
    Returns: [{'value': '2026-03', 'label': 'مارس 2026'}, ...]
    """
    month_names_ar = {
        1: "يناير", 2: "فبراير", 3: "مارس", 4: "أبريل",
        5: "مايو", 6: "يونيو", 7: "يوليو", 8: "أغسطس",
        9: "سبتمبر", 10: "أكتوبر", 11: "نوفمبر", 12: "ديسمبر"
    }

    session_dates = HalaqaSession.objects.using(db_name).filter(
        session_date__isnull=False
    ).values_list('session_date', flat=True).distinct()

    unique_months = set()
    for s_date in session_dates:
        if isinstance(s_date, (datetime, date)):
            unique_months.add((s_date.year, s_date.month))

    sorted_months = sorted(list(unique_months), key=lambda x: (x[0], x[1]), reverse=True)

    result = []
    for y, m in sorted_months:
        val = f"{y:04d}-{m:02d}"
        lbl = f"{month_names_ar.get(m, m)} {y}"
        result.append({
            "value": val,
            "label": lbl,
            "year": y,
            "month": m
        })

    # If no session dates recorded yet, provide current month
    if not result:
        now = timezone.localdate()
        result.append({
            "value": f"{now.year:04d}-{now.month:02d}",
            "label": f"{month_names_ar.get(now.month, now.month)} {now.year}",
            "year": now.year,
            "month": now.month
        })

    return result


# ─── 1. AI CIRCLE PERFORMANCE INDEX (CPI) ENGINE ──────────────────────────────
def analyze_circle_performance(db_name, month_str=None, halaqat_qs=None):
    """
    Calculates the multi-dimensional Circle Performance Index (CPI).
    Formula: CPI = (0.35 * Attendance) + (0.35 * Memorization_Capacity) + (0.15 * Regularity) + (0.15 * Behavior)
    """
    today = timezone.localdate()
    if month_str:
        try:
            dt = datetime.strptime(month_str, "%Y-%m").date()
            start_date = dt.replace(day=1)
            if dt.month == 12:
                end_date = dt.replace(year=dt.year + 1, month=1) - timedelta(days=1)
            else:
                end_date = dt.replace(month=dt.month + 1) - timedelta(days=1)
        except ValueError:
            start_date = today.replace(day=1)
            end_date = today
    else:
        start_date = today.replace(day=1)
        end_date = today

    if halaqat_qs is None:
        halaqat_qs = Halaqa.objects.using(db_name).filter(is_active=True)

    results = []
    overall_cpi_sum = 0
    total_analyzed = 0

    for h in halaqat_qs:
        enrollments_count = StudentEnrollment.objects.using(db_name).filter(halaqa_id=h.id, is_active=True).count()
        sessions = HalaqaSession.objects.using(db_name).filter(halaqa_id=h.id, is_active=True, session_date__gte=start_date, session_date__lte=end_date)
        working_days = sessions.aggregate(cnt=Count('session_date', distinct=True))['cnt'] or 0

        att_logs = AttendanceLog.objects.using(db_name).filter(halaqa_id=h.id, session_date__gte=start_date, session_date__lte=end_date)
        total_att = att_logs.count()
        present_att = att_logs.filter(status='PRESENT').count()
        att_score = round((present_att / total_att * 100), 1) if total_att > 0 else 0.0

        rec_pages = RecitationLog.objects.using(db_name).filter(attendance__halaqa_id=h.id, created_at__date__gte=start_date, created_at__date__lte=end_date).aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0
        expected_pages = max(1, enrollments_count * 10)
        rec_score = min(100.0, round((rec_pages / expected_pages) * 100, 1))

        expected_working_days = 20
        reg_score = min(100.0, round((working_days / expected_working_days) * 100, 1))

        avg_beh = att_logs.aggregate(avg_beh=Coalesce(Avg('behavior_score'), 10.0, output_field=FloatField()))['avg_beh'] or 10.0
        beh_score = round((avg_beh / 10.0) * 100, 1)

        cpi = round((0.35 * att_score) + (0.35 * rec_score) + (0.15 * reg_score) + (0.15 * beh_score), 1)

        status_text = "ممتاز" if cpi >= 88 else "جيد جداً" if cpi >= 75 else "جيد" if cpi >= 60 else "تحت المراجعة"

        results.append({
            "halaqa_id": str(h.id),
            "halaqa_name": h.name,
            "teacher_name": h.teacher_name or "غير محدد",
            "cpi_score": f"{cpi}%",
            "cpi_numeric": cpi,
            "status": status_text,
            "metrics_breakdown": {
                "attendance_score": f"{att_score}%",
                "recitation_score": f"{rec_score}%",
                "regularity_score": f"{reg_score}%",
                "behavior_score": f"{beh_score}%",
                "working_days": working_days,
                "recited_pages": rec_pages,
                "active_students": enrollments_count
            }
        })
        overall_cpi_sum += cpi
        total_analyzed += 1

    avg_cpi = round(overall_cpi_sum / total_analyzed, 1) if total_analyzed > 0 else 0.0

    return {
        "period": f"{start_date} إلى {end_date}",
        "average_cpi": f"{avg_cpi}%",
        "total_halaqat_analyzed": total_analyzed,
        "halaqat_rankings": sorted(results, key=lambda x: x["cpi_numeric"], reverse=True),
        "ai_insight": f"تحليل أداء الحلقات للفترة ينوه بمتوسط كفاءة إجمالية تبلغ {avg_cpi}%. تم حساب المؤشرات بأوزان رياضية: الحضور (35%)، الحفظ (35%)، الانتظام (15%)، والسلوك (15%)."
    }


# ─── 2. AI PROJECT ANALYSIS ENGINE ─────────────────────────────────────────────
def analyze_project_progress(db_name, month_str=None, projects_qs=None):
    """
    Measures project progress combining actual exam results, stage part progress, and attendance.
    """
    today = timezone.localdate()
    if month_str:
        try:
            dt = datetime.strptime(month_str, "%Y-%m").date()
            start_date = dt.replace(day=1)
            if dt.month == 12:
                end_date = dt.replace(year=dt.year + 1, month=1) - timedelta(days=1)
            else:
                end_date = dt.replace(month=dt.month + 1) - timedelta(days=1)
        except ValueError:
            start_date = today.replace(day=1)
            end_date = today
    else:
        start_date = today.replace(day=1)
        end_date = today

    if projects_qs is None:
        projects_qs = Project.objects.using(db_name).filter(is_active=True)

    results = []

    for p in projects_qs:
        p_halaqat_ids = list(Halaqa.objects.using(db_name).filter(project_id=p.id, is_active=True).values_list('id', flat=True))
        p_students_count = StudentEnrollment.objects.using(db_name).filter(project_id=p.id, is_active=True).count()

        p_exams = StudentExamResult.objects.using(db_name).filter(stage__project_id=p.id, updated_at__date__gte=start_date, updated_at__date__lte=end_date)
        exams_total = p_exams.count()
        exams_passed = p_exams.filter(status='PASSED').count()
        exam_score = round((exams_passed / exams_total * 100), 1) if exams_total > 0 else 0.0

        p_att = AttendanceLog.objects.using(db_name).filter(halaqa_id__in=p_halaqat_ids, session_date__gte=start_date, session_date__lte=end_date)
        att_total = p_att.count()
        att_pres = p_att.filter(status='PRESENT').count()
        att_score = round((att_pres / att_total * 100), 1) if att_total > 0 else 0.0

        stage_score = round(min(100.0, (exams_passed + 1) / max(1, p_students_count) * 100), 1)

        progress_index = round((0.50 * exam_score) + (0.30 * stage_score) + (0.20 * att_score), 1)

        results.append({
            "project_id": str(p.id),
            "project_name": p.title,
            "progress_index": f"{progress_index}%",
            "progress_numeric": progress_index,
            "exams_conducted": exams_total,
            "exams_passed": exams_passed,
            "enrolled_students": p_students_count,
            "attendance_rate": f"{att_score}%",
            "status": "متقدم بحسب الخطة" if progress_index >= 75 else "أداء منتظم" if progress_index >= 50 else "يحتاج متابعة ميدانية"
        })

    return {
        "period": f"{start_date} إلى {end_date}",
        "projects_analysis": results
    }


# ─── 3. AI STUDENT TREND ENGINE ───────────────────────────────────────────────
def analyze_student_trend(db_name, student_id):
    """
    Extracts student performance trends, attendance trajectory, behavior scores, and risk assessment.
    """
    today = timezone.localdate()
    student = Student.objects.using(db_name).filter(id=student_id).first()
    if not student:
        return None

    att_logs = AttendanceLog.objects.using(db_name).filter(student_id=student_id).order_by('-session_date')
    total_att = att_logs.count()
    present_att = att_logs.filter(status='PRESENT').count()
    overall_att_rate = round((present_att / total_att * 100), 1) if total_att > 0 else 0.0

    recent_14_days = today - timedelta(days=14)
    recent_att = att_logs.filter(session_date__gte=recent_14_days)
    rec_total = recent_att.count()
    rec_pres = recent_att.filter(status='PRESENT').count()
    recent_att_rate = round((rec_pres / rec_total * 100), 1) if rec_total > 0 else overall_att_rate

    att_delta = round(recent_att_rate - overall_att_rate, 1)

    if att_delta > 3.0:
        att_trend = "تحسن ملحوظ في الحضور"
    elif att_delta < -3.0:
        att_trend = "تراجع في نسبة الحضور"
    else:
        att_trend = "مستوى حضور مستقر"

    avg_behavior = att_logs.aggregate(avg_b=Coalesce(Avg('behavior_score'), 10.0, output_field=FloatField()))['avg_b'] or 10.0

    rec_logs = RecitationLog.objects.using(db_name).filter(student_id=student_id)
    total_pages = rec_logs.aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0

    four_weeks_ago = today - timedelta(days=28)
    recent_pages = rec_logs.filter(created_at__date__gte=four_weeks_ago).aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0
    pages_per_week = round(recent_pages / 4.0, 1)

    if overall_att_rate >= 90 and avg_behavior >= 8.5:
        risk_level = "متميز جداً"
        risk_color = "green"
    elif overall_att_rate >= 75:
        risk_level = "مستوى مستقر"
        risk_color = "blue"
    elif overall_att_rate >= 60:
        risk_level = "يحتاج متابعة وتوجيه"
        risk_color = "yellow"
    else:
        risk_level = "معرض للانقطاع / مخاطر عالية"
        risk_color = "red"

    return {
        "student_id": str(student.id),
        "student_name": student.full_name,
        "overall_attendance_rate": f"{overall_att_rate}%",
        "recent_14day_attendance_rate": f"{recent_att_rate}%",
        "attendance_trend": att_trend,
        "attendance_delta": att_delta,
        "avg_behavior_score": avg_behavior,
        "total_pages_recited": total_pages,
        "memorization_velocity_weekly": f"{pages_per_week} صفحة/أسبوع",
        "risk_classification": risk_level,
        "risk_color": risk_color,
        "recommendation": f"يُوصى بالاستمرار في تعزيز الحفظ وتكثيف المراجعة بمتوسط {pages_per_week} صفحة أسبوعياً."
    }


# ─── 4. OVERALL ASSESSMENT ENGINE (EXPLAINABLE AI) ────────────────────────────
def compute_overall_assessment(db_name, month_str=None):
    """
    Computes explainable Overall Score for current month using weighted model:
    - Attendance Discipline (40%)
    - Memorization Quality (40%)
    - In-Session Behavior & Engagement (20%)
    """
    today = timezone.localdate()
    if month_str:
        try:
            dt = datetime.strptime(month_str, "%Y-%m").date()
            start_date = dt.replace(day=1)
            if dt.month == 12:
                end_date = dt.replace(year=dt.year + 1, month=1) - timedelta(days=1)
            else:
                end_date = dt.replace(month=dt.month + 1) - timedelta(days=1)
        except ValueError:
            start_date = today.replace(day=1)
            end_date = today
    else:
        start_date = today.replace(day=1)
        end_date = today

    att_logs = AttendanceLog.objects.using(db_name).filter(session_date__gte=start_date, session_date__lte=end_date)
    att_total = att_logs.count()
    att_pres = att_logs.filter(status='PRESENT').count()
    att_index = round((att_pres / att_total * 100), 1) if att_total > 0 else 0.0

    sessions = HalaqaSession.objects.using(db_name).filter(is_active=True, session_date__gte=start_date, session_date__lte=end_date)
    working_days = sessions.aggregate(cnt=Count('session_date', distinct=True))['cnt'] or 0

    rec_logs = RecitationLog.objects.using(db_name).filter(created_at__date__gte=start_date, created_at__date__lte=end_date)
    total_pages = rec_logs.aggregate(total=Coalesce(Sum('page_number'), 0, output_field=IntegerField()))['total'] or 0
    expected_pages = max(1, working_days * 10)
    mem_index = round(min(100.0, (total_pages / expected_pages) * 100), 1)

    avg_beh = att_logs.aggregate(avg_b=Coalesce(Avg('behavior_score'), 10.0, output_field=FloatField()))['avg_b'] or 10.0
    disc_index = round((avg_beh / 10.0) * 100, 1)

    overall_score = round((0.40 * att_index) + (0.40 * mem_index) + (0.20 * disc_index), 1)

    grade_text = "ممتاز" if overall_score >= 88 else "جيد جداً" if overall_score >= 75 else "جيد" if overall_score >= 60 else "مقبول"

    return {
        "period": f"{start_date} إلى {end_date}",
        "overall_score": f"{overall_score}%",
        "overall_numeric": overall_score,
        "grade_text": grade_text,
        "breakdown": [
            {
                "id": "1",
                "category": "انضباط الحضور والغياب (40%)",
                "score": f"{att_index}%",
                "status": "ممتاز" if att_index >= 88 else "جيد جداً" if att_index >= 75 else "جيد",
                "notes": f"بناء على نسبة حضور {att_index}% عبر إجمالي سجلات الحضور"
            },
            {
                "id": "2",
                "category": "جودة الحفظ والتسميع (40%)",
                "score": f"{mem_index}%",
                "status": "ممتاز" if mem_index >= 88 else "جيد جداً" if mem_index >= 75 else "جيد",
                "notes": f"إجمالي {total_pages} صفحة مسمعة مقارنة بالمستهدف"
            },
            {
                "id": "3",
                "category": "السلوك والتفاعل صلب الجلسات (20%)",
                "score": f"{disc_index}%",
                "status": "ممتاز" if disc_index >= 88 else "جيد جداً" if disc_index >= 75 else "جيد",
                "notes": f"متوسط التقييم السلوكي {avg_beh} من 10"
            }
        ]
    }

import json
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core_system.auth import get_tenant_db
from django.conf import settings
from tenant_modules.attendance.models import AttendanceLog, HalaqaSession
from tenant_modules.students_and_parents.models import Student, StudentEnrollment
from tenant_modules.centers_and_projects.models import EvaluationGrade
from tenant_modules.students_and_parents.utils import resolve_stage_and_part
from core_system.auth import tenant_auth, STAFF_ROLES
from .models import RecitationLog

def parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        raise ValueError("بيانات غير صالحة")

@csrf_exempt
@tenant_auth(STAFF_ROLES)
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

        # استخراج المشروع المرتبط لتحديد اتجاه التسميع
        project = None
        if student and student.halaqa and student.halaqa.project:
            project = student.halaqa.project
        elif student:
            enrollment = StudentEnrollment.objects.using(db_name).filter(student=student, is_active=True).first()
            if enrollment and enrollment.project:
                project = enrollment.project

        is_reverse = getattr(project, 'recitation_direction', 'FORWARD') == 'REVERSE'

        # قراءة معايير قصار السور وعنوان الدرس
        lesson_title = data.get('lesson_title', '').strip() or None
        raw_surah_num = data.get('surah_number')
        surahs_list = data.get('surahs_list', [])
        surah_number = None
        if raw_surah_num is not None:
            try:
                surah_number = int(raw_surah_num)
            except (ValueError, TypeError):
                surah_number = None

        if surahs_list and not surah_number:
            try:
                surah_number = int(surahs_list[0])
            except (ValueError, TypeError, IndexError):
                surah_number = None

        is_surah_evaluation = bool(data.get('is_surah_evaluation', False) or surah_number or surahs_list)

        # استخراج وحدة التقييم للمشروع (صفحات، دروس، محاور)
        eval_unit = getattr(project, 'evaluation_unit', 'PAGES') if project else 'PAGES'
        is_custom_project = project and getattr(project, 'project_type', None) == 'CUSTOM'
        is_lesson_or_topic = is_custom_project and eval_unit in ['LESSONS', 'TOPICS']

        part_id = data.get('part_id')
        part_obj = None
        if part_id:
            try:
                from tenant_modules.centers_and_projects.models import StagePart
                part_obj = StagePart.objects.using(db_name).select_related('stage').get(id=part_id)
                if not lesson_title:
                    lesson_title = part_obj.title
            except Exception:
                pass

        # الصفحة المراد تسميعها
        page_num = page_number
        if page_num is None:
            if is_reverse:
                current_p = student.reached_page if (student and student.reached_page) else 604
                page_num = max(1, current_p - 1)
            else:
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

        # ضبط تقييم السلوك فقط إذا تم إرساله صراحة في بيانات التقييم
        if 'behavior_score' in data and data.get('behavior_score') is not None:
            try:
                b_score = int(data['behavior_score'])
                b_score = max(0, min(10, b_score))
                if att:
                    att.behavior_score = b_score
                    att.save(using=db_name)
            except (ValueError, TypeError):
                pass

        # ─── منع التقييم المكرر للصفحة نفسها أو السورة نفسها أو الدرس/المحور نفسه في نفس الجلسة ───
        if att:
            dup_qs = RecitationLog.objects.using(db_name).filter(attendance=att)
            if is_lesson_or_topic and (lesson_title or part_obj):
                target_title = lesson_title or (part_obj.title if part_obj else "")
                if dup_qs.filter(lesson_title=target_title).exists():
                    unit_name = "الدرس" if eval_unit == 'LESSONS' else "المحور"
                    return JsonResponse({
                        "status": "error",
                        "message": f"تم تقييم {unit_name} ({target_title}) مسبقاً في هذه الجلسة. لا يمكن إضافة تقييم مكرر لنفس {unit_name}.",
                        "code": "ALREADY_EVALUATED"
                    }, status=409)
            elif is_surah_evaluation and surah_number:
                if dup_qs.filter(surah_number=surah_number).exists():
                    return JsonResponse({
                        "status": "error",
                        "message": f"تم تقييم السورة رقم ({surah_number}) مسبقاً في هذه الجلسة. لا يمكن إضافة تقييم مكرر لنفس السورة.",
                        "code": "ALREADY_EVALUATED"
                    }, status=409)
            else:
                if dup_qs.filter(page_number=page_num, is_surah_evaluation=False).exists():
                    return JsonResponse({
                        "status": "error",
                        "message": f"تم تقييم الصفحة ({page_num}) مسبقاً في هذه الجلسة. لا يمكن إضافة تقييم مكرر لنفس الصفحة.",
                        "code": "ALREADY_EVALUATED"
                    }, status=409)

        # تسجيل عمليات التسميع (دعم التقييم الفردي والمتعدد للسور)
        target_surahs = surahs_list if (surahs_list and len(surahs_list) > 1) else [surah_number]
        created_records = []
        for s_item in target_surahs:
            s_val = None
            if s_item is not None:
                try:
                    s_val = int(s_item)
                except (ValueError, TypeError):
                    s_val = None

            if s_val and att and RecitationLog.objects.using(db_name).filter(attendance=att, surah_number=s_val).exists():
                continue

            rec_obj = RecitationLog.objects.using(db_name).create(
                attendance=att,
                student_id=student.id if student else att.student_id,
                recitation_type=recitation_type,
                page_number=page_num,
                evaluation_grade=eval_grade,
                grade=grade_name,
                requires_repeat=requires_repeat,
                behavior_score=b_score,
                notes=notes,
                lesson_title=lesson_title,
                surah_number=s_val,
                is_surah_evaluation=bool(s_val is not None)
            )
            created_records.append(rec_obj)

        rec = created_records[0] if created_records else RecitationLog.objects.using(db_name).filter(attendance=att).last()

        can_recite_next = True
        next_page = max(1, page_num - 1) if is_reverse else (page_num + 1)
        stage_title = None
        part_title = None

        if requires_repeat:
            # في حال الإعادة: يمنع الطالب من التسميع للعنصر التالي ويبقى عند عنصره الحالي
            can_recite_next = False
            next_page = page_num
            if is_lesson_or_topic:
                item_label = "للدرس" if eval_unit == 'LESSONS' else "للمحور"
                item_name = lesson_title or (part_obj.title if part_obj else "")
                msg = f"تم تسجيل تقييم الإعادة {item_label} ({item_name}). يتوجب إعادة التقييم في الجلسة القادمة."
            else:
                unit_label = f"للسورة ({surah_number})" if is_surah_evaluation else f"للصفحة ({page_num})"
                msg = f"تم تسجيل تقييم الإعادة {unit_label}. تم إيقاف التسميع لهذا اليوم وتكرار التقييم في الجلسة القادمة."
        else:
            # في حال النجاح: يتم تحديث التقدم والمرحلة والجزء/الدرس
            if student:
                enrollment = StudentEnrollment.objects.using(db_name).filter(student=student, is_active=True).first()
                if is_lesson_or_topic:
                    if enrollment and part_obj:
                        enrollment.current_part = part_obj
                        enrollment.current_stage = part_obj.stage
                        enrollment.save(using=db_name)
                        stage_title = part_obj.stage.title if part_obj.stage else None
                        part_title = part_obj.title
                    item_label = "الدرس" if eval_unit == 'LESSONS' else "المحور"
                    item_name = lesson_title or (part_obj.title if part_obj else "")
                    msg = f"تم تسجيل تقييم {item_label} ({item_name}) بنجاح."
                else:
                    student.reached_page = page_num
                    student.save(using=db_name)

                    if enrollment:
                        enrollment.reached_page = page_num
                        stage, part = resolve_stage_and_part(db_name, enrollment.project, page_num, student=student)
                        enrollment.current_stage = stage
                        enrollment.current_part = part
                        enrollment.save(using=db_name)
                        stage_title = stage.title if stage else None
                        part_title = part.title if part else None

                    msg = f"تم تسجيل تقييم الصفحة ({page_num}) بنجاح. الطالب متاح لتسميع الصفحة التالية ({next_page})."

                # فحص احتساب نقاط التسميع (عند تسميع 3 صفحات أو دروس بنجاح يحصل على نقطتين)
                try:
                    from tenant_modules.points_and_rewards.services import PointsService
                    successful_evals_today = RecitationLog.objects.using(db_name).filter(
                        attendance=att,
                        requires_repeat=False
                    ).count()
                    if successful_evals_today > 0 and successful_evals_today % 3 == 0:
                        PointsService.award_recitation_pages_points(
                            db_name=db_name,
                            student_id=str(student.id),
                            reason=f"مكافأة إتقان: إتمام {successful_evals_today} تقييمات بنجاح (+2 نقاط)"
                        )
                except Exception:
                    pass

        # إرسال إشعار التقييم اليومي للطالب
        try:
            from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
            target_st = student or Student.objects.using(db_name).filter(id=att.student_id).first()
            if target_st:
                behavior_label = att.get_behavior_display() if (att and hasattr(att, 'get_behavior_display')) else (att.behavior if att else f"{b_score}/10")
                rec_type_label = rec.get_recitation_type_display() if hasattr(rec, 'get_recitation_type_display') else rec.recitation_type
                StudentNotificationService.notify_daily_evaluation(
                    db_name=db_name,
                    student=target_st,
                    memorization_grade=rec.grade,
                    behavior_grade=f"{behavior_label} ({b_score}/10)",
                    notes=notes,
                    page_number=page_num,
                    recitation_type=rec_type_label
                )
        except Exception:
            pass

        return JsonResponse({
            "status": "success",
            "message": msg,
            "data": {
                "recitation_id": str(rec.id) if rec else None,
                "student_id": str(student.id) if student else str(att.student_id),
                "student_name": student.full_name if student else "طالب",
                "page_number": page_num,
                "lesson_title": lesson_title,
                "part_id": str(part_obj.id) if part_obj else None,
                "part_title": part_title or lesson_title,
                "stage_title": stage_title,
                "evaluation_unit": eval_unit,
                "surah_number": surah_number,
                "is_surah_evaluation": is_surah_evaluation,
                "grade": grade_name,
                "requires_repeat": requires_repeat,
                "can_recite_next": can_recite_next,
                "next_page": next_page,
                "behavior_score": b_score,
                "reached_page": student.reached_page if student else page_num
            }
        }, status=201)

    except Exception as e:
        return JsonResponse({"status": "error", "message": "فشل تسجيل تقييم التسميع"}, status=500)


@csrf_exempt
@tenant_auth(STAFF_ROLES)
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
                    "lesson_title": r.lesson_title,
                    "surah_number": r.surah_number,
                    "is_surah_evaluation": r.is_surah_evaluation,
                    "grade": r.grade,
                    "requires_repeat": r.requires_repeat,
                    "behavior_score": r.behavior_score,
                    "created_at": r.created_at.isoformat()
                })
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء جلب سجل التسميع"}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
@tenant_auth(STAFF_ROLES)
def update_recitation_view(request, recitation_id):
    """
    تعديل تقييم تسميع موجود (PUT)
    - مسموح فقط قبل حفظ الجلسة (is_active=True على الجلسة الأم)
    - بعد حفظ الجلسة (is_active=False) يُرفض الطلب
    """
    if request.method != 'PUT':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name = get_tenant_db(request)

        # جلب سجل التسميع
        try:
            rec = RecitationLog.objects.using(db_name).select_related(
                'attendance__session', 'evaluation_grade'
            ).get(id=recitation_id)
        except RecitationLog.DoesNotExist:
            return JsonResponse({"status": "error", "message": "سجل التسميع غير موجود"}, status=404)

        # ─── التحقق من حالة الجلسة: هل هي محفوظة/مقفلة؟ ───
        session = None
        if rec.attendance_id:
            try:
                att = AttendanceLog.objects.using(db_name).select_related('session').get(
                    id=rec.attendance_id
                )
                session = att.session
            except AttendanceLog.DoesNotExist:
                pass

        if session and not session.is_active:
            return JsonResponse({
                "status": "error",
                "message": "لا يمكن تعديل التقييم بعد حفظ الجلسة واعتمادها. الجلسة مغلقة للقراءة فقط.",
                "code": "SESSION_LOCKED"
            }, status=403)

        data = parse_body(request)
        evaluation_grade_id = data.get('evaluation_grade_id')
        grade_input = data.get('grade')
        notes = data.get('notes', rec.notes or '')

        # تحديث فئة التقييم
        eval_grade = None
        requires_repeat = False
        grade_name = grade_input or rec.grade

        if evaluation_grade_id:
            try:
                eval_grade = EvaluationGrade.objects.using(db_name).get(id=evaluation_grade_id)
                grade_name = eval_grade.name
                requires_repeat = eval_grade.requires_repeat
            except EvaluationGrade.DoesNotExist:
                return JsonResponse({"status": "error", "message": "فئة التقييم المحددة غير موجودة"}, status=404)

        # تحديث سجل التسميع
        rec.evaluation_grade = eval_grade
        rec.grade = grade_name
        rec.requires_repeat = requires_repeat
        rec.notes = notes
        if 'lesson_title' in data:
            rec.lesson_title = data.get('lesson_title', rec.lesson_title)
        rec.save(using=db_name)

        return JsonResponse({
            "status": "success",
            "message": f"تم تعديل تقييم الصفحة ({rec.page_number}) بنجاح",
            "data": {
                "recitation_id": str(rec.id),
                "page_number": rec.page_number,
                "lesson_title": rec.lesson_title,
                "surah_number": rec.surah_number,
                "is_surah_evaluation": rec.is_surah_evaluation,
                "grade": grade_name,
                "requires_repeat": requires_repeat,
                "color_code": eval_grade.color_code if eval_grade else None,
                "notes": notes
            }
        }, status=200)

    except Exception as e:
        return JsonResponse({
            "status": "error",
            "message": "حدث خطأ أثناء تعديل التقييم"
        }, status=500)

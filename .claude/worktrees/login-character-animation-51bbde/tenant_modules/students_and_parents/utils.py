from tenant_modules.centers_and_projects.models import ProjectStage, StagePart

def get_part_page_range(part):
    """
    إرجاع نطاق الصفحات (start_page, end_page) لـ StagePart
    """
    if part.part_type == 'DEFAULT_QURAN' and part.juz_number:
        juz = part.juz_number
        if juz == 1:
            return 1, 21
        elif 2 <= juz <= 29:
            start = (juz - 1) * 20 + 2
            end = juz * 20 + 1
            return start, end
        elif juz == 30:
            return 582, 604
    
    return part.start_page, part.end_page


def check_and_notify_stage_exam(db_name, student, stage, reached_page):
    """
    التحقق مما إذا كان الطالب على وشك إنهاء المرحلة التي تتطلب امتحاناً، وإرسال إشعار لمدير المركز
    """
    if not stage:
        return

    project = stage.project
    requires_exam = stage.has_exam or (project and project.require_exam_for_all_stages)
    if not requires_exam:
        return

    last_part = stage.parts.order_by('-order', '-created_at').first()
    if not last_part:
        return

    _, stage_end_page = get_part_page_range(last_part)

    if reached_page >= (stage_end_page - 2):
        from tenant_modules.centers_and_projects.models import StudentExamResult, SystemNotification
        
        existing_result = StudentExamResult.objects.using(db_name).filter(
            stage=stage,
            student=student
        ).first()

        if not existing_result:
            StudentExamResult.objects.using(db_name).create(
                student=student,
                stage=stage,
                exam_template=stage.exam_template,
                status='PENDING'
            )

            student_name = student.full_name if student else "طالب"
            center = None
            if student and student.halaqa:
                center = student.halaqa.center

            manager_user = center.manager if center else None

            SystemNotification.objects.using(db_name).create(
                recipient=manager_user,
                center=center,
                title="تنبيه: اقتراب طالب من امتحان المرحلة",
                message=f"الطالب '{student_name}' اقترب من إنهاء المرحلة ({stage.title}) بمشروع ({project.title}). يرجى تحديد تاريخ الامتحان للطالب."
            )


def resolve_stage_and_part(db_name, project, reached_page, student=None):
    """
    تحديد المرحلة والجزء اللذين ينتمي إليها الطالب بناءً على رقم صفحة الوصول والمشروع مع اشتراط اجتياز امتحان المرحلة
    """
    if not project or reached_page is None:
        return None, None

    try:
        page_num = int(reached_page)
    except (ValueError, TypeError):
        page_num = 1

    stages = list(ProjectStage.objects.using(db_name).filter(project=project).prefetch_related('parts', 'exam_results').order_by('order', 'created_at'))
    if not stages:
        return None, None

    first_stage = stages[0]
    first_part = first_stage.parts.order_by('order', 'created_at').first()
    last_stage = stages[-1]
    last_part = last_stage.parts.order_by('-order', '-created_at').first()

    current_assigned_stage = first_stage
    current_assigned_part = first_part

    for s_idx, stage in enumerate(stages):
        # التحقق من أن المرحلة السابقة إن كان لها امتحان قد تم اجتيازه من الطالب
        if s_idx > 0:
            prev_stage = stages[s_idx - 1]
            prev_requires_exam = prev_stage.has_exam or project.require_exam_for_all_stages
            if prev_requires_exam and student:
                from tenant_modules.centers_and_projects.models import StudentExamResult
                passed = StudentExamResult.objects.using(db_name).filter(
                    stage=prev_stage,
                    student=student,
                    status='PASSED'
                ).exists()
                if not passed:
                    # إذا لم يجتز امتحان المرحلة السابقة، يبقى الطالب في آخر جزء من المرحلة السابقة
                    prev_last_part = prev_stage.parts.order_by('-order', '-created_at').first()
                    check_and_notify_stage_exam(db_name, student, prev_stage, page_num)
                    return prev_stage, prev_last_part

        parts = stage.parts.all().order_by('order', 'created_at')
        for part in parts:
            s_page, e_page = get_part_page_range(part)
            if s_page <= page_num <= e_page:
                check_and_notify_stage_exam(db_name, student, stage, page_num)
                return stage, part

    check_and_notify_stage_exam(db_name, student, last_stage, page_num)
    if last_part:
        last_e_page = get_part_page_range(last_part)[1]
        if page_num > last_e_page:
            return last_stage, last_part

    return first_stage, first_part


def check_student_project_uniqueness(db_name, student=None, user_profile=None, target_halaqa=None, exclude_enrollment_id=None):
    """
    التحقق من شرط عدم انضمام الطالب لأكثر من حلقة في نفس المشروع
    """
    if not target_halaqa or not target_halaqa.project:
        return True, None

    project = target_halaqa.project

    from tenant_modules.students_and_parents.models import StudentEnrollment
    qs = StudentEnrollment.objects.using(db_name).filter(
        is_active=True,
        halaqa__project=project
    )

    if student:
        qs = qs.filter(student=student)
    elif user_profile:
        qs = qs.filter(user_profile=user_profile)
    else:
        return True, None

    if exclude_enrollment_id:
        qs = qs.exclude(id=exclude_enrollment_id)

    existing = qs.first()
    if existing:
        h_name = existing.halaqa.name if existing.halaqa else "حلقة أخرى"
        p_title = project.title
        msg = f"عذراً، الطالب مسجل بالفعل في حلقة ('{h_name}') تابعة لنفس المشروع ('{p_title}'). لا يُسمح بضم الطالب لأكثر من حلقة في نفس المشروع."
        return False, msg

    return True, None

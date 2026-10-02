import uuid
import datetime
from django.db import models
from django.conf import settings

class Center(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True)
    address = models.CharField(max_length=255, null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_rewards_store_enabled = models.BooleanField(default=True, help_text="التحكم بفتح أو إغلاق متجر المكافآت على مستوى المركز")
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='managed_centers'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'centers'


class EvaluationTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'evaluation_templates'

    def __str__(self):
        return self.title


class EvaluationGrade(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(EvaluationTemplate, on_delete=models.CASCADE, related_name='grades')
    name = models.CharField(max_length=100)
    requires_repeat = models.BooleanField(default=False)
    stop_test_action = models.CharField(max_length=30, default='لا', null=True, blank=True)
    order = models.IntegerField(default=1)
    color_code = models.CharField(max_length=30, null=True, blank=True)

    class Meta:
        db_table = 'evaluation_grades'
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.template.title} - {self.name}"


class TestRubric(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'test_rubrics'

    def __str__(self):
        return self.title


class RubricErrorType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rubric = models.ForeignKey(TestRubric, on_delete=models.CASCADE, related_name='error_types')
    name = models.CharField(max_length=150)
    value = models.DecimalField(max_digits=5, decimal_places=2, default=1.00)
    max_count = models.IntegerField(default=3)
    notes = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1)

    class Meta:
        db_table = 'rubric_error_types'
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.rubric.title} - {self.name}"


class ExamTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)
    pass_score = models.DecimalField(max_digits=5, decimal_places=2, default=50.00)
    total_score = models.DecimalField(max_digits=5, decimal_places=2, default=100.00)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'exam_templates'

    def __str__(self):
        return self.title


class ExamQuestion(models.Model):
    QUESTION_TYPE_CHOICES = [
        ('MULTIPLE_CHOICE', 'أتمتة (اختيار من متعدد)'),
        ('ESSAY', 'تحريري'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(ExamTemplate, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES, default='MULTIPLE_CHOICE')
    options = models.JSONField(default=list, blank=True)
    correct_answer = models.TextField()
    points = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    order = models.IntegerField(default=1)

    class Meta:
        db_table = 'exam_questions'
        ordering = ['order', 'id']


class Project(models.Model):
    PROJECT_TYPE_CHOICES = [
        ('QURAN', 'مشروع قرآني'),
        ('CUSTOM', 'مشروع مخصص (منهجي)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    centers = models.ManyToManyField(Center, related_name='projects', blank=True)
    title = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)
    project_type = models.CharField(max_length=20, choices=PROJECT_TYPE_CHOICES, default='QURAN')
    is_global = models.BooleanField(default=False)
    require_exam_for_all_stages = models.BooleanField(default=False)
    evaluation_template = models.ForeignKey(
        EvaluationTemplate, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='projects'
    )
    test_rubric = models.ForeignKey(
        TestRubric,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='projects'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'projects'

    def __str__(self):
        return self.title


class ProjectStage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='stages')
    title = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1)
    has_exam = models.BooleanField(default=False)
    exam_template = models.ForeignKey(ExamTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='stages')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'project_stages'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.project.title} - {self.title}"


class StagePart(models.Model):
    PART_TYPE_CHOICES = [
        ('DEFAULT_QURAN', 'جزء قرآني افتراضي'),
        ('CUSTOM', 'جزء مخصص'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stage = models.ForeignKey(ProjectStage, on_delete=models.CASCADE, related_name='parts')
    title = models.CharField(max_length=150)
    part_type = models.CharField(max_length=20, choices=PART_TYPE_CHOICES, default='DEFAULT_QURAN')
    juz_number = models.IntegerField(null=True, blank=True)
    start_page = models.IntegerField(default=1)
    end_page = models.IntegerField(default=1)
    order = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stage_parts'
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.stage.title} - {self.title} ({self.start_page}-{self.end_page})"


class StudentExamResult(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'بانتظار إجراء الامتحان'),
        ('SCHEDULED', 'تم تحديد موعد الامتحان'),
        ('PASSED', 'ناجح'),
        ('FAILED', 'راسب'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey('students_and_parents.Student', on_delete=models.CASCADE, related_name='exam_results', null=True, blank=True)
    user_profile = models.ForeignKey('users.UserProfile', on_delete=models.CASCADE, related_name='exam_results', null=True, blank=True)
    stage = models.ForeignKey(ProjectStage, on_delete=models.CASCADE, related_name='exam_results')
    exam_template = models.ForeignKey(ExamTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='results')
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    scheduled_date = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_exam_results'


class SystemNotification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    center = models.ForeignKey(Center, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'system_notifications'


class MosqueWeeklySchedule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    center = models.ForeignKey(Center, on_delete=models.CASCADE, null=True, blank=True, related_name='weekly_schedules')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='weekly_schedules')
    month = models.CharField(max_length=7, default='2026-02')  # صيغة YYYY-MM
    week_number = models.IntegerField(default=1)  # 1 = الأسبوع الأول, 2 = الأسبوع الثاني, 3 = الأسبوع الثالث, 4 = الأسبوع الرابع, 5 = الأسبوع الخامس
    day_of_week = models.IntegerField(default=0)  # 0=الأحد, 1=الإثنين, 2=الثلاثاء, 3=الأربعاء, 4=الخميس, 5=الجمعة, 6=السبت
    start_time = models.TimeField(default=datetime.time(9, 0))
    end_time = models.TimeField(default=datetime.time(11, 0))
    session_title = models.CharField(max_length=150, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mosque_weekly_schedules'
        ordering = ['week_number', 'day_of_week', 'start_time']
        constraints = [
            models.UniqueConstraint(
                fields=['center', 'project', 'month', 'week_number', 'day_of_week'],
                name='unique_center_project_schedule_slot'
            )
        ]

    def __str__(self):
        return f"Week {self.week_number} Day {self.day_of_week} ({self.start_time}-{self.end_time})"
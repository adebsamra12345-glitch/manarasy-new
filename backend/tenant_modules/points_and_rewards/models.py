import uuid
from django.db import models
from django.utils import timezone
from tenant_modules.students_and_parents.models import Student
from tenant_modules.users.models import UserProfile
from tenant_modules.centers_and_projects.models import Center
from tenant_modules.halaqat.models import Halaqa


class PointTransaction(models.Model):
    TRANSACTION_TYPES = [
        ('BEHAVIORAL_BONUS', 'مكافأة سلوكية (+2)'),
        ('REWARD_REDEMPTION', 'استبدال مكافأة'),
        ('COMPETITION_PRIZE', 'جائزة مسابقة'),
        ('ATTENDANCE', 'حضور وجلسات'),
        ('RECITATION', 'تسميع وإنجاز'),
        ('MANUAL_ADJUSTMENT', 'تعديل يدوي'),
        ('REFUND', 'استرجاع نقاط'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='point_transactions')
    amount = models.IntegerField(help_text="القيمة المضافة (موجبة) أو المخصومة (سالبة)")
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPES, default='BEHAVIORAL_BONUS')
    reason = models.TextField(help_text="سبب العملية")
    balance_before = models.IntegerField(default=0)
    balance_after = models.IntegerField(default=0)
    performed_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='awarded_point_transactions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'point_transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student.full_name} ({self.amount:+d}) - {self.get_transaction_type_display()}"


class Reward(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    image = models.TextField(null=True, blank=True, help_text="رابط الصورة أو كود الصورة")
    points_cost = models.PositiveIntegerField(default=50, help_text="عدد النقاط المطلوبة للاستبدال")
    stock_quantity = models.IntegerField(default=-1, help_text="-1 تعني كمية غير محدودة، أو رقم يمثل المخزون المتاح")
    is_active = models.BooleanField(default=True)
    center = models.ForeignKey(Center, on_delete=models.SET_NULL, null=True, blank=True, related_name='rewards')
    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_rewards')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rewards'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.points_cost} نقطة)"


class RewardClaim(models.Model):
    CLAIM_STATUS = [
        ('PENDING', 'قيد الانتظار'),
        ('APPROVED', 'تمت الموافقة'),
        ('DELIVERED', 'تم التسليم'),
        ('REJECTED', 'مرفوض'),
        ('CANCELLED', 'ملغي'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='reward_claims')
    reward = models.ForeignKey(Reward, on_delete=models.CASCADE, related_name='claims')
    points_spent = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=CLAIM_STATUS, default='PENDING')
    notes = models.TextField(null=True, blank=True, help_text="ملاحظات الطالب / ولي الأمر عند الطلب")
    admin_notes = models.TextField(null=True, blank=True, help_text="ملاحظات الإدارة للطالب")
    rejection_reason = models.TextField(null=True, blank=True, help_text="سبب الرفض إن وجد")
    claimed_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processed_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_claims')

    class Meta:
        db_table = 'reward_claims'
        ordering = ['-claimed_at']

    def __str__(self):
        return f"طلب {self.reward.name} للطالب {self.student.full_name} ({self.get_status_display()})"


class Competition(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(default=30, help_text="مدة الحل بالدقائق")
    max_attempts = models.PositiveIntegerField(default=1, help_text="عدد المحاولات المسموحة")
    points_reward = models.PositiveIntegerField(default=10, help_text="النقاط الممنوحة عند الاجتياز أو الفوز")
    is_published = models.BooleanField(default=True)
    
    # الاستهداف
    target_all_centers = models.BooleanField(default=True)
    target_centers = models.ManyToManyField(Center, blank=True, related_name='competitions')
    target_halaqat = models.ManyToManyField(Halaqa, blank=True, related_name='competitions')
    
    created_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_competitions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'competitions'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class CompetitionSection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name='sections')
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = 'competition_sections'
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.competition.title} - {self.title}"


class CompetitionQuestion(models.Model):
    QUESTION_TYPE_CHOICES = [
        ('MULTIPLE_CHOICE', 'اختيار من متعدد (مؤتمت)'),
        ('TRUE_FALSE', 'صح أو خطأ (مؤتمت)'),
        ('ESSAY', 'سؤال تحريري / مقالي'),
        ('MATCHING', 'مطابقة'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name='questions')
    section = models.ForeignKey(CompetitionSection, on_delete=models.SET_NULL, null=True, blank=True, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=25, choices=QUESTION_TYPE_CHOICES, default='MULTIPLE_CHOICE')
    options = models.JSONField(default=list, blank=True, help_text="قائمة الخيارات للأسئلة المؤتمتة")
    correct_answer = models.TextField(blank=True, help_text="الإجابة الصحيحة للأسئلة المؤتمتة أو معيار التصحيح للمقالي")
    points = models.DecimalField(max_digits=5, decimal_places=2, default=1.00)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = 'competition_questions'
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.question_text[:50]} ({self.get_question_type_display()})"


class CompetitionParticipation(models.Model):
    STATUS_CHOICES = [
        ('IN_PROGRESS', 'جارية'),
        ('SUBMITTED', 'تم التسليم'),
        ('GRADED', 'تم التصحيح والاعتماد'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name='participations')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='competition_participations')
    attempt_number = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='IN_PROGRESS')
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    score = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    total_possible_score = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    points_awarded = models.IntegerField(default=0)
    is_reviewed = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_competitions')

    class Meta:
        db_table = 'competition_participations'
        ordering = ['-started_at']

    def __str__(self):
        return f"مشاركة {self.student.full_name} في {self.competition.title}"


class QuestionAnswer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participation = models.ForeignKey(CompetitionParticipation, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(CompetitionQuestion, on_delete=models.CASCADE)
    student_answer = models.TextField(blank=True)
    is_correct = models.BooleanField(null=True, blank=True)
    score_awarded = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    review_notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'competition_question_answers'

    def __str__(self):
        return f"إجابة السؤال {self.question_id} - المشاركة {self.participation_id}"

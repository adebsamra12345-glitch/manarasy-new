import uuid
from django.db import models
from tenant_modules.halaqat.models import Halaqa

class Parent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30)
    email = models.EmailField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'parents'

class Student(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = models.ForeignKey(Parent, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    halaqa = models.ForeignKey(Halaqa, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    full_name = models.CharField(max_length=150)
    national_id = models.CharField(max_length=50, null=True, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    reached_page = models.IntegerField(default=1)
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
    ]
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M')
    
    # New fields added for detailed student profiles
    mother_name = models.CharField(max_length=150, null=True, blank=True)
    mother_phone = models.CharField(max_length=30, null=True, blank=True)
    registration_number = models.CharField(max_length=50, null=True, blank=True)
    current_residence = models.CharField(max_length=200, null=True, blank=True)
    points = models.IntegerField(default=0)
    rating = models.FloatField(default=0.0)
    is_orphan = models.BooleanField(default=False)
    has_special_needs = models.BooleanField(default=False)
    special_needs_notes = models.TextField(null=True, blank=True)
    income_level = models.CharField(max_length=50, null=True, blank=True)
    general_notes = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'students'


class StudentEnrollment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, null=True, blank=True, related_name='enrollments')
    user_profile = models.ForeignKey('users.UserProfile', on_delete=models.CASCADE, null=True, blank=True, related_name='enrollments')
    halaqa = models.ForeignKey(Halaqa, on_delete=models.CASCADE, related_name='student_enrollments')
    project = models.ForeignKey('centers_and_projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='student_enrollments')
    reached_page = models.IntegerField(default=1)
    current_stage = models.ForeignKey('centers_and_projects.ProjectStage', on_delete=models.SET_NULL, null=True, blank=True, related_name='enrolled_students')
    current_part = models.ForeignKey('centers_and_projects.StagePart', on_delete=models.SET_NULL, null=True, blank=True, related_name='enrolled_students')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_enrollments'


class StudentRegistrationRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'قيد الانتظار'),
        ('APPROVED', 'مقبول'),
        ('REJECTED', 'مرفوض'),
        ('CANCELLED', 'ملغى بواسطة المعلم'),
    ]
    REQUEST_TYPE_CHOICES = [
        ('NEW', 'طلب تسجيل طالب جديد'),
        ('UPDATE', 'طلب تعديل بيانات طالب'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    request_type = models.CharField(max_length=20, choices=REQUEST_TYPE_CHOICES, default='NEW')
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name='update_requests')
    requested_by = models.ForeignKey('users.UserProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='submitted_registration_requests')
    halaqa = models.ForeignKey(Halaqa, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Personal Info
    full_name = models.CharField(max_length=150)
    gender = models.CharField(max_length=1, choices=Student.GENDER_CHOICES, default='M')
    birth_date = models.DateField(null=True, blank=True)
    national_id = models.CharField(max_length=50, null=True, blank=True)
    registration_number = models.CharField(max_length=50, null=True, blank=True)
    is_orphan = models.BooleanField(default=False)
    has_special_needs = models.BooleanField(default=False)
    special_needs_notes = models.TextField(null=True, blank=True)

    # Contact & Parent Info
    parent_name = models.CharField(max_length=150, null=True, blank=True)
    parent_phone = models.CharField(max_length=30, null=True, blank=True)
    mother_name = models.CharField(max_length=150, null=True, blank=True)
    mother_phone = models.CharField(max_length=30, null=True, blank=True)
    current_residence = models.CharField(max_length=200, null=True, blank=True)
    income_level = models.CharField(max_length=50, null=True, blank=True)
    general_notes = models.TextField(null=True, blank=True)

    # Educational Data
    project = models.ForeignKey('centers_and_projects.Project', on_delete=models.SET_NULL, null=True, blank=True)
    current_stage = models.ForeignKey('centers_and_projects.ProjectStage', on_delete=models.SET_NULL, null=True, blank=True)
    current_part = models.ForeignKey('centers_and_projects.StagePart', on_delete=models.SET_NULL, null=True, blank=True)
    reached_page = models.IntegerField(default=1)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_registration_requests'

class StudentDeletionRequest(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'قيد الانتظار'),
        ('APPROVED', 'مقبول'),
        ('REJECTED', 'مرفوض'),
        ('CANCELLED', 'ملغى بواسطة المعلم'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='deletion_requests')
    requested_by = models.ForeignKey('users.UserProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='submitted_deletion_requests')
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    reviewed_by = models.ForeignKey('users.UserProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_deletion_requests')
    rejection_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'student_deletion_requests'

    def __str__(self):
        return f"Deletion Request for {self.student.full_name} by {self.requested_by} ({self.status})"


class EvaluationLog(models.Model):
    EVALUATION_TYPE_CHOICES = [
        ('MEMORIZATION', 'حفظ'),
        ('BEHAVIOR', 'سلوك'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='evaluations')
    teacher = models.ForeignKey('users.UserProfile', on_delete=models.SET_NULL, null=True, blank=True, related_name='evaluations_given')
    halaqa = models.ForeignKey(Halaqa, on_delete=models.SET_NULL, null=True, blank=True, related_name='evaluations')
    evaluation_type = models.CharField(max_length=50, choices=EVALUATION_TYPE_CHOICES)
    score = models.DecimalField(max_digits=5, decimal_places=2)
    date = models.DateField()
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'evaluation_logs'
        indexes = [
            models.Index(fields=['student', 'evaluation_type', 'date']),
        ]

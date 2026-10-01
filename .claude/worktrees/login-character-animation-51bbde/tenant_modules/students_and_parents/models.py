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


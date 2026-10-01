import uuid
from django.db import models

class HalaqaSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    halaqa_id = models.UUIDField()
    teacher_id = models.UUIDField(null=True, blank=True)
    session_date = models.DateField(auto_now_add=True)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'halaqa_sessions'


class AttendanceLog(models.Model):
    STATUS_CHOICES = [
        ('PRESENT', 'حاضر'), 
        ('ABSENT', 'غائب'), 
        ('EXCUSED', 'مستأذن'), 
        ('LATE', 'متأخر')
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(HalaqaSession, on_delete=models.CASCADE, related_name='attendance_logs', null=True, blank=True)
    student_id = models.UUIDField()
    halaqa_id = models.UUIDField()
    teacher_id = models.UUIDField(null=True, blank=True)
    session_date = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PRESENT')
    check_in_time = models.TimeField(null=True, blank=True)
    behavior_score = models.IntegerField(default=10, null=True, blank=True)
    notes = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'attendance_logs'
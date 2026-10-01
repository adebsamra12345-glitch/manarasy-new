import uuid
from django.db import models

from django.utils import timezone

class HalaqaSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    halaqa_id = models.UUIDField()
    teacher_id = models.UUIDField(null=True, blank=True)
    session_date = models.DateField(default=timezone.now)
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'halaqa_sessions'
        constraints = [
            models.UniqueConstraint(
                fields=['halaqa_id', 'session_date'],
                name='unique_halaqa_session_per_date'
            )
        ]


class SessionAuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(HalaqaSession, on_delete=models.CASCADE, related_name='audit_logs')
    previous_date = models.DateField()
    new_date = models.DateField()
    changed_by = models.UUIDField(null=True, blank=True)
    changed_by_name = models.CharField(max_length=150, null=True, blank=True)
    reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'session_audit_logs'
        ordering = ['-created_at']


class AttendanceLog(models.Model):
    STATUS_CHOICES = [
        ('PRESENT', 'حاضر'), 
        ('ABSENT', 'غائب بدون عذر'), 
        ('EXCUSED', 'غائب بعذر'), 
        ('LATE', 'متأخر')
    ]

    BEHAVIOR_CHOICES = [
        ('EXCELLENT', 'ممتاز'),
        ('VERY_GOOD', 'جيد جداً'),
        ('GOOD', 'جيد'),
        ('ACCEPTABLE', 'مقبول'),
        ('WEAK', 'ضعيف'),
        ('LEFT_WITHOUT_EXCUSE', 'مغادرة الحلقة دون عذر'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(HalaqaSession, on_delete=models.CASCADE, related_name='attendance_logs', null=True, blank=True)
    student_id = models.UUIDField()
    halaqa_id = models.UUIDField()
    teacher_id = models.UUIDField(null=True, blank=True)
    session_date = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PRESENT')
    is_late = models.BooleanField(default=False)
    behavior_score = models.IntegerField(default=10, null=True, blank=True)
    behavior = models.CharField(max_length=50, choices=BEHAVIOR_CHOICES, default='EXCELLENT', null=True, blank=True)
    notes = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = 'attendance_logs'
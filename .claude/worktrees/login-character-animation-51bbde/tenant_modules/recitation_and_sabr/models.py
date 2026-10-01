import uuid
from django.db import models
from tenant_modules.attendance.models import AttendanceLog

class RecitationLog(models.Model):
    RECITATION_TYPE_CHOICES = [
        ('NEW_MEMORIZATION', 'حفظ جديد'), 
        ('MINOR_REVIEW', 'مراجعة صغرى'), 
        ('MAJOR_REVIEW', 'مراجعة كبرى')
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attendance = models.ForeignKey(AttendanceLog, on_delete=models.CASCADE, related_name='recitations')
    student_id = models.UUIDField()
    recitation_type = models.CharField(max_length=30, choices=RECITATION_TYPE_CHOICES, default='NEW_MEMORIZATION')
    page_number = models.IntegerField(default=1)
    from_surah = models.IntegerField(null=True, blank=True)
    from_ayah = models.IntegerField(null=True, blank=True)
    to_surah = models.IntegerField(null=True, blank=True)
    to_ayah = models.IntegerField(null=True, blank=True)
    evaluation_grade = models.ForeignKey('centers_and_projects.EvaluationGrade', on_delete=models.SET_NULL, null=True, blank=True, related_name='recitations')
    grade = models.CharField(max_length=100)
    requires_repeat = models.BooleanField(default=False)
    behavior_score = models.IntegerField(default=10, null=True, blank=True)
    memorization_mistakes_count = models.IntegerField(default=0)
    tajweed_mistakes_count = models.IntegerField(default=0)
    audio_note_s3_url = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'recitation_logs'
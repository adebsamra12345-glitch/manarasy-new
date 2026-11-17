"""
تخزين محادثات وكيل منارة (في قاعدة بيانات كل مسجد حصراً — لا تُخلط بين المساجد).

الخصوصية:
- يُحفظ النص بعد إخفاء PII فقط (`text_redacted`)، ولا تُحفظ وسائط الأدوات ولا رموز الدخول.
- مدة الاحتفاظ الافتراضية 180 يوماً ثم تُحذف تلقائياً (أمر purge_agent_conversations).
- التصدير للتدريب مشروط بموافقة المسجد (AgentSettings.training_consent) وقت المحادثة ووقت التصدير،
  وبمراجعة بشرية (review_status=approved).
"""
import uuid

from django.db import models

DEFAULT_RETENTION_DAYS = 180


class AgentSettings(models.Model):
    """إعداد واحد لكل مسجد (pk=1): موافقة استخدام المحادثات لتحسين النموذج."""
    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    training_consent = models.BooleanField(default=False)
    consent_updated_by = models.CharField(max_length=64, blank=True, default='')
    consent_updated_at = models.DateTimeField(null=True, blank=True)
    retention_days = models.PositiveIntegerField(default=DEFAULT_RETENTION_DAYS)

    class Meta:
        db_table = 'ai_agent_settings'


class AgentConversation(models.Model):
    CHANNELS = [('text', 'text'), ('voice', 'voice')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.CharField(max_length=64, db_index=True)
    role = models.CharField(max_length=32)
    session_id = models.CharField(max_length=64, db_index=True)
    channel = models.CharField(max_length=8, choices=CHANNELS, default='text')
    # لقطة موافقة المسجد وقت بدء المحادثة (لا تُصدَّر محادثة بدأت قبل الموافقة)
    training_consent = models.BooleanField(default=False)
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    last_message_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        db_table = 'ai_agent_conversations'
        constraints = [
            models.UniqueConstraint(fields=['user_id', 'session_id'], name='uniq_agent_conv_user_session'),
        ]


class AgentMessage(models.Model):
    REVIEW = [('pending', 'pending'), ('approved', 'approved'), ('rejected', 'rejected')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(AgentConversation, on_delete=models.CASCADE, related_name='messages')
    seq = models.PositiveIntegerField()
    sender = models.CharField(max_length=10)  # user | assistant
    text_redacted = models.TextField()
    outcome = models.CharField(max_length=32, blank=True, default='')
    tool_calls = models.JSONField(default=list, blank=True)  # أسماء الأدوات فقط، بلا معاملات
    ui_action_types = models.JSONField(default=list, blank=True)
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # مراجعة بشرية لدورة التحسين (تُملأ لاحقاً من شاشة المراجعة)
    review_status = models.CharField(max_length=10, choices=REVIEW, default='pending', db_index=True)
    expected_tool = models.CharField(max_length=64, blank=True, default='')
    expected_args = models.JSONField(default=dict, blank=True)
    expected_answer = models.TextField(blank=True, default='')
    reviewed_by = models.CharField(max_length=64, blank=True, default='')

    class Meta:
        db_table = 'ai_agent_messages'
        ordering = ['conversation_id', 'seq']
        constraints = [
            models.UniqueConstraint(fields=['conversation', 'seq'], name='uniq_agent_msg_seq'),
        ]


class AgentFeedback(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(AgentMessage, on_delete=models.CASCADE, related_name='feedback')
    user_id = models.CharField(max_length=64)
    rating = models.SmallIntegerField()  # +1 / -1
    comment_redacted = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_agent_feedback'
        constraints = [
            models.UniqueConstraint(fields=['message', 'user_id'], name='uniq_agent_feedback_user_message'),
        ]

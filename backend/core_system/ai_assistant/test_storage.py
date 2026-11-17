"""اختبارات تخزين المحادثات (SQLite):
    cd backend && python manage.py test core_system.ai_assistant.test_storage --settings=core_system.ai_assistant.test_settings
"""
import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from . import conversations as c
from .models import AgentConversation, AgentFeedback, AgentMessage

DB = 'default'


def turn(user='u1', sid='s1', text='مرحبا', ans='أهلاً بك', **kw):
    return c.record_turn(DB, user_id=user, role='TEACHER', session_id=sid, channel='text',
                         user_text=text, assistant_text=ans, **kw)


class StorageTests(TestCase):
    databases = {'default'}

    def test_pii_is_redacted_before_storage(self):
        m = turn(text='رقمي 0991234567 وبريدي a@b.com وهويتي 10987654321', ans='<b>تم</b> 0991234567')
        user = AgentMessage.objects.get(conversation=m.conversation, sender='user')
        for bad in ('0991234567', 'a@b.com', '10987654321'):
            self.assertNotIn(bad, user.text_redacted)
        self.assertNotIn('<b>', m.text_redacted)
        self.assertNotIn('0991234567', m.text_redacted)

    def test_turns_append_with_sequence_in_same_conversation(self):
        turn(sid='s1')
        m = turn(sid='s1', text='ثانياً')
        self.assertEqual(AgentConversation.objects.count(), 1)
        self.assertEqual(m.seq, 4)
        self.assertEqual(AgentMessage.objects.count(), 4)

    def test_consent_snapshot_is_taken_at_conversation_start(self):
        turn(sid='before')
        c.set_training_consent(DB, True, 'admin1')
        turn(sid='after')
        self.assertFalse(AgentConversation.objects.get(session_id='before').training_consent)
        self.assertTrue(AgentConversation.objects.get(session_id='after').training_consent)

    def test_tool_args_are_not_stored_only_names(self):
        m = turn(tool_calls=['mark_attendance'], ui_action_types=['navigate'])
        self.assertEqual(m.tool_calls, ['mark_attendance'])
        self.assertEqual(m.ui_action_types, ['navigate'])

    def test_feedback_only_by_conversation_owner_and_upserts(self):
        m = turn(user='u1')
        with self.assertRaises(LookupError):
            c.add_feedback(DB, user_id='u2', message_id=m.id, rating=1)
        c.add_feedback(DB, user_id='u1', message_id=m.id, rating=1)
        c.add_feedback(DB, user_id='u1', message_id=m.id, rating=-1, comment='خطأ 0991234567')
        fb = AgentFeedback.objects.get()
        self.assertEqual(fb.rating, -1)
        self.assertNotIn('0991234567', fb.comment_redacted)
        with self.assertRaises(ValueError):
            c.add_feedback(DB, user_id='u1', message_id=m.id, rating=5)

    def test_feedback_on_user_message_is_rejected(self):
        m = turn()
        user_msg = AgentMessage.objects.get(conversation=m.conversation, sender='user')
        with self.assertRaises(LookupError):
            c.add_feedback(DB, user_id='u1', message_id=user_msg.id, rating=1)

    def test_user_can_delete_own_history_only(self):
        turn(user='u1'); turn(user='u2', sid='x')
        self.assertEqual(c.delete_user_conversations(DB, 'u1'), 1)
        self.assertEqual(AgentMessage.objects.filter(conversation__user_id='u1').count(), 0)
        self.assertEqual(AgentConversation.objects.filter(user_id='u2').count(), 1)
        self.assertEqual(AgentConversation.objects.filter(user_id='u1').count(), 0)

    def test_retention_180_days_purge(self):
        turn(sid='old'); turn(sid='new')
        AgentConversation.objects.filter(session_id='old').update(last_message_at=timezone.now() - timedelta(days=181))
        self.assertEqual(c.get_agent_settings(DB).retention_days, 180)
        self.assertEqual(c.purge_expired(DB), 1)
        self.assertEqual(list(AgentConversation.objects.values_list('session_id', flat=True)), ['new'])

    def test_pseudonymize_names_consistently(self):
        out, mp = c.pseudonymize('سجل حضور أسامة الزين، وأسامة غائب', ['أسامة الزين'])
        self.assertNotIn('أسامة', out)
        self.assertNotIn('الزين', out)
        out2, _ = c.pseudonymize('أسامة', ['أسامة الزين'], mp)
        self.assertIn('{{PERSON_', out2)


class TrainingRecordTests(TestCase):
    databases = {'default'}

    def test_record_is_pseudonymized_and_uses_review_correction(self):
        a = turn(text='سجل حضور أسامة الزين', ans='سأسجل حضور أسامة الزين')
        user = AgentMessage.objects.get(conversation=a.conversation, sender='user')
        a.expected_tool = 'mark_attendance'
        a.expected_args = {'student_query': 'أسامة الزين', 'status': 'present'}
        rec = c.build_training_record(user, a, ['أسامة الزين'], 0)
        dumped = json.dumps(rec, ensure_ascii=False)
        self.assertNotIn('أسامة', dumped)
        self.assertNotIn('الزين', dumped)
        call = rec['messages'][1]['tool_calls'][0]['function']
        self.assertEqual(call['name'], 'mark_attendance')
        self.assertEqual(json.loads(call['arguments'])['status'], 'present')
        self.assertEqual(rec['category'], 'flywheel')


class ReviewTests(TestCase):
    databases = {'default'}

    def setUp(self):
        c.set_training_consent(DB, True, 'admin')

    def test_queue_only_includes_consented_conversations_and_orders_worst_first(self):
        ok = turn(sid='a', ans='رد عادي')
        bad = turn(sid='b', ans='رد سيئ')
        c.add_feedback(DB, user_id='u1', message_id=bad.id, rating=-1)
        c.add_feedback(DB, user_id='u1', message_id=ok.id, rating=1)
        AgentConversation.objects.filter(session_id='a').update(training_consent=True)
        q = c.list_review_queue(DB)
        self.assertEqual([r['assistant_text'] for r in q], ['رد سيئ', 'رد عادي'])
        AgentConversation.objects.update(training_consent=False)
        self.assertEqual(c.list_review_queue(DB), [])

    def test_review_sets_status_and_redacts_corrections(self):
        m = turn(sid='x')
        AgentConversation.objects.update(training_consent=True)
        r = c.review_message(DB, message_id=m.id, reviewer_id='admin', status='approved',
                             expected_tool='open_screen', expected_args={'screen': 'students'},
                             expected_answer='افتح تبويب الطلاب 0991234567')
        self.assertEqual((r.review_status, r.expected_tool, r.expected_args), ('approved', 'open_screen', {'screen': 'students'}))
        self.assertNotIn('0991234567', r.expected_answer)
        self.assertEqual(c.list_review_queue(DB), [])

    def test_review_rejects_bad_input_and_unconsented(self):
        m = turn(sid='y')
        AgentConversation.objects.update(training_consent=False)
        with self.assertRaises(LookupError):  # محادثة بلا موافقة
            c.review_message(DB, message_id=m.id, reviewer_id='a', status='approved')
        AgentConversation.objects.update(training_consent=True)
        with self.assertRaises(ValueError):
            c.review_message(DB, message_id=m.id, reviewer_id='a', status='maybe')
        with self.assertRaises(ValueError):
            c.review_message(DB, message_id=m.id, reviewer_id='a', status='approved', expected_tool='Bad Tool!')

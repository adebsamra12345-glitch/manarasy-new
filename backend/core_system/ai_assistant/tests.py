"""
اختبارات وحدات وتكامل لطبقة الذكاء الاصطناعي في Django (core_system/ai_assistant/tests.py):
- جميع الاختبارات تستخدم Mock بدون لمس أي قاعدة بيانات إنتاجية.
- تختبر:
  1. حذف الـ PII وتقليل البيانات قبل إرسالها للـ Orchestrator.
  2. تعقيم المخرجات ضد XSS.
  3. أعلام الميزات (Feature Flags).
  4. السقوط الآمن (Graceful Degradation) عند إطفاء الـ Orchestrator أو بطئه.
  5. صلاحيات الأدوار وعزل بيانات الطلاب (RBAC: الطالب لا يرى بيانات طالب آخر، والمعلم لا يرى خارج حلقته).
"""
from types import SimpleNamespace
from unittest.mock import patch
from django.test import SimpleTestCase, RequestFactory, override_settings

from .sanitizer import minimize_payload, sanitize_output_for_ui
from .client import OrchestratorClient
from .views import _can_access_student


class SanitizerAndPrivacyTests(SimpleTestCase):
    def test_minimize_payload_strips_pii_fields_and_redacts_numbers(self):
        raw = {
            "student_name": "خالد يوسف",
            "national_id": "10987654321",
            "father_phone": "0991234567",
            "mother_phone": "+963991112233",
            "monthly_income": 400,
            "is_orphan": True,
            "current_residence": "دمشق - المزة",
            "notes": "تواصل مع ولي الأمر على 0991234567 أو البريد test@example.com وهويته 10987654321",
            "nested": [{"phone": "0990000000", "grade": "ممتاز"}],
        }
        cleaned = minimize_payload(raw)
        self.assertNotIn("national_id", cleaned)
        self.assertNotIn("father_phone", cleaned)
        self.assertNotIn("mother_phone", cleaned)
        self.assertNotIn("monthly_income", cleaned)
        self.assertNotIn("is_orphan", cleaned)
        self.assertNotIn("current_residence", cleaned)
        self.assertNotIn("phone", cleaned["nested"][0])
        self.assertEqual(cleaned["nested"][0]["grade"], "ممتاز")
        self.assertNotIn("0991234567", cleaned["notes"])
        self.assertNotIn("10987654321", cleaned["notes"])
        self.assertNotIn("test@example.com", cleaned["notes"])

    def test_sanitize_output_for_ui_blocks_xss(self):
        malicious = '<script>alert("xss")</script>مرحباً <img src=x onerror=alert(1)>بك'
        safe = sanitize_output_for_ui(malicious)
        self.assertNotIn("<script>", safe)
        self.assertNotIn("<img", safe)
        self.assertIn("مرحباً", safe)


class OrchestratorClientResilienceTests(SimpleTestCase):
    @override_settings(
        ORCHESTRATOR_BASE_URL="http://127.0.0.1:59999",  # منفذ غير مشغّل لمحاكاة انطفاء جهاز الـ AI
        ORCHESTRATOR_SERVICE_KEY="test-key",
        ORCHESTRATOR_TIMEOUT_SECONDS=0.2,
    )
    def test_graceful_fallback_when_orchestrator_is_offline(self):
        client = OrchestratorClient()
        res_chat = client.chat(
            message="كيف حال الحلقة؟",
            user_id="u1",
            role="TEACHER",
            tenant_id="t1",
        )
        self.assertFalse(res_chat["ai_available"])
        self.assertIn("غير متاح", res_chat["answer"])

        res_note = client.generate_evaluation_note(
            recitation_type="حفظ جديد",
            target_unit="صفحة 12",
            grade="ممتاز",
            user_id="u1",
            role="TEACHER",
            tenant_id="t1",
        )
        self.assertFalse(res_note["ai_available"])
        self.assertIn("صفحة 12", res_note["note"])

    @override_settings(
        AI_FEATURE_FLAGS={
            "MASTER_ENABLED": True,
            "ASSISTANT_CHAT": False,
        }
    )
    def test_feature_flag_disables_specific_feature_cleanly(self):
        client = OrchestratorClient()
        res = client.chat(
            message="مرحباً",
            user_id="u1",
            role="TEACHER",
            tenant_id="t1",
        )
        self.assertFalse(res["ai_available"])
        self.assertFalse(res["feature_enabled"])


class RoleBasedStudentIsolationTests(SimpleTestCase):
    def test_student_cannot_access_another_student_data(self):
        profile_s1 = SimpleNamespace(user_id="uuid-student-1", center_id=None)
        student_1 = SimpleNamespace(user_id="uuid-student-1", halaqa_id="h1")
        student_2 = SimpleNamespace(user_id="uuid-student-2", halaqa_id="h1")

        self.assertTrue(_can_access_student("db_test", profile_s1, "STUDENT", student_1))
        self.assertFalse(_can_access_student("db_test", profile_s1, "STUDENT", student_2))

    @patch("core_system.ai_assistant.views._allowed_halaqa_ids_for_profile")
    def test_teacher_can_only_access_students_in_own_halaqat(self, mock_allowed):
        mock_allowed.return_value = ["halaqa-10"]
        teacher_profile = SimpleNamespace(user_id="uuid-teacher-1", center_id=None)

        class DummyEnrollments:
            def using(self, _db):
                return self

            def filter(self, **_kw):
                return self

            def exists(self):
                return False

        student_in_ring = SimpleNamespace(user_id="u-s1", halaqa_id="halaqa-10", enrollments=DummyEnrollments())
        student_other_ring = SimpleNamespace(user_id="u-s2", halaqa_id="halaqa-99", enrollments=DummyEnrollments())

        self.assertTrue(_can_access_student("db_test", teacher_profile, "TEACHER", student_in_ring))
        self.assertFalse(_can_access_student("db_test", teacher_profile, "TEACHER", student_other_ring))


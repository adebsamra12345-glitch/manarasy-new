import json
from unittest import mock
from django.test import SimpleTestCase, RequestFactory
from tenant_modules.agent import views


def call(text, role="TEACHER", students=None):
    req = RequestFactory().post('/api/agent/command/', data=json.dumps({"text": text}), content_type='application/json')
    with mock.patch.object(views, 'get_token_payload', return_value={"role": role}), \
         mock.patch.object(views, 'get_tenant_db', return_value='db'), \
         mock.patch.object(views, '_resolve_student', return_value=students or []), \
         mock.patch.object(views, '_resolve_halaqa', return_value=None):
        r = views.agent_command_view(req)
    return r.status_code, json.loads(r.content)


class AgentCommandTests(SimpleTestCase):
    def test_navigate(self):
        c, d = call("افتح التسميع")
        self.assertEqual((c, d["action"]["route"]), (200, "/teacher/recitation"))

    def test_permission_denied(self):
        _, d = call("افتح المستخدمين", role="TEACHER")
        self.assertEqual(d["intent"], "permission_denied")

    def test_student_resolved_route(self):
        _, d = call("افتح نشاط أحمد", students=[{"id": "11111111-1111-1111-1111-111111111111", "name": "أحمد", "halaqa": "x"}])
        self.assertEqual(d["action"]["route"], "/teacher/students/11111111-1111-1111-1111-111111111111/activity")

    def test_unknown_student_clarifies(self):
        _, d = call("افتح نشاط أحمد", students=[])
        self.assertEqual(d["intent"], "clarify")

    def test_ambiguous_student_choice(self):
        _, d = call("سجل أحمد حاضر", students=[{"id": "a", "name": "أحمد 1", "halaqa": "x"}, {"id": "b", "name": "أحمد 2", "halaqa": "y"}])
        self.assertTrue(d.get("needs_choice"))

    def test_confirmation_flag(self):
        _, d = call("اخرج")
        self.assertTrue(d["requires_confirmation"])

    def test_empty_and_auth(self):
        self.assertEqual(call("  ")[0], 400)

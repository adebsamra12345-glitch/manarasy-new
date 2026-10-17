"""اختبارات أمان لا تحتاج قاعدة بيانات: ربط التوكن بالمسجد، حماية النسخ الاحتياطي، ديكوريتر tenant_auth."""
import json
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest import mock

import jwt
from django.conf import settings
from django.http import JsonResponse
from django.test import RequestFactory, SimpleTestCase

from core_system.auth import tenant_auth, STAFF_ROLES
from core_system.middleware import TenantJWTAuthMiddleware


def _token(**extra):
    payload = {'user_id': 'u1', 'tenant_id': 'tenant-A', 'exp': datetime.utcnow() + timedelta(minutes=5)}
    payload.update(extra)
    return jwt.encode(payload, getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY), algorithm='HS256')


def _ok(request):
    return JsonResponse({'ok': True})


class BackupsAuthTests(SimpleTestCase):
    def test_backups_requires_platform_admin(self):
        from core_system.backups.views import backup_list_create_view
        for method in ('get', 'post'):
            req = getattr(RequestFactory(), method)('/api/backups/')
            self.assertEqual(backup_list_create_view(req).status_code, 401)


class TenantAuthDecoratorTests(SimpleTestCase):
    def _req(self, profile=None, tenant=SimpleNamespace(db_name='x')):
        req = RequestFactory().get('/x/')
        req.profile, req.tenant = profile, tenant
        return req

    def test_anonymous_rejected(self):
        self.assertEqual(tenant_auth(STAFF_ROLES)(_ok)(self._req()).status_code, 401)

    def test_missing_tenant_rejected(self):
        prof = SimpleNamespace(is_active=True, get_roles=lambda: ['TEACHER'])
        self.assertEqual(tenant_auth(STAFF_ROLES)(_ok)(self._req(prof, tenant=None)).status_code, 400)

    def test_student_forbidden_teacher_allowed(self):
        student = SimpleNamespace(is_active=True, get_roles=lambda: ['STUDENT'])
        teacher = SimpleNamespace(is_active=True, get_roles=lambda: ['TEACHER'])
        view = tenant_auth(STAFF_ROLES)(_ok)
        self.assertEqual(view(self._req(student)).status_code, 403)
        self.assertEqual(view(self._req(teacher)).status_code, 200)


class TenantBindingTests(SimpleTestCase):
    def _run(self, tenant_obj, token):
        mw = TenantJWTAuthMiddleware(lambda r: JsonResponse({'ok': True}))
        req = RequestFactory().get('/api/halaqat/', HTTP_TENANT_ID='whatever', HTTP_AUTHORIZATION=f'Bearer {token}')
        with mock.patch('core_system.tenants.models.Tenant') as T, \
                mock.patch('tenant_modules.users.models.UserProfile') as UP:
            T.objects.using.return_value.filter.return_value.first.return_value = tenant_obj
            UP.objects.using.return_value.select_related.return_value.get.return_value = 'PROFILE'
            return mw(req)

    def test_token_from_other_tenant_rejected(self):
        tenant_b = SimpleNamespace(id='tenant-B', db_name='default')
        self.assertEqual(self._run(tenant_b, _token()).status_code, 403)

    def test_token_for_same_tenant_passes(self):
        tenant_a = SimpleNamespace(id='tenant-A', db_name='default')
        self.assertEqual(self._run(tenant_a, _token()).status_code, 200)


class LoginThrottleTests(SimpleTestCase):
    def test_login_locked_after_max_failures(self):
        from django.core.cache import cache
        from core_system.tenants.views import tenant_login_view
        cache.clear()
        body = json.dumps({'subdomain': 'nomosque', 'username': 'u', 'password': 'bad'})
        key = 'tenant_login_fail:127.0.0.1:nomosque:u'
        cache.set(key, 5, 60)
        req = RequestFactory().post('/api/tenants/login/', data=body, content_type='application/json',
                                    REMOTE_ADDR='127.0.0.1')
        self.assertEqual(tenant_login_view(req).status_code, 429)
        cache.clear()


class ModulesRequireAuthTests(SimpleTestCase):
    def test_unauthenticated_requests_get_401(self):
        from tenant_modules.points_and_rewards import views as pv
        from tenant_modules.reports_and_certificates import views as rv
        from tenant_modules.students_and_parents import views as sv
        rf = RequestFactory()
        cases = [(pv.student_points_list_view, '/p/'), (pv.student_portal_dashboard_view, '/p/'),
                 (rv.analytics_summary_view, '/r/'), (rv.reports_data_view, '/r/'),
                 (sv.student_list_create_view, '/s/'), (sv.student_detail_view, '/s/')]
        for view, url in cases:
            req = rf.get(url)
            req.profile, req.tenant = None, None
            args = (('00000000-0000-0000-0000-000000000000',) if view is sv.student_detail_view else ())
            self.assertEqual(view(req, *args).status_code, 401, view.__name__)

    def test_reports_forbidden_for_students(self):
        from tenant_modules.reports_and_certificates.views import reports_data_view
        req = RequestFactory().get('/r/')
        req.profile = SimpleNamespace(is_active=True, get_roles=lambda: ['STUDENT'])
        req.tenant = SimpleNamespace(db_name='x')
        self.assertEqual(reports_data_view(req).status_code, 403)

    def test_get_tenant_db_requires_tenant(self):
        from core_system.auth import get_tenant_db
        req = RequestFactory().get('/x/')
        req.tenant = None
        with self.assertRaises(ValueError):
            get_tenant_db(req)
        req.tenant = SimpleNamespace(db_name='mosque_db')
        self.assertEqual(get_tenant_db(req), 'mosque_db')


class ImageProxySsrfTests(SimpleTestCase):
    def test_internal_urls_rejected(self):
        from core_system.net import is_public_http_url
        for url in ('http://127.0.0.1/x.png', 'http://localhost/x.png', 'http://169.254.169.254/latest',
                    'http://10.0.0.5/x.png', 'file:///etc/passwd', 'ftp://example.com/x.png', 'not a url'):
            self.assertFalse(is_public_http_url(url), url)

    def test_proxy_view_blocks_internal_url(self):
        from tenant_modules.points_and_rewards.views import image_proxy_view
        req = RequestFactory().get('/proxy-image/', {'url': 'http://127.0.0.1:8000/secret'})
        self.assertEqual(image_proxy_view(req).status_code, 400)

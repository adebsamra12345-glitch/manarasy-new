"""اختبارات refresh/logout (بدون قاعدة بيانات حقيقية): الكوكي، CSRF، الإبطال، رفض أنواع التوكن الخاطئة."""
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest import mock

import jwt
from django.conf import settings
from django.core.cache import cache
from django.test import RequestFactory, SimpleTestCase

from core_system.tenants import session_views as sv

H = {'HTTP_X_REQUESTED_WITH': 'XMLHttpRequest'}
TENANT = SimpleNamespace(id='t-1', subdomain='alhuda', db_name='default', db_user=None,
                         db_password_hash=None, db_host=None, db_port=None)


def _rt(**extra):
    p = {'typ': 'refresh', 'sid': 's1', 'tenant_id': 't-1', 'user_id': '7', 'username': 'ali',
         'exp': datetime.utcnow() + timedelta(days=1)}
    p.update(extra)
    return jwt.encode(p, sv._secret(), algorithm='HS256')


def _post(path, cookie=None, headers=H):
    rf = RequestFactory()
    req = rf.post(path, **headers)
    if cookie:
        req.COOKIES[sv.REFRESH_COOKIE] = cookie
    req.tenant = None
    return req


class RefreshViewTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_requires_post(self):
        self.assertEqual(sv.tenant_refresh_view(RequestFactory().get('/x')).status_code, 405)

    def test_requires_csrf_header(self):
        self.assertEqual(sv.tenant_refresh_view(_post('/x', _rt(), headers={})).status_code, 403)

    def test_no_cookie_401(self):
        self.assertEqual(sv.tenant_refresh_view(_post('/x')).status_code, 401)

    def test_access_token_is_not_accepted_as_refresh(self):
        access = jwt.encode({'user_id': '7', 'tenant_id': 't-1', 'exp': datetime.utcnow() + timedelta(minutes=5)},
                            getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY), algorithm='HS256')
        self.assertEqual(sv.tenant_refresh_view(_post('/x', access)).status_code, 401)

    def test_expired_refresh_401(self):
        tok = _rt(exp=datetime.utcnow() - timedelta(seconds=5))
        self.assertEqual(sv.tenant_refresh_view(_post('/x', tok)).status_code, 401)

    def test_tenant_mismatch_401(self):
        req = _post('/x', _rt())
        req.tenant = SimpleNamespace(id='other')
        self.assertEqual(sv.tenant_refresh_view(req).status_code, 401)

    def test_success_issues_access_and_rotates_cookie(self):
        user = SimpleNamespace(id=7, username='ali', first_name='A', last_name='B')
        profile = SimpleNamespace(is_active=True, role='TEACHER', get_roles=lambda: ['TEACHER'], center=None)
        with mock.patch.object(sv.Tenant.objects, 'filter') as f, \
                mock.patch('django.contrib.auth.get_user_model') as gum, \
                mock.patch('tenant_modules.users.models.UserProfile') as UP:
            f.return_value.first.return_value = TENANT
            gum.return_value.objects.using.return_value.get.return_value = user
            gum.return_value.DoesNotExist = type('DNE', (Exception,), {})
            UP.DoesNotExist = type('PDNE', (Exception,), {})
            UP.objects.using.return_value.select_related.return_value.get.return_value = profile
            resp = sv.tenant_refresh_view(_post('/x', _rt()))
        self.assertEqual(resp.status_code, 200)
        cookie = resp.cookies[sv.REFRESH_COOKIE]
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['samesite'], 'Strict')
        self.assertEqual(cookie['path'], sv.COOKIE_PATH)
        new_rt = jwt.decode(cookie.value, sv._secret(), algorithms=['HS256'])
        self.assertEqual(new_rt['sid'], 's1')      # نفس عائلة الجلسة
        self.assertEqual(new_rt['typ'], 'refresh')


class LogoutRevocationTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_logout_revokes_session_family(self):
        tok = _rt()
        resp = sv.tenant_logout_view(_post('/x', tok))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.cookies[sv.REFRESH_COOKIE].value, '')   # الكوكي ممسوح
        # بعد الخروج لا يصلح نفس الـ refresh للتجديد
        self.assertEqual(sv.tenant_refresh_view(_post('/x', tok)).status_code, 401)

    def test_logout_requires_csrf_header(self):
        self.assertEqual(sv.tenant_logout_view(_post('/x', _rt(), headers={})).status_code, 403)

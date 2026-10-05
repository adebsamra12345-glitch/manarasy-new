"""
اختبارات مسار التسجيل اليدوي + أدمن المنصة.
التشغيل:  python manage.py test core_system.registrations platform_auth
(تحتاج PostgreSQL بصلاحية CREATEDB لإنشاء قاعدة الاختبار. عملية إنشاء قاعدة المسجد الفعلية تُحاكى بـ mock.)
"""
import io
import shutil
import tempfile
from datetime import timedelta
from unittest import mock

import jwt
from django.conf import settings
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core_system.payments.models import PaymentTransaction
from core_system.registrations.models import PaymentReceipt, RegistrationRequest
from core_system.subscriptions.models import Plan, Subscription
from core_system.tenants.models import Tenant
from platform_auth.authentication import issue_platform_token
from platform_auth.models import PlatformAdmin

PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 64
PDF = b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'
TMP = tempfile.mkdtemp(prefix='manara-test-receipts-')
GOOD_PW = 'Str0ng-Passw0rd!x'


def _file(name, data, ctype='application/octet-stream'):
    f = io.BytesIO(data)
    f.name = name
    return f


@override_settings(PRIVATE_MEDIA_ROOT=TMP, PROVISIONING_ASYNC=False,
                   CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
class RegistrationFlowTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP, ignore_errors=True)

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.plan = Plan.objects.create(name='أساسية', code='M_BASIC_30', billing_cycle='MONTHLY', price_usd='30.00')
        self.admin = PlatformAdmin.objects.create_user('root@manara.test', GOOD_PW)
        self.client = APIClient()
        self.payload = {
            'mosque_name': 'مسجد الهدى', 'subdomain': 'alhuda', 'contact_phone': '+963 944 111 222',
            'contact_email': 'a@b.co', 'admin_password': GOOD_PW, 'plan_id': self.plan.id,
        }

    # ---------- helpers
    def _register(self, **over):
        r = self.client.post('/api/public/registrations/', {**self.payload, **over}, format='json')
        return r

    def _auth(self):
        tok = issue_platform_token(self.admin)['access_token']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tok}')

    def _registered_with_receipt(self, data=PNG, name='r.png'):
        r = self._register()
        self.assertEqual(r.status_code, 201, r.content)
        rid, token = r.data['data']['id'], r.data['data']['upload_token']
        up = self.client.post(f'/api/public/registrations/{rid}/receipt/', {'file': _file(name, data)},
                              format='multipart', HTTP_X_UPLOAD_TOKEN=token)
        return rid, token, up

    # ---------- public registration
    def test_register_creates_pending_payment_and_hashes_password(self):
        r = self._register()
        self.assertEqual(r.status_code, 201)
        req = RegistrationRequest.objects.get(pk=r.data['data']['id'])
        self.assertEqual(req.status, 'PENDING_PAYMENT')
        self.assertNotIn(GOOD_PW, req.admin_password_hash)
        self.assertEqual(req.amount_usd, self.plan.price_usd)
        self.assertFalse(Tenant.objects.exists())          # لا مسجد قبل الموافقة

    def test_register_rejects_bad_subdomain_and_weak_password(self):
        self.assertEqual(self._register(subdomain='www').status_code, 400)
        self.assertEqual(self._register(subdomain='a;drop table').status_code, 400)
        self.assertEqual(self._register(admin_password='12345678').status_code, 400)

    def test_honeypot_blocks_bots(self):
        self.assertEqual(self._register(website='http://spam').status_code, 400)

    def test_client_cannot_choose_db_name_or_price(self):
        r = self._register(db_name='postgres', amount_usd='0.01')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(RegistrationRequest.objects.get().amount_usd, self.plan.price_usd)

    def test_duplicate_subdomain_rejected(self):
        self.assertEqual(self._register().status_code, 201)
        self.assertEqual(self._register().status_code, 400)

    # ---------- receipt upload
    def test_valid_png_and_pdf_accepted_and_status_moves(self):
        rid, token, up = self._registered_with_receipt()
        self.assertEqual(up.status_code, 201, up.content)
        self.assertEqual(RegistrationRequest.objects.get(pk=rid).status, 'PENDING_APPROVAL')
        r2 = self.client.post(f'/api/public/registrations/{rid}/receipt/', {'file': _file('p.pdf', PDF)},
                              format='multipart', HTTP_X_UPLOAD_TOKEN=token)
        self.assertEqual(r2.status_code, 201, r2.content)

    def test_upload_requires_valid_token(self):
        rid, token, _ = self._registered_with_receipt()
        r = self.client.post(f'/api/public/registrations/{rid}/receipt/', {'file': _file('x.png', PNG + b'1')},
                             format='multipart', HTTP_X_UPLOAD_TOKEN='wrong')
        self.assertEqual(r.status_code, 404)
        r = self.client.post(f'/api/public/registrations/{rid}/receipt/', {'file': _file('x.png', PNG + b'1')},
                             format='multipart')
        self.assertEqual(r.status_code, 404)

    def test_disguised_file_rejected(self):
        _, _, up = self._registered_with_receipt(data=b'<?php system($_GET[0]); ?>', name='shell.png')
        self.assertEqual(up.status_code, 400)
        self.assertFalse(PaymentReceipt.objects.exists())

    def test_wrong_extension_and_mismatch_rejected(self):
        _, _, up = self._registered_with_receipt(data=PNG, name='x.exe')
        self.assertEqual(up.status_code, 400)
        _, _, up = self._registered_with_receipt(data=PDF, name='x.png')     # PDF متنكر كـ PNG
        self.assertEqual(up.status_code, 400)

    def test_oversize_rejected(self):
        with override_settings(RECEIPT_MAX_BYTES=100):
            _, _, up = self._registered_with_receipt(data=PNG + b'0' * 500)
        self.assertEqual(up.status_code, 400)

    def test_pdf_with_javascript_rejected(self):
        bad = b'%PDF-1.4\n<< /JavaScript (app.alert(1)) >>\n%%EOF\n'
        _, _, up = self._registered_with_receipt(data=bad, name='x.pdf')
        self.assertEqual(up.status_code, 400)

    def test_same_receipt_cannot_be_reused_by_another_request(self):
        self._registered_with_receipt()
        r = self._register(subdomain='another')
        rid, token = r.data['data']['id'], r.data['data']['upload_token']
        up = self.client.post(f'/api/public/registrations/{rid}/receipt/', {'file': _file('r.png', PNG)},
                              format='multipart', HTTP_X_UPLOAD_TOKEN=token)
        self.assertEqual(up.status_code, 409)

    # ---------- platform auth separation
    def test_platform_endpoints_need_platform_token(self):
        self.assertEqual(self.client.get('/api/platform/registrations/').status_code, 401)
        tenant_token = jwt.encode({'user_id': '1', 'role': 'TENANT_ADMIN', 'exp': timezone.now() + timedelta(hours=1)},
                                  getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY), algorithm='HS256')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tenant_token}')
        self.assertEqual(self.client.get('/api/platform/registrations/').status_code, 401)

    def test_platform_token_not_valid_for_other_scope_or_after_logout(self):
        self._auth()
        self.assertEqual(self.client.get('/api/platform/registrations/').status_code, 200)
        self.assertEqual(self.client.post('/api/platform/auth/logout/').status_code, 200)
        self.assertEqual(self.client.get('/api/platform/registrations/').status_code, 401)   # token_version تغيّر

    def test_login_lockout(self):
        c = APIClient()
        for _ in range(settings.PLATFORM_LOGIN_MAX_FAILURES):
            r = c.post('/api/platform/auth/login/', {'email': self.admin.email, 'password': 'nope'}, format='json')
            self.assertEqual(r.status_code, 401)
        r = c.post('/api/platform/auth/login/', {'email': self.admin.email, 'password': GOOD_PW}, format='json')
        self.assertEqual(r.status_code, 429)

    def test_login_success_returns_token(self):
        r = APIClient().post('/api/platform/auth/login/', {'email': self.admin.email, 'password': GOOD_PW}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('access_token', r.data['data'])

    def test_legacy_open_endpoints_are_now_protected(self):
        self.assertEqual(self.client.get('/api/tenants/').status_code, 401)
        self.assertEqual(self.client.post('/api/tenants/', {}, format='json').status_code, 401)
        self.assertEqual(self.client.get('/api/payments/').status_code, 401)
        self.assertEqual(self.client.get('/api/subscriptions/').status_code, 401)
        r = self.client.post('/api/payments/sham-cash/webhook/', {'transaction_id': 'x'}, format='json')
        self.assertEqual(r.status_code, 403)

    # ---------- approve / reject
    @mock.patch('core_system.registrations.services.create_tenant_database')
    def test_approve_provisions_and_activates(self, prov):
        rid, _, _ = self._registered_with_receipt()
        self._auth()
        r = self.client.post(f'/api/platform/registrations/{rid}/approve/')
        self.assertEqual(r.status_code, 200, r.content)
        prov.assert_called_once()
        req = RegistrationRequest.objects.get(pk=rid)
        self.assertEqual(req.status, 'APPROVED')
        self.assertEqual(req.admin_password_hash, '')
        tenant = Tenant.objects.get(subdomain='alhuda')
        self.assertTrue(tenant.is_active)
        self.assertEqual(tenant.db_name, 'db_alhuda')
        self.assertEqual(Subscription.objects.get(tenant=tenant).status, 'ACTIVE')
        self.assertEqual(PaymentTransaction.objects.get().status, 'SUCCESS')

    @mock.patch('core_system.registrations.services.create_tenant_database')
    def test_double_approve_conflicts(self, prov):
        rid, _, _ = self._registered_with_receipt()
        self._auth()
        self.assertEqual(self.client.post(f'/api/platform/registrations/{rid}/approve/').status_code, 200)
        self.assertEqual(self.client.post(f'/api/platform/registrations/{rid}/approve/').status_code, 409)
        self.assertEqual(prov.call_count, 1)

    def test_cannot_approve_without_receipt(self):
        rid = self._register().data['data']['id']
        self._auth()
        self.assertEqual(self.client.post(f'/api/platform/registrations/{rid}/approve/').status_code, 409)

    @mock.patch('core_system.registrations.services.create_tenant_database')
    def test_failed_provisioning_leaves_tenant_inactive_and_can_retry(self, prov):
        from core_system.tenants.provisioning import ProvisioningError
        prov.side_effect = ProvisioningError('boom')
        rid, _, _ = self._registered_with_receipt()
        self._auth()
        r = self.client.post(f'/api/platform/registrations/{rid}/approve/')
        self.assertEqual(r.status_code, 500)
        req = RegistrationRequest.objects.get(pk=rid)
        self.assertEqual(req.status, 'PROVISIONING_FAILED')
        self.assertFalse(Tenant.objects.get(subdomain='alhuda').is_active)
        prov.side_effect = None
        self.assertEqual(self.client.post(f'/api/platform/registrations/{rid}/retry/').status_code, 200)
        self.assertTrue(Tenant.objects.get(subdomain='alhuda').is_active)

    def test_reject_requires_reason_and_frees_subdomain(self):
        rid, _, _ = self._registered_with_receipt()
        self._auth()
        self.assertEqual(self.client.post(f'/api/platform/registrations/{rid}/reject/', {'reason': 'x'}, format='json').status_code, 400)
        r = self.client.post(f'/api/platform/registrations/{rid}/reject/', {'reason': 'الإيصال غير واضح'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self._register().status_code, 201)       # الاسم صار متاحاً

    def test_receipt_download_only_for_platform_admin_with_safe_headers(self):
        rid, _, _ = self._registered_with_receipt()
        receipt = PaymentReceipt.objects.get()
        url = f'/api/platform/registrations/{rid}/receipts/{receipt.id}/'
        self.assertEqual(APIClient().get(url).status_code, 401)
        self._auth()
        r = self.client.get(url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r['Content-Type'], 'image/png')
        self.assertEqual(r['X-Content-Type-Options'], 'nosniff')
        self.assertIn('sandbox', r['Content-Security-Policy'])
        self.assertNotIn('..', receipt.file.name)

    # ---------- manual creation
    @mock.patch('core_system.registrations.services.create_tenant_database')
    def test_manual_mosque_creation_without_payment(self, prov):
        self._auth()
        r = self.client.post('/api/platform/mosques/', {
            'mosque_name': 'مسجد النور', 'subdomain': 'alnoor', 'contact_phone': '0944111222',
            'admin_username': 'imam', 'plan_id': self.plan.id}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(r.data['data']['generated_password'])
        self.assertTrue(Tenant.objects.get(subdomain='alnoor').is_active)
        self.assertFalse(PaymentTransaction.objects.exists())       # لا دفعة في المسار اليدوي
        kwargs = prov.call_args.kwargs
        self.assertEqual(kwargs['admin_username'], 'imam')
        self.assertTrue(kwargs['admin_password_hash'].startswith(('pbkdf2_', 'argon2', 'bcrypt')))

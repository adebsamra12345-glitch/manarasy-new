from types import SimpleNamespace

from django.test import RequestFactory


class StaffRequestFactory(RequestFactory):
    """RequestFactory يحاكي ما يجهّزه TenantJWTAuthMiddleware (profile + tenant) لمستخدم TENANT_ADMIN،
    لأن الـ views تُستدعى مباشرة دون المرور بالـ middleware بعد إضافة @tenant_auth."""

    def __init__(self, tenant, roles=('TENANT_ADMIN',), **defaults):
        super().__init__(**defaults)
        self.tenant = tenant
        self.profile = SimpleNamespace(is_active=True, role=roles[0], get_roles=lambda: list(roles))

    def generic(self, *args, **kwargs):
        request = super().generic(*args, **kwargs)
        request.tenant = self.tenant
        request.profile = self.profile
        request.db_name = self.tenant.db_name
        request.auth_error = None
        return request

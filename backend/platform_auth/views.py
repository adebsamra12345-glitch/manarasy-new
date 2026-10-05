from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .authentication import IsPlatformAdmin, PlatformJWTAuthentication, issue_platform_token
from .models import PlatformAdmin

# يُستخدم للمقارنة الوهمية كي لا يُكشف وجود/عدم وجود البريد من زمن الاستجابة
_DUMMY_HASH = make_password('not-a-real-password')
_GENERIC_FAIL = 'البريد الإلكتروني أو كلمة المرور غير صحيحة'


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(max_length=256, trim_whitespace=False)


class PlatformLoginView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'platform_login'

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data['email'].strip().lower()
        password = ser.validated_data['password']

        with transaction.atomic():
            admin = PlatformAdmin.objects.select_for_update().filter(email=email).first()

            if admin is None:
                check_password(password, _DUMMY_HASH)
                return Response({'status': 'error', 'message': _GENERIC_FAIL}, status=status.HTTP_401_UNAUTHORIZED)

            if admin.is_locked:
                return Response(
                    {'status': 'error', 'message': 'الحساب مقفل مؤقتاً بسبب محاولات فاشلة متكررة، حاول لاحقاً'},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            if not admin.is_active or not admin.check_password(password):
                if admin.is_active:
                    admin.failed_login_count += 1
                    if admin.failed_login_count >= settings.PLATFORM_LOGIN_MAX_FAILURES:
                        admin.locked_until = timezone.now() + timedelta(minutes=settings.PLATFORM_LOGIN_LOCK_MINUTES)
                        admin.failed_login_count = 0
                    admin.save(update_fields=['failed_login_count', 'locked_until'])
                return Response({'status': 'error', 'message': _GENERIC_FAIL}, status=status.HTTP_401_UNAUTHORIZED)

            admin.failed_login_count = 0
            admin.locked_until = None
            admin.last_login = timezone.now()
            admin.save(update_fields=['failed_login_count', 'locked_until', 'last_login'])

        data = issue_platform_token(admin)
        data['admin'] = {'id': str(admin.pk), 'email': admin.email, 'full_name': admin.full_name}
        return Response({'status': 'success', 'data': data})


class _PlatformBase(APIView):
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]


class PlatformMeView(_PlatformBase):
    def get(self, request):
        a = request.user
        return Response({'status': 'success', 'data': {'id': str(a.pk), 'email': a.email, 'full_name': a.full_name}})


class PlatformLogoutView(_PlatformBase):
    """تسجيل الخروج من كل الأجهزة: يُبطل كل التوكنات الصادرة (token_version)."""

    def post(self, request):
        admin = request.user
        PlatformAdmin.objects.filter(pk=admin.pk).update(token_version=admin.token_version + 1)
        return Response({'status': 'success', 'message': 'تم تسجيل الخروج'})

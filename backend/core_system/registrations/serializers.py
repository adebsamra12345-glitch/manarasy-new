import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from core_system.subscriptions.models import Plan
from core_system.tenants.models import Tenant

from .models import PaymentReceipt, RegistrationEvent, RegistrationRequest
from .utils import is_valid_subdomain, normalize_subdomain

_PHONE_RE = re.compile(r'^\+?[0-9][0-9 ()-]{6,18}[0-9]$')
_USERNAME_RE = re.compile(r'^[a-z][a-z0-9_.]{2,29}$')


def _clean_phone(value):
    value = (value or '').strip()
    if not _PHONE_RE.match(value) or len(value) > 20:
        raise serializers.ValidationError('رقم الهاتف غير صالح')
    return value


def _check_password(value):
    try:
        validate_password(value)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages))
    return value


class _MosqueFieldsMixin(serializers.Serializer):
    mosque_name = serializers.CharField(min_length=2, max_length=150)
    subdomain = serializers.CharField(max_length=30)
    contact_phone = serializers.CharField(max_length=20)
    contact_email = serializers.EmailField(max_length=100, required=False, allow_blank=True, default='')
    center_latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True,
                                               min_value=-90, max_value=90)
    center_longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True,
                                                min_value=-180, max_value=180)

    def validate_mosque_name(self, value):
        return ' '.join(value.split())

    def validate_subdomain(self, value):
        value = normalize_subdomain(value)
        if not is_valid_subdomain(value):
            raise serializers.ValidationError(
                'النطاق الفرعي: 3–30 حرفاً إنجليزياً صغيراً أو أرقاماً أو شرطة، ويبدأ بحرف، وليس من الأسماء المحجوزة')
        if Tenant.objects.filter(subdomain=value).exists():
            raise serializers.ValidationError('هذا النطاق الفرعي مستخدم')
        if RegistrationRequest.objects.filter(subdomain=value).exclude(
                status=RegistrationRequest.Status.REJECTED).exists():
            raise serializers.ValidationError('هذا النطاق الفرعي محجوز لطلب آخر')
        return value

    def validate_contact_phone(self, value):
        return _clean_phone(value)


class PublicRegistrationSerializer(_MosqueFieldsMixin):
    admin_password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)
    plan_id = serializers.IntegerField()
    website = serializers.CharField(required=False, allow_blank=True, default='', write_only=True)   # honeypot

    def validate_admin_password(self, value):
        return _check_password(value)

    def validate_plan_id(self, value):
        try:
            self._plan = Plan.objects.get(pk=value, is_active=True)
        except Plan.DoesNotExist:
            raise serializers.ValidationError('خطة الاشتراك غير موجودة')
        return value

    def validate(self, attrs):
        if attrs.get('website'):
            raise serializers.ValidationError('طلب غير صالح')      # روبوت
        attrs['plan'] = self._plan
        return attrs


class ManualMosqueSerializer(_MosqueFieldsMixin):
    """إضافة مسجد مباشرة من الأدمن العام."""
    admin_username = serializers.CharField(required=False, allow_blank=True, default='manager')
    admin_full_name = serializers.CharField(required=False, allow_blank=True, max_length=150, default='')
    admin_password = serializers.CharField(required=False, allow_blank=True, write_only=True,
                                           trim_whitespace=False, max_length=128)
    plan_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_admin_username(self, value):
        value = (value or 'manager').strip().lower()
        if not _USERNAME_RE.match(value):
            raise serializers.ValidationError('اسم المستخدم: 3–30 حرفاً إنجليزياً صغيراً/أرقاماً/._ ويبدأ بحرف')
        return value

    def validate_admin_password(self, value):
        return _check_password(value) if value else ''

    def validate_plan_id(self, value):
        if value is None:
            return None
        try:
            self._plan = Plan.objects.get(pk=value, is_active=True)
        except Plan.DoesNotExist:
            raise serializers.ValidationError('خطة الاشتراك غير موجودة')
        return value

    def validate(self, attrs):
        attrs['plan'] = getattr(self, '_plan', None) if attrs.get('plan_id') else None
        return attrs


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=5, max_length=500)


class ReceiptUploadSerializer(serializers.Serializer):
    file = serializers.FileField(allow_empty_file=False)
    reference_number = serializers.CharField(required=False, allow_blank=True, max_length=60, default='')

    def validate_reference_number(self, value):
        return re.sub(r'[^\w\- ]', '', value, flags=re.UNICODE).strip()


# ----------------------------------------------------------------- read serializers
class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentReceipt
        fields = ['id', 'original_name', 'content_type', 'size', 'reference_number', 'uploaded_at']


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistrationEvent
        fields = ['action', 'actor_label', 'detail', 'created_at']


class RegistrationListSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', default=None, read_only=True)
    receipts_count = serializers.SerializerMethodField()
    reviewed_by_email = serializers.CharField(source='reviewed_by.email', default=None, read_only=True)

    class Meta:
        model = RegistrationRequest
        fields = ['id', 'status', 'source', 'mosque_name', 'subdomain', 'contact_phone', 'contact_email',
                  'plan_name', 'amount_usd', 'receipts_count', 'reviewed_by_email', 'reviewed_at',
                  'rejection_reason', 'provisioning_error', 'provisioning_attempts', 'created_at']

    def get_receipts_count(self, obj):
        # prefetch_related('receipts') في الـ View ⇒ لا استعلام إضافي لكل صف
        return len(obj.receipts.all())


class RegistrationDetailSerializer(RegistrationListSerializer):
    receipts = ReceiptSerializer(many=True, read_only=True)
    events = EventSerializer(many=True, read_only=True)

    class Meta(RegistrationListSerializer.Meta):
        fields = RegistrationListSerializer.Meta.fields + [
            'center_latitude', 'center_longitude', 'admin_username', 'receipts', 'events', 'tenant']

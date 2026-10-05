"""واجهات عامة (بدون تسجيل دخول) لمسار التسجيل اليدوي — مقيَّدة بالمعدّل ومحمية برمز رفع لكل طلب."""
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle, ScopedRateThrottle
from rest_framework.views import APIView

from .models import RegistrationRequest
from .serializers import PublicRegistrationSerializer, ReceiptUploadSerializer
from .services import attach_receipt, create_registration_request
from .utils import token_matches

TOKEN_HEADER = 'HTTP_X_UPLOAD_TOKEN'


def _ip(request):
    return BaseThrottle().get_ident(request) or None


def _get_request_or_404(request, pk):
    """404 موحَّدة للطلب غير الموجود والرمز الخاطئ كي لا يُسمح بتعداد الطلبات."""
    obj = get_object_or_404(RegistrationRequest, pk=pk)
    if not token_matches(request.META.get(TOKEN_HEADER, ''), obj.upload_token_hash):
        raise Http404
    return obj


class _PublicBase(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]


class RegistrationCreateView(_PublicBase):
    throttle_scope = 'public_register'

    def post(self, request):
        ser = PublicRegistrationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        req, raw_token = create_registration_request(ser.validated_data, ip=_ip(request))
        return Response({
            'status': 'success',
            'message': 'تم استلام طلبك. أرسل إشعار الدفع ليتم تفعيل المسجد بعد المراجعة',
            'data': {
                'id': str(req.id),
                'upload_token': raw_token,        # يُعرض مرة واحدة فقط
                'status': req.status,
                'subdomain': req.subdomain,
                'plan': req.plan.name,
                'amount_usd': str(req.amount_usd),
            },
        }, status=status.HTTP_201_CREATED)


class ReceiptUploadView(_PublicBase):
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = 'receipt_upload'

    def post(self, request, pk):
        req = _get_request_or_404(request, pk)
        ser = ReceiptUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        attach_receipt(req.pk, ser.validated_data['file'],
                       reference_number=ser.validated_data.get('reference_number', ''), ip=_ip(request))
        req.refresh_from_db()
        return Response({
            'status': 'success',
            'message': 'تم رفع الإشعار بنجاح وهو الآن قيد المراجعة',
            'data': {'status': req.status},
        }, status=status.HTTP_201_CREATED)


class RegistrationStatusView(_PublicBase):
    throttle_scope = 'registration_status'

    def get(self, request, pk):
        req = _get_request_or_404(request, pk)
        data = {
            'status': req.status,
            'mosque_name': req.mosque_name,
            'subdomain': req.subdomain,
            'receipts_count': req.receipts.count(),
        }
        if req.status == RegistrationRequest.Status.REJECTED:
            data['rejection_reason'] = req.rejection_reason
        return Response({'status': 'success', 'data': data})

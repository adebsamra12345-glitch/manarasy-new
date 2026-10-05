"""واجهات أدمن المنصة: مراجعة الطلبات، عرض الإيصالات، الموافقة/الرفض، وإضافة مسجد يدوياً."""
from django.db.models import Prefetch, Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from core_system.subscriptions.models import Subscription
from core_system.tenants.models import Tenant
from platform_auth.authentication import IsPlatformAdmin, PlatformJWTAuthentication

from .models import PaymentReceipt, RegistrationRequest
from .serializers import (ManualMosqueSerializer, RegistrationDetailSerializer, RegistrationListSerializer,
                          RejectSerializer)
from .services import (begin_provisioning, create_mosque_manually, dispatch_provisioning, reject_request)
from .utils import ALLOWED_RECEIPT_TYPES

_EXT_BY_MIME = {m: e for e, m in ALLOWED_RECEIPT_TYPES.items()}


class _PlatformBase(APIView):
    authentication_classes = [PlatformJWTAuthentication]
    permission_classes = [IsPlatformAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'platform_api'


class _Pagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class RegistrationListView(_PlatformBase):
    def get(self, request):
        qs = (RegistrationRequest.objects
              .select_related('plan', 'reviewed_by')
              .prefetch_related('receipts'))
        st = request.query_params.get('status')
        if st:
            qs = qs.filter(status__in=[s for s in st.split(',') if s in RegistrationRequest.Status.values])
        src = request.query_params.get('source')
        if src in RegistrationRequest.Source.values:
            qs = qs.filter(source=src)
        q = (request.query_params.get('q') or '').strip()[:100]
        if q:
            qs = qs.filter(Q(mosque_name__icontains=q) | Q(subdomain__icontains=q) | Q(contact_phone__icontains=q))
        paginator = _Pagination()
        page = paginator.paginate_queryset(qs.order_by('-created_at'), request, view=self)
        return paginator.get_paginated_response(RegistrationListSerializer(page, many=True).data)


class RegistrationDetailView(_PlatformBase):
    def get(self, request, pk):
        obj = get_object_or_404(
            RegistrationRequest.objects.select_related('plan', 'reviewed_by').prefetch_related('receipts', 'events'),
            pk=pk)
        return Response({'status': 'success', 'data': RegistrationDetailSerializer(obj).data})


class ReceiptFileView(_PlatformBase):
    """
    يبثّ الإيصال للأدمن العام فقط. الملف خارج MEDIA_ROOT، والمسار مأخوذ من قاعدة البيانات
    (اسم مولَّد على الخادم) فلا مجال لـ path traversal. الترويسات تمنع تنفيذ أي محتوى نشط.
    """

    def get(self, request, pk, receipt_id):
        receipt = get_object_or_404(PaymentReceipt, pk=receipt_id, request_id=pk)
        try:
            fh = receipt.file.open('rb')
        except (FileNotFoundError, ValueError):
            raise Http404
        ext = _EXT_BY_MIME.get(receipt.content_type, 'bin')
        resp = FileResponse(fh, content_type=receipt.content_type)
        resp['Content-Disposition'] = f'inline; filename="receipt-{receipt.pk.hex[:8]}.{ext}"'
        resp['X-Content-Type-Options'] = 'nosniff'
        resp['Cache-Control'] = 'private, no-store'
        resp['Content-Security-Policy'] = "default-src 'none'; sandbox"
        resp['Cross-Origin-Resource-Policy'] = 'same-site'
        return resp


class RegistrationApproveView(_PlatformBase):
    def post(self, request, pk):
        begin_provisioning(pk, request.user, retry=False)
        mode = dispatch_provisioning(pk)
        return _provisioning_response(pk, mode)


class RegistrationRetryView(_PlatformBase):
    def post(self, request, pk):
        begin_provisioning(pk, request.user, retry=True)
        mode = dispatch_provisioning(pk)
        return _provisioning_response(pk, mode)


def _provisioning_response(pk, mode):
    obj = RegistrationRequest.objects.select_related('plan', 'reviewed_by').prefetch_related('receipts').get(pk=pk)
    if mode == 'queued':
        return Response({'status': 'success', 'message': 'بدأ تجهيز قاعدة بيانات المسجد في الخلفية',
                         'data': RegistrationListSerializer(obj).data}, status=status.HTTP_202_ACCEPTED)
    if obj.status == RegistrationRequest.Status.APPROVED:
        return Response({'status': 'success', 'message': 'تمت الموافقة وتجهيز قاعدة بيانات المسجد',
                         'data': RegistrationListSerializer(obj).data})
    return Response({'status': 'error', 'message': obj.provisioning_error or 'فشل تجهيز قاعدة البيانات',
                     'data': RegistrationListSerializer(obj).data}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RegistrationRejectView(_PlatformBase):
    def post(self, request, pk):
        ser = RejectSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = reject_request(pk, request.user, ser.validated_data['reason'])
        return Response({'status': 'success', 'message': 'تم رفض الطلب',
                         'data': {'id': str(obj.pk), 'status': obj.status}})


class MosqueListCreateView(_PlatformBase):
    def get(self, request):
        subs = Prefetch('subscription_set', queryset=Subscription.objects.select_related('plan').order_by('-ends_at'))
        qs = Tenant.objects.prefetch_related(subs).order_by('-created_at')
        q = (request.query_params.get('q') or '').strip()[:100]
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(subdomain__icontains=q))
        paginator = _Pagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        rows = []
        for t in page:
            sub = next(iter(t.subscription_set.all()), None)     # مُحمَّلة مسبقاً: لا N+1
            rows.append({
                'id': str(t.id), 'name': t.name, 'subdomain': t.subdomain, 'is_active': t.is_active,
                'contact_phone': t.contact_phone, 'contact_email': t.contact_email,
                'created_at': t.created_at,
                'plan': sub.plan.name if sub else None,
                'subscription_status': sub.status if sub else None,
                'subscription_ends_at': sub.ends_at if sub else None,
            })
        return paginator.get_paginated_response(rows)

    def post(self, request):
        ser = ManualMosqueSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        req, generated_password = create_mosque_manually(ser.validated_data, request.user)
        dispatch_provisioning(req.pk)
        req.refresh_from_db()
        ok = req.status == RegistrationRequest.Status.APPROVED
        queued = req.status == RegistrationRequest.Status.PROVISIONING
        body = {
            'status': 'success' if (ok or queued) else 'error',
            'message': ('تم إنشاء المسجد وتعيين مسؤوله' if ok else
                        'بدأ تجهيز المسجد في الخلفية' if queued else
                        (req.provisioning_error or 'فشل تجهيز المسجد')),
            'data': {
                'request_id': str(req.pk),
                'request_status': req.status,
                'subdomain': req.subdomain,
                'admin_username': req.admin_username,
                # تظهر مرة واحدة فقط ولا تُخزَّن نصياً في أي مكان
                'generated_password': generated_password,
            },
        }
        return Response(body, status=status.HTTP_201_CREATED if (ok or queued) else status.HTTP_500_INTERNAL_SERVER_ERROR)

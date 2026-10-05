from django.urls import path

from .platform_views import (MosqueListCreateView, ReceiptFileView, RegistrationApproveView,
                             RegistrationDetailView, RegistrationListView, RegistrationRejectView,
                             RegistrationRetryView)

urlpatterns = [
    path('registrations/', RegistrationListView.as_view(), name='platform_registrations'),
    path('registrations/<uuid:pk>/', RegistrationDetailView.as_view(), name='platform_registration_detail'),
    path('registrations/<uuid:pk>/receipts/<uuid:receipt_id>/', ReceiptFileView.as_view(),
         name='platform_registration_receipt'),
    path('registrations/<uuid:pk>/approve/', RegistrationApproveView.as_view(), name='platform_registration_approve'),
    path('registrations/<uuid:pk>/reject/', RegistrationRejectView.as_view(), name='platform_registration_reject'),
    path('registrations/<uuid:pk>/retry/', RegistrationRetryView.as_view(), name='platform_registration_retry'),
    path('mosques/', MosqueListCreateView.as_view(), name='platform_mosques'),
]

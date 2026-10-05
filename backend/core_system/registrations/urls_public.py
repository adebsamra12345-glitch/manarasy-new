from django.urls import path

from .public_views import ReceiptUploadView, RegistrationCreateView, RegistrationStatusView

urlpatterns = [
    path('registrations/', RegistrationCreateView.as_view(), name='public_registration_create'),
    path('registrations/<uuid:pk>/receipt/', ReceiptUploadView.as_view(), name='public_registration_receipt'),
    path('registrations/<uuid:pk>/status/', RegistrationStatusView.as_view(), name='public_registration_status'),
]

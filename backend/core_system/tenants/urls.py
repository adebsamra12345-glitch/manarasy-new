from django.urls import path
from .views import (
    health_check_view, 
    tenant_list_create_view, 
    tenant_detail_view,
    tenant_login_view
)
from .dashboard_views import (
    mosque_admin_dashboard_api,
    approve_registration_request_api,
    reject_registration_request_api
)

from .settings_views import tenant_settings_view, tenant_branding_view

urlpatterns = [
    path('', tenant_list_create_view, name='tenant_list_create'),
    path('login/', tenant_login_view, name='tenant_login'),
    path('settings/', tenant_settings_view, name='tenant_settings'),
    path('branding/', tenant_branding_view, name='tenant_branding'),
    path('<uuid:pk>/', tenant_detail_view, name='tenant_detail'),
    path('dashboard/mosque-admin/', mosque_admin_dashboard_api, name='mosque-admin-dashboard'),
    path('dashboard/registration-requests/<str:request_id>/approve/', approve_registration_request_api, name='approve-registration-request'),
    path('dashboard/registration-requests/<str:request_id>/reject/', reject_registration_request_api, name='reject-registration-request'),
]

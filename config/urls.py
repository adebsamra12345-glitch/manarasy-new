from django.contrib import admin
from django.urls import path, include
from core_system.tenants.views import health_check_view

api_urlpatterns = [
    path('health/', health_check_view, name='health_check'),
    
    # core_system (Master DB)
    path('tenants/', include('core_system.tenants.urls')),
    path('subscriptions/', include('core_system.subscriptions.urls')),
    path('payments/', include('core_system.payments.urls')),
    path('backups/', include('core_system.backups.urls')),
    
    # tenant_modules (Tenant DB)
    path('users/', include('tenant_modules.users.urls')),
    path('centers-and-projects/', include('tenant_modules.centers_and_projects.urls')),
    path('halaqat/', include('tenant_modules.halaqat.urls')),
    path('students-and-parents/', include('tenant_modules.students_and_parents.urls')),
    path('attendance/', include('tenant_modules.attendance.urls')),
    path('recitation/', include('tenant_modules.recitation_and_sabr.urls')),
    path('reports/', include('tenant_modules.reports_and_certificates.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(api_urlpatterns)),
    path('', include(api_urlpatterns)),
]

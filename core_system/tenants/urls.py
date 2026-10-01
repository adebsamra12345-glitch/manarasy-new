from django.urls import path
from .views import tenant_list_create_view, tenant_detail_view , tenant_login_view

urlpatterns = [
    path('', tenant_list_create_view, name='tenant_list_create'),
    path('login/', tenant_login_view, name='tenant_login'),
    path('<uuid:pk>/', tenant_detail_view, name='tenant_detail'),
]

from django.urls import path
from .views import (
    user_list_create_view,
    user_detail_view,
    user_impersonate_view,
    user_me_view,
    switch_active_role_view,
    account_request_list_view,
    account_request_approve_view,
    account_request_reject_view,
    change_password_view
)

urlpatterns = [
    path('', user_list_create_view, name='user_list_create'),
    path('me/', user_me_view, name='user_me'),
    path('switch-role/', switch_active_role_view, name='switch_active_role'),
    path('requests/', account_request_list_view, name='account_request_list'),
    path('requests/<uuid:pk>/approve/', account_request_approve_view, name='account_request_approve'),
    path('requests/<uuid:pk>/reject/', account_request_reject_view, name='account_request_reject'),
    path('change-password/', change_password_view, name='change_password'),
    path('<uuid:pk>/', user_detail_view, name='user_detail'),
    path('<uuid:pk>/impersonate/', user_impersonate_view, name='user_impersonate'),
]

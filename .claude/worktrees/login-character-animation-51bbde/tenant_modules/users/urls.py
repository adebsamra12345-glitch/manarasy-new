from django.urls import path
from .views import (
    user_list_create_view,
    user_detail_view,
    user_impersonate_view,
    account_request_list_view,
    account_request_approve_view,
    account_request_reject_view
)

urlpatterns = [
    path('', user_list_create_view, name='user_list_create'),
    path('requests/', account_request_list_view, name='account_request_list'),
    path('requests/<uuid:pk>/approve/', account_request_approve_view, name='account_request_approve'),
    path('requests/<uuid:pk>/reject/', account_request_reject_view, name='account_request_reject'),
    path('<int:pk>/', user_detail_view, name='user_detail'),
    path('<uuid:pk>/impersonate/', user_impersonate_view, name='user_impersonate'),
]

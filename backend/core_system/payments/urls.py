from django.urls import path
from .views import payment_list_create_view, sham_cash_webhook_view

urlpatterns = [
    path('', payment_list_create_view, name='payment_list_create'),
    path('sham-cash/webhook/', sham_cash_webhook_view, name='sham_cash_webhook'),
]

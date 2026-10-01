from django.urls import path
from .views import subscription_list_create_view, plan_list_view

urlpatterns = [
    path('', subscription_list_create_view, name='subscription_list_create'),
    path('plans/', plan_list_view, name='plan_list'),
]

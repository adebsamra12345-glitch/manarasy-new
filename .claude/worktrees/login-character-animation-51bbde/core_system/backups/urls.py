from django.urls import path
from .views import backup_list_create_view

urlpatterns = [
    path('', backup_list_create_view, name='backup_list_create'),
]

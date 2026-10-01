from django.urls import path
from .views import attendance_list_create_view, session_start_view, session_detail_view

urlpatterns = [
    path('', attendance_list_create_view, name='attendance_list_create'),
    path('sessions/start/', session_start_view, name='session_start'),
    path('sessions/<uuid:pk>/', session_detail_view, name='session_detail'),
]

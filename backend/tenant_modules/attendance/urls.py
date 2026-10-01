from django.urls import path
from .views import (
    attendance_list_create_view, 
    session_start_view, 
    session_detail_view, 
    session_list_view,
    save_schedule_view,
    available_dates_view
)

urlpatterns = [
    path('', attendance_list_create_view, name='attendance_list_create'),
    path('sessions/', session_list_view, name='session_list'),
    path('sessions/available-dates/', available_dates_view, name='session_available_dates'),
    path('sessions/start/', session_start_view, name='session_start'),
    path('sessions/save-schedule/', save_schedule_view, name='save_schedule'),
    path('sessions/<str:pk>/', session_detail_view, name='session_detail'),
]

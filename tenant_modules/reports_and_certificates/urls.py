from django.urls import path
from .views import analytics_summary_view, certificate_generate_view, reports_data_view, student_activity_view, available_months_view

urlpatterns = [
    path('analytics/', analytics_summary_view, name='analytics_summary'),
    path('data/', reports_data_view, name='reports_data'),
    path('available-months/', available_months_view, name='available_months'),
    path('student-activity/', student_activity_view, name='student_activity'),
    path('certificates/', certificate_generate_view, name='certificate_generate'),
]




from django.urls import path
from .views import analytics_summary_view, certificate_generate_view

urlpatterns = [
    path('analytics/', analytics_summary_view, name='analytics_summary'),
    path('certificates/', certificate_generate_view, name='certificate_generate'),
]

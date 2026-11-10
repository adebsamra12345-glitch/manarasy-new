from django.urls import path
from .views import agent_command_view

urlpatterns = [
    path('command/', agent_command_view, name='agent_command'),
]

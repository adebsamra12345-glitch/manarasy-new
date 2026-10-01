from django.urls import path
from .views import recitation_list_create_view, recitation_evaluate_view

urlpatterns = [
    path('', recitation_list_create_view, name='recitation_list_create'),
    path('evaluate/', recitation_evaluate_view, name='recitation_evaluate'),
]

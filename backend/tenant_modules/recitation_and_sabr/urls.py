from django.urls import path
from .views import recitation_list_create_view, recitation_evaluate_view, update_recitation_view

urlpatterns = [
    path('', recitation_list_create_view, name='recitation_list_create'),
    path('evaluate/', recitation_evaluate_view, name='recitation_evaluate'),
    path('evaluate/<uuid:recitation_id>/', update_recitation_view, name='recitation_update'),
]

from django.urls import path
from .views import halaqa_list_create_view, halaqa_detail_view

urlpatterns = [
    path('', halaqa_list_create_view, name='halaqa_list_create'),
    path('<uuid:pk>/', halaqa_detail_view, name='halaqa_detail'),
]

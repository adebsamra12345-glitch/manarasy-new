from django.urls import path
from .views import student_list_create_view, parent_list_create_view, student_enrollment_view

urlpatterns = [
    path('students/', student_list_create_view, name='student_list_create'),
    path('students/enroll/', student_enrollment_view, name='student_enrollment'),
    path('parents/', parent_list_create_view, name='parent_list_create'),
]

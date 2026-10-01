from django.urls import path
from .views import (
    student_list_create_view, 
    student_detail_view,
    parent_list_create_view, 
    student_enrollment_view, 
    student_registration_request_view,
    student_evaluation_summary_view,
    record_evaluation_view,
    student_deletion_request_view,
    cancel_student_registration_request_view,
    cancel_student_deletion_request_view,
)

urlpatterns = [
    path('students/', student_list_create_view, name='student_list_create'),
    path('students/<uuid:pk>/', student_detail_view, name='student_detail'),
    path('students/enroll/', student_enrollment_view, name='student_enrollment'),
    path('students/registration-requests/', student_registration_request_view, name='student_registration_request'),
    path('students/registration-requests/<uuid:request_id>/cancel/', cancel_student_registration_request_view, name='cancel_student_registration_request'),
    path('students/deletion-requests/', student_deletion_request_view, name='student_deletion_request'),
    path('students/deletion-requests/<uuid:request_id>/cancel/', cancel_student_deletion_request_view, name='cancel_student_deletion_request'),
    path('parents/', parent_list_create_view, name='parent_list_create'),
    path('evaluations/students/<str:student_id>/summary/', student_evaluation_summary_view, name='student_evaluation_summary'),
    path('evaluations/record/', record_evaluation_view, name='record_evaluation'),
]

from django.urls import path
from .views import (
    student_list_create_view, 
    student_detail_view,
    student_enrollment_view, 
    student_registration_request_view,
    approve_student_registration_request_view,
    reject_student_registration_request_view,
    student_evaluation_summary_view,
    record_evaluation_view,
    student_deletion_request_view,
    cancel_student_registration_request_view,
    cancel_student_deletion_request_view,
    approve_student_deletion_request_view,
    reject_student_deletion_request_view,
    bulk_approve_student_requests_view,
)

urlpatterns = [
    path('students/', student_list_create_view, name='student_list_create'),
    path('students/<uuid:pk>/', student_detail_view, name='student_detail'),
    path('students/enroll/', student_enrollment_view, name='student_enrollment'),
    path('students/requests/bulk-approve/', bulk_approve_student_requests_view, name='bulk_approve_student_requests'),
    path('students/registration-requests/', student_registration_request_view, name='student_registration_request'),
    path('students/registration-requests/<uuid:request_id>/approve/', approve_student_registration_request_view, name='approve_student_registration_request'),
    path('students/registration-requests/<uuid:request_id>/reject/', reject_student_registration_request_view, name='reject_student_registration_request'),
    path('students/registration-requests/<uuid:request_id>/cancel/', cancel_student_registration_request_view, name='cancel_student_registration_request'),
    path('students/deletion-requests/', student_deletion_request_view, name='student_deletion_request'),
    path('students/deletion-requests/<uuid:request_id>/approve/', approve_student_deletion_request_view, name='approve_student_deletion_request'),
    path('students/deletion-requests/<uuid:request_id>/reject/', reject_student_deletion_request_view, name='reject_student_deletion_request'),
    path('students/deletion-requests/<uuid:request_id>/cancel/', cancel_student_deletion_request_view, name='cancel_student_deletion_request'),
    path('evaluations/students/<str:student_id>/summary/', student_evaluation_summary_view, name='student_evaluation_summary'),
    path('evaluations/record/', record_evaluation_view, name='record_evaluation'),
]

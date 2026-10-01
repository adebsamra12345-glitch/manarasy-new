from django.urls import path
from .views import (
    center_list_create_view, 
    center_detail_view,
    project_list_create_view, 
    project_detail_view,
    quran_juz_presets_view,
    stage_list_create_view,
    stage_detail_view,
    part_list_create_view,
    part_detail_view,
    exam_template_list_create_view,
    exam_template_detail_view,
    student_exam_schedule_view,
    student_exam_submit_view,
    system_notifications_view,
    evaluation_template_list_create_view,
    evaluation_template_detail_view,
    evaluation_grade_create_view,
    evaluation_grade_detail_view,
    test_rubric_list_create_view,
    test_rubric_detail_view,
    rubric_error_type_create_view,
    rubric_error_type_detail_view,
    mosque_schedule_list_create_view,
    mosque_schedule_detail_view,
    mosque_schedule_bulk_save_view
)

urlpatterns = [
    path('centers/', center_list_create_view, name='center_list_create'),
    path('centers/<uuid:pk>/', center_detail_view, name='center_detail'),
    path('projects/quran-juz-presets/', quran_juz_presets_view, name='quran_juz_presets'),
    path('projects/', project_list_create_view, name='project_list_create'),
    path('projects/<uuid:pk>/', project_detail_view, name='project_detail'),
    path('projects/<uuid:project_id>/stages/', stage_list_create_view, name='stage_list_create'),
    path('projects/stages/<uuid:stage_id>/', stage_detail_view, name='stage_detail'),
    path('projects/stages/<uuid:stage_id>/parts/', part_list_create_view, name='part_list_create'),
    path('projects/parts/<uuid:part_id>/', part_detail_view, name='part_detail'),
    
    # Evaluation Templates & Grades
    path('evaluations/templates/', evaluation_template_list_create_view, name='evaluation_template_list_create'),
    path('evaluations/templates/<uuid:pk>/', evaluation_template_detail_view, name='evaluation_template_detail'),
    path('evaluations/templates/<uuid:template_id>/grades/', evaluation_grade_create_view, name='evaluation_grade_create'),
    path('evaluations/grades/<uuid:pk>/', evaluation_grade_detail_view, name='evaluation_grade_detail'),

    # Test Rubrics & Error Types
    path('test-rubrics/', test_rubric_list_create_view, name='test_rubric_list_create'),
    path('test-rubrics/<uuid:pk>/', test_rubric_detail_view, name='test_rubric_detail'),
    path('test-rubrics/<uuid:rubric_id>/error-types/', rubric_error_type_create_view, name='rubric_error_type_create'),
    path('test-rubrics/error-types/<uuid:pk>/', rubric_error_type_detail_view, name='rubric_error_type_detail'),

    # Exam Templates
    path('exams/templates/', exam_template_list_create_view, name='exam_template_list_create'),
    path('exams/templates/<uuid:pk>/', exam_template_detail_view, name='exam_template_detail'),
    path('exams/schedule/', student_exam_schedule_view, name='student_exam_schedule'),
    path('exams/submit/', student_exam_submit_view, name='student_exam_submit'),
    path('notifications/', system_notifications_view, name='system_notifications'),

    # Mosque weekly session schedule routes
    path('schedules/', mosque_schedule_list_create_view, name='mosque_schedule_list_create'),
    path('schedules/bulk-save/', mosque_schedule_bulk_save_view, name='mosque_schedule_bulk_save'),
    path('schedules/<uuid:pk>/', mosque_schedule_detail_view, name='mosque_schedule_detail'),
]
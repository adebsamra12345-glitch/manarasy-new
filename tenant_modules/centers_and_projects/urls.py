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
    evaluation_template_detail_view
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
    path('evaluations/templates/', evaluation_template_list_create_view, name='evaluation_template_list_create'),
    path('evaluations/templates/<uuid:pk>/', evaluation_template_detail_view, name='evaluation_template_detail'),
    path('exams/templates/', exam_template_list_create_view, name='exam_template_list_create'),
    path('exams/templates/<uuid:pk>/', exam_template_detail_view, name='exam_template_detail'),
    path('exams/schedule/', student_exam_schedule_view, name='student_exam_schedule'),
    path('exams/submit/', student_exam_submit_view, name='student_exam_submit'),
    path('notifications/', system_notifications_view, name='system_notifications'),
]
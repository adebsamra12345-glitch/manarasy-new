from django.urls import path
from . import views

urlpatterns = [
    path('status/', views.ai_status_view, name='ai_status'),
    path('chat/', views.ai_chat_view, name='ai_chat'),
    path('agent/turn/', views.ai_agent_turn_view, name='ai_agent_turn'),
    path('agent/chat/', views.ai_agent_chat_view, name='ai_agent_chat'),
    path('agent/confirm/', views.ai_agent_confirm_view, name='ai_agent_confirm'),
    path('agent/tts/', views.ai_tts_view, name='ai_agent_tts'),
    path('agent/feedback/', views.ai_agent_feedback_view, name='ai_agent_feedback'),
    path('agent/settings/', views.ai_agent_settings_view, name='ai_agent_settings'),
    path('agent/history/', views.ai_agent_history_view, name='ai_agent_history'),
    path('agent/review/', views.ai_agent_review_view, name='ai_agent_review'),
    path('agent/review/<uuid:message_id>/', views.ai_agent_review_view, name='ai_agent_review_item'),
    path('evaluation-note/', views.ai_evaluation_note_view, name='ai_evaluation_note'),
    path('report-insight/', views.ai_report_insight_view, name='ai_report_insight'),
    path('quiz-generate/', views.ai_quiz_generate_view, name='ai_quiz_generate'),
    path('memorization-prediction/<uuid:student_id>/', views.ai_memorization_prediction_view, name='ai_memorization_prediction'),
    path('audio-eval/', views.ai_audio_eval_view, name='ai_audio_eval'),
]


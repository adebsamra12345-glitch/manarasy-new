from django.urls import path
from . import views

urlpatterns = [
    # 1. نقاط الطلاب وسجل الحركات
    path('points/students/', views.student_points_list_view, name='points_students_list'),
    path('points/bonus/', views.grant_bonus_points_view, name='points_grant_bonus'),
    path('points/transactions/', views.points_transactions_view, name='points_transactions_list'),

    # 2. المكافآت والمتجر
    path('rewards/', views.rewards_list_create_view, name='rewards_list_create'),
    path('rewards/<uuid:pk>/', views.reward_detail_view, name='reward_detail'),
    path('rewards/redeem/', views.redeem_reward_view, name='reward_redeem'),

    # 3. إدارة طلبات المكافآت من قبل الإدارة
    path('rewards/claims/', views.admin_claims_list_view, name='admin_claims_list'),
    path('rewards/claims/<uuid:pk>/action/', views.admin_claim_action_view, name='admin_claim_action'),

    # 4. التحكم بفتح وإغلاق المتجر (إعدادات المركز والمسجد)
    path('rewards/store-settings/', views.store_settings_view, name='rewards_store_settings'),

    # 5. واجهات بوابة الطالب / ولي الأمر الموحدة
    path('student-portal/dashboard/', views.student_portal_dashboard_view, name='student_portal_dashboard'),
    path('student-portal/points-store/', views.student_portal_points_store_view, name='student_portal_points_store'),
    path('student-portal/claim-reward/', views.student_portal_claim_reward_view, name='student_portal_claim_reward'),
    path('student-portal/follow-up/', views.student_portal_follow_up_view, name='student_portal_follow_up'),
    path('student-portal/notifications/', views.student_portal_notifications_view, name='student_portal_notifications'),
    path('student-portal/notifications/mark-read/', views.student_portal_mark_notification_read_view, name='student_portal_mark_all_read'),
    path('student-portal/notifications/<uuid:pk>/read/', views.student_portal_mark_notification_read_view, name='student_portal_mark_one_read'),

    # 6. المسابقات
    path('competitions/', views.competitions_list_create_view, name='competitions_list_create'),
    path('competitions/<uuid:pk>/', views.competition_detail_view, name='competition_detail'),
    path('competitions/<uuid:pk>/questions/', views.competition_questions_view, name='competition_add_question'),
    path('competitions/questions/<uuid:pk>/', views.question_detail_view, name='question_detail'),

    # 7. واجهات الطالب للمسابقات
    path('student/competitions/', views.student_competitions_view, name='student_competitions'),
    path('student/competitions/<uuid:pk>/start/', views.student_start_competition_view, name='student_start_competition'),
    path('student/competitions/<uuid:pk>/submit/', views.student_submit_competition_view, name='student_submit_competition'),
]

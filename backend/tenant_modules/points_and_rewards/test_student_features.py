import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from django.conf import settings
from decimal import Decimal
from core_system.tenants.models import Tenant
from tenant_modules.users.models import UserProfile, User
from tenant_modules.centers_and_projects.models import Center, SystemNotification
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student, StudentEnrollment, EvaluationLog
from tenant_modules.attendance.models import AttendanceLog, HalaqaSession
from tenant_modules.recitation_and_sabr.models import RecitationLog
from tenant_modules.points_and_rewards.models import (
    Reward, RewardClaim, PointTransaction, Competition, CompetitionParticipation
)
from tenant_modules.points_and_rewards.services import PointsService
from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
from tenant_modules.points_and_rewards.views import (
    student_portal_follow_up_view,
    student_portal_notifications_view,
    student_portal_mark_notification_read_view
)
import json
import jwt

def run_tests():
    print("=" * 60)
    print("RUNNING STUDENT FOLLOW-UP & NOTIFICATIONS INTEGRATION TESTS")
    print("=" * 60)

    tenant = Tenant.objects.first()
    assert tenant is not None, "A Tenant record is required"
    db_name = tenant.db_name

    if db_name not in settings.DATABASES:
        cfg = settings.DATABASES['default'].copy()
        cfg.update({
            'NAME': tenant.db_name,
            'USER': tenant.db_user or settings.DATABASES['default'].get('USER'),
            'PASSWORD': tenant.db_password_hash or settings.DATABASES['default'].get('PASSWORD'),
            'HOST': tenant.db_host or 'localhost',
            'PORT': tenant.db_port or 5432
        })
        settings.DATABASES[db_name] = cfg

    # Setup Student & User
    user, _ = User.objects.using(db_name).get_or_create(username='test_student_user_qa', defaults={'email': 'stu@test.com'})
    profile, _ = UserProfile.objects.using(db_name).get_or_create(user=user, defaults={'role': 'STUDENT'})
    
    center, _ = Center.objects.using(db_name).get_or_create(name='مركز الاختبارات', defaults={'code': 'QA_CTR'})
    halaqa, _ = Halaqa.objects.using(db_name).get_or_create(name='حلقة التميز', defaults={'center': center, 'teacher_name': 'أ. محمد'})
    
    student, _ = Student.objects.using(db_name).get_or_create(
        user=user,
        defaults={'full_name': 'طالب الاختبار الموحد', 'halaqa': halaqa, 'points': 200, 'reached_page': 30}
    )

    secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
    token = jwt.encode({'user_id': str(user.id)}, secret, algorithm='HS256')
    auth_headers = {'HTTP_AUTHORIZATION': f'Bearer {token}', 'HTTP_TENANT_ID': str(tenant.id)}

    # Clean up previous test artifacts for test user to allow fresh idempotent tests
    SystemNotification.objects.using(db_name).filter(recipient=user).delete()
    AttendanceLog.objects.using(db_name).filter(student_id=student.id).delete()

    rf = RequestFactory()

    # -------------------------------------------------------------
    # TEST 1: Absence Notification
    # -------------------------------------------------------------
    print("\n[TEST 1] Testing Absence Notification...")
    session, _ = HalaqaSession.objects.using(db_name).get_or_create(halaqa_id=halaqa.id)
    att = AttendanceLog.objects.using(db_name).create(
        session=session,
        student_id=student.id,
        halaqa_id=halaqa.id,
        status='ABSENT',
        behavior_score=5
    )
    n1 = StudentNotificationService.notify_absence(db_name, att)
    assert n1 is not None, "Absence notification should be created"
    assert "غياب" in n1.title
    assert "حلقة التميز" in n1.message

    # Test idempotency (should not duplicate)
    n1_dup = StudentNotificationService.notify_absence(db_name, att)
    assert n1_dup is None, "Duplicate absence notification should be suppressed"
    print("  --> PASSED: Absence notification created and duplicate suppressed.")

    # -------------------------------------------------------------
    # TEST 2: Daily Evaluation Notification
    # -------------------------------------------------------------
    print("\n[TEST 2] Testing Daily Evaluation Notification...")
    n2 = StudentNotificationService.notify_daily_evaluation(
        db_name=db_name,
        student=student,
        memorization_grade="ممتاز",
        behavior_grade="جيد جداً (9/10)",
        notes="حفظ متقن ومبارك",
        page_number=31,
        recitation_type="حفظ جديد"
    )
    assert n2 is not None, "Daily evaluation notification should be created"
    assert "ممتاز" in n2.message
    assert "جيد جداً" in n2.message
    print("  --> PASSED: Daily evaluation notification created with full details.")

    # -------------------------------------------------------------
    # TEST 3: Points Awarded Notification
    # -------------------------------------------------------------
    print("\n[TEST 3] Testing Points Awarded Notification...")
    n3 = StudentNotificationService.notify_points_awarded(
        db_name=db_name,
        student=student,
        amount=50,
        reason="مكافأة على تميزك في الحلقة",
        balance_after=250
    )
    assert n3 is not None, "Points awarded notification should be created"
    assert "50" in n3.message
    assert "250" in n3.message
    print("  --> PASSED: Points awarded notification created with balance.")

    # -------------------------------------------------------------
    # TEST 4: Competition Notifications
    # -------------------------------------------------------------
    print("\n[TEST 4] Testing Competition Participation & Result Notifications...")
    comp, _ = Competition.objects.using(db_name).get_or_create(
        title="مسابقة حفظ سورة الكهف",
        defaults={'points_reward': 30, 'duration_minutes': 20}
    )
    part = CompetitionParticipation.objects.using(db_name).create(
        competition=comp,
        student=student,
        status='IN_PROGRESS',
        score=Decimal('18.00'),
        total_possible_score=Decimal('20.00')
    )
    n4_reg = StudentNotificationService.notify_competition_registered(db_name, part)
    assert n4_reg is not None, "Competition registration notification should be created"

    n4_res = StudentNotificationService.notify_competition_result(
        db_name=db_name,
        participation=part,
        points_awarded=30,
        rank_text="الأول"
    )
    assert n4_res is not None, "Competition result notification should be created"
    assert "18" in n4_res.message
    assert "الأول" in n4_res.message
    print("  --> PASSED: Competition registration and result notifications verified.")

    # -------------------------------------------------------------
    # TEST 5: Points Redemption Notification
    # -------------------------------------------------------------
    print("\n[TEST 5] Testing Points Redemption Notification...")
    n5 = StudentNotificationService.notify_points_redemption(
        db_name=db_name,
        student=student,
        points_spent=100,
        reward_name="هدية تحفيزية",
        balance_after=150,
        is_approval=True
    )
    assert n5 is not None, "Points redemption notification should be created"
    assert "100" in n5.message
    assert "هدية تحفيزية" in n5.message
    assert "150" in n5.message
    print("  --> PASSED: Points redemption notification verified.")

    # -------------------------------------------------------------
    # TEST 6: Student Follow-up Endpoint (GET /api/student-portal/follow-up/)
    # -------------------------------------------------------------
    print("\n[TEST 6] Testing Student Follow-up API...")
    # Add a recitation log
    RecitationLog.objects.using(db_name).create(
        attendance=att,
        student_id=student.id,
        recitation_type='NEW_MEMORIZATION',
        page_number=31,
        grade='ممتاز',
        behavior_score=10,
        notes='قراءة صحيحة بأحكام التجويد'
    )
    # Add an evaluation log
    EvaluationLog.objects.using(db_name).create(
        student=student,
        evaluation_type='MEMORIZATION',
        score=Decimal('98.00'),
        date=att.session_date,
        notes='تقييم دوري ممتاز'
    )

    req_fu = rf.get('/api/student-portal/follow-up/', {'student_id': str(student.id)}, **auth_headers)
    resp_fu = student_portal_follow_up_view(req_fu)
    assert resp_fu.status_code == 200, f"Follow up status was {resp_fu.status_code}"
    fu_data = json.loads(resp_fu.content.decode('utf-8'))['data']
    
    assert fu_data['pagination']['total_items'] >= 2, "Should return multiple historical activities"
    assert 'summary_stats' in fu_data
    assert fu_data['summary_stats']['total_memorization'] >= 1
    assert fu_data['summary_stats']['total_behavior'] >= 1

    # Test filtering by type = 'MEMORIZATION'
    req_mem = rf.get('/api/student-portal/follow-up/', {'student_id': str(student.id), 'type': 'MEMORIZATION'}, **auth_headers)
    resp_mem = student_portal_follow_up_view(req_mem)
    mem_data = json.loads(resp_mem.content.decode('utf-8'))['data']
    for rec in mem_data['records']:
        assert rec['type'] == 'MEMORIZATION'
    print(f"  --> PASSED: Follow-up returned {fu_data['pagination']['total_items']} items with accurate types and stats.")

    # -------------------------------------------------------------
    # TEST 7: Notifications API Endpoint (GET & Mark-as-read)
    # -------------------------------------------------------------
    print("\n[TEST 7] Testing Student Notifications API & Mark-Read...")
    req_notif = rf.get('/api/student-portal/notifications/', {'student_id': str(student.id)}, **auth_headers)
    resp_notif = student_portal_notifications_view(req_notif)
    assert resp_notif.status_code == 200
    notif_data = json.loads(resp_notif.content.decode('utf-8'))['data']
    assert notif_data['unread_count'] >= 1, "Unread count should be >= 1"
    assert len(notif_data['notifications']) >= 1

    # Mark all read
    req_mark = rf.post('/api/student-portal/notifications/mark-read/', {}, **auth_headers)
    resp_mark = student_portal_mark_notification_read_view(req_mark)
    assert resp_mark.status_code == 200

    resp_notif2 = student_portal_notifications_view(req_notif)
    notif_data2 = json.loads(resp_notif2.content.decode('utf-8'))['data']
    assert notif_data2['unread_count'] == 0, "All notifications should now be marked as read"
    print("  --> PASSED: Notifications list and mark-read verified successfully.")

    print("\n" + "=" * 60)
    print("ALL 7 STUDENT INTEGRATION & NOTIFICATION TESTS PASSED (100%)!")
    print("=" * 60)

if __name__ == '__main__':
    run_tests()

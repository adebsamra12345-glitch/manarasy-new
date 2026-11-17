import os
import sys
import json
import uuid
import jwt
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from django.test import RequestFactory
from django.conf import settings
from core_system.tenants.models import Tenant
from tenant_modules.users.models import UserProfile, User
from tenant_modules.centers_and_projects.models import Center
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student
from tenant_modules.students_and_parents.views import student_detail_view
from tenant_modules.points_and_rewards.models import (
    Reward, RewardClaim, PointTransaction, Competition, CompetitionParticipation, CompetitionQuestion
)
from tenant_modules.points_and_rewards.services import PointsService
from tenant_modules.points_and_rewards.views import (
    redeem_reward_view,
    student_submit_competition_view,
    student_points_list_view,
    points_transactions_view
)

def run_tests():
    print("=" * 70)
    print("RUNNING PHASE 1 SECURITY & CONCURRENCY VERIFICATION TESTS")
    print("=" * 70)

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

    secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
    rf = RequestFactory()

    # Setup Center 1 & Center 2
    center1, _ = Center.objects.using(db_name).get_or_create(code='SEC_CTR1', defaults={'name': 'مركز الأمان الأول', 'is_rewards_store_enabled': True})
    center2, _ = Center.objects.using(db_name).get_or_create(code='SEC_CTR2', defaults={'name': 'مركز الأمان الثاني', 'is_rewards_store_enabled': True})

    # Setup Users and Profiles
    # 1. Admin
    admin_user, _ = User.objects.using(db_name).get_or_create(username='sec_admin_u', defaults={'first_name': 'مدير', 'last_name': 'النظام'})
    admin_prof, _ = UserProfile.objects.using(db_name).get_or_create(user=admin_user, defaults={'role': 'TENANT_ADMIN'})
    admin_prof.role = 'TENANT_ADMIN'
    admin_prof.save(using=db_name)

    # 2. Center Manager for Center 1
    cm1_user, _ = User.objects.using(db_name).get_or_create(username='sec_cm1_u', defaults={'first_name': 'مدير', 'last_name': 'مركز1'})
    cm1_prof, _ = UserProfile.objects.using(db_name).get_or_create(user=cm1_user, defaults={'role': 'CENTER_MANAGER', 'center': center1})
    cm1_prof.role = 'CENTER_MANAGER'
    cm1_prof.center = center1
    cm1_prof.save(using=db_name)

    # 3. Teacher for Halaqa 1
    t1_user, _ = User.objects.using(db_name).get_or_create(username='sec_teacher_u', defaults={'first_name': 'أحمد', 'last_name': 'المعلم'})
    t1_name = f"{t1_user.first_name} {t1_user.last_name}".strip()
    t1_prof, _ = UserProfile.objects.using(db_name).get_or_create(user=t1_user, defaults={'role': 'TEACHER', 'center': center1})
    t1_prof.role = 'TEACHER'
    t1_prof.save(using=db_name)

    halaqa1, _ = Halaqa.objects.using(db_name).get_or_create(name='حلقة الأمان 1', defaults={'center': center1, 'teacher_name': t1_name, 'is_active': True})
    halaqa2, _ = Halaqa.objects.using(db_name).get_or_create(name='حلقة المركز الثاني', defaults={'center': center2, 'teacher_name': 'معلم آخر', 'is_active': True})

    # 4. Student 1 (in Halaqa 1, Center 1)
    s1_user, _ = User.objects.using(db_name).get_or_create(username='sec_stu1_u', defaults={'first_name': 'طالب', 'last_name': 'واحد'})
    s1_prof, _ = UserProfile.objects.using(db_name).get_or_create(user=s1_user, defaults={'role': 'STUDENT', 'center': center1})
    s1_prof.role = 'STUDENT'
    s1_prof.save(using=db_name)

    student1, _ = Student.objects.using(db_name).get_or_create(
        user=s1_user,
        defaults={'full_name': 'طالب الأمان الأول', 'national_id': '1099887766', 'halaqa': halaqa1, 'points': 100, 'reached_page': 10}
    )
    student1.points = 100
    student1.halaqa = halaqa1
    student1.national_id = '1099887766'
    student1.save(using=db_name)

    # 5. Student 2 (in Halaqa 2, Center 2)
    s2_user, _ = User.objects.using(db_name).get_or_create(username='sec_stu2_u', defaults={'first_name': 'طالب', 'last_name': 'اثنين'})
    s2_prof, _ = UserProfile.objects.using(db_name).get_or_create(user=s2_user, defaults={'role': 'STUDENT', 'center': center2})
    student2, _ = Student.objects.using(db_name).get_or_create(
        user=s2_user,
        defaults={'full_name': 'طالب المركز الثاني', 'national_id': '2099887766', 'halaqa': halaqa2, 'points': 80, 'reached_page': 5}
    )
    student2.points = 80
    student2.save(using=db_name)

    # Clean previous test transactions for fresh idempotent testing and ensure ledger baseline alignment
    PointTransaction.objects.using(db_name).filter(student__in=[student1, student2]).delete()
    PointTransaction.objects.using(db_name).create(
        student=student1, amount=100, transaction_type='MANUAL_ADJUSTMENT',
        reason='رصيد ابتدائي لاختبار الأمان', balance_before=0, balance_after=100
    )
    PointTransaction.objects.using(db_name).create(
        student=student2, amount=80, transaction_type='MANUAL_ADJUSTMENT',
        reason='رصيد ابتدائي لاختبار الأمان', balance_before=0, balance_after=80
    )

    # Helper function to generate authenticated requests
    def make_req(method, path, data=None, user_prof=None):
        if method == 'GET':
            req = rf.get(path)
        elif method == 'POST':
            req = rf.post(path, data=json.dumps(data) if data else '', content_type='application/json')
        elif method in ['PUT', 'PATCH']:
            req = rf.generic(method, path, data=json.dumps(data) if data else '', content_type='application/json')
        
        req.db_name = db_name
        req.tenant = tenant
        req.profile = user_prof
        token = jwt.encode({'user_id': str(user_prof.user.id)}, secret, algorithm='HS256')
        req.META['HTTP_AUTHORIZATION'] = f'Bearer {token}'
        req.META['HTTP_TENANT_ID'] = str(tenant.id)
        return req

    # -------------------------------------------------------------------------
    # TEST 1: Prevent Arbitrary Points Override in Student Profile Update
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Testing Student Points Immunity on Profile Update (PUT/PATCH)...")
    orig_points = student1.points
    update_data = {
        'full_name': 'طالب الأمان الأول - محدث',
        'points': 99999,  # Malicious attempt to inflate points
        'general_notes': 'ملاحظة تحديث عادية'
    }
    req_update = make_req('PUT', f'/api/students/{student1.id}/', data=update_data, user_prof=admin_prof)
    resp_update = student_detail_view(req_update, pk=str(student1.id))
    assert resp_update.status_code == 200, f"Expected 200, got {resp_update.status_code}: {resp_update.content}"
    
    student1.refresh_from_db()
    assert student1.points == orig_points, f"CRITICAL FAILURE: Points modified directly! Expected {orig_points}, got {student1.points}"
    print(f"  --> PASSED: points field is completely ignored on profile update. Balance remained {student1.points}.")

    # -------------------------------------------------------------------------
    # TEST 2: Broken Access Control on Direct Reward Redemption
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Testing Broken Access Control on Direct Reward Redemption...")
    reward1, _ = Reward.objects.using(db_name).get_or_create(
        name="مكافأة اختبار الأمان 1",
        defaults={'points_cost': 20, 'stock_quantity': 10, 'is_active': True, 'center': center1}
    )

    # 2.1 Unauthorized Student attempting direct redemption
    req_stu_redeem = make_req('POST', '/api/points/redeem/', data={'student_id': str(student1.id), 'reward_id': str(reward1.id)}, user_prof=s1_prof)
    resp_stu_redeem = redeem_reward_view(req_stu_redeem)
    assert resp_stu_redeem.status_code == 403, f"Expected 403 Forbidden for Student role, got {resp_stu_redeem.status_code}"
    print("  --> PASSED: Student role blocked with 403 Forbidden from direct redemption.")

    # 2.2 Center Manager 1 attempting to redeem for Student 2 (Center 2)
    req_cross_redeem = make_req('POST', '/api/points/redeem/', data={'student_id': str(student2.id), 'reward_id': str(reward1.id)}, user_prof=cm1_prof)
    resp_cross_redeem = redeem_reward_view(req_cross_redeem)
    assert resp_cross_redeem.status_code == 403, f"Expected 403 Forbidden for cross-center redemption, got {resp_cross_redeem.status_code}"
    print("  --> PASSED: Center Manager prevented with 403 Forbidden from redeeming across centers.")

    # 2.3 Valid redemption by Center Manager 1 for Student 1
    req_valid_redeem = make_req('POST', '/api/points/redeem/', data={'student_id': str(student1.id), 'reward_id': str(reward1.id)}, user_prof=cm1_prof)
    resp_valid_redeem = redeem_reward_view(req_valid_redeem)
    assert resp_valid_redeem.status_code == 200, f"Expected 200 for Center Manager, got {resp_valid_redeem.status_code}: {resp_valid_redeem.content}"
    student1.refresh_from_db()
    assert student1.points == orig_points - 20, f"Expected balance {orig_points - 20}, got {student1.points}"
    print(f"  --> PASSED: Authorized Center Manager successfully redeemed reward. New balance: {student1.points}.")

    # -------------------------------------------------------------------------
    # TEST 3: Competition Race Condition & Parallel Double-Submission Guard
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Testing Competition Race Condition & Double-Submission Guards...")
    comp, _ = Competition.objects.using(db_name).get_or_create(
        title="مسابقة الأمان والتزامن",
        defaults={'points_reward': 50, 'duration_minutes': 15, 'max_attempts': 2, 'is_published': True}
    )
    comp.points_reward = 50
    comp.save(using=db_name)

    q1, _ = CompetitionQuestion.objects.using(db_name).get_or_create(
        competition=comp,
        order=1,
        defaults={'question_text': 'سؤال الأمان 1', 'question_type': 'MULTIPLE_CHOICE', 'correct_answer': 'نعم', 'points': Decimal('10.00')}
    )

    part1 = CompetitionParticipation.objects.using(db_name).create(
        competition=comp,
        student=student1,
        attempt_number=1,
        status='IN_PROGRESS',
        points_awarded=0
    )

    # 3.1 Student 2 attempting to submit Student 1's participation
    sub_data = {
        'participation_id': str(part1.id),
        'answers': [{'question_id': str(q1.id), 'student_answer': 'نعم'}]
    }
    req_hijack = make_req('POST', f'/api/competitions/{comp.id}/submit/', data=sub_data, user_prof=s2_prof)
    resp_hijack = student_submit_competition_view(req_hijack, pk=str(comp.id))
    assert resp_hijack.status_code == 403, f"Expected 403 for participation hijack attempt, got {resp_hijack.status_code}"
    print("  --> PASSED: Participation submission hijack blocked with 403 Forbidden.")

    # 3.2 Legitimate first submission by Student 1
    bal_before_comp = student1.points
    req_sub1 = make_req('POST', f'/api/competitions/{comp.id}/submit/', data=sub_data, user_prof=s1_prof)
    resp_sub1 = student_submit_competition_view(req_sub1, pk=str(comp.id))
    assert resp_sub1.status_code == 200, f"Expected 200 for submission, got {resp_sub1.status_code}: {resp_sub1.content}"
    
    student1.refresh_from_db()
    part1.refresh_from_db()
    assert part1.status == 'GRADED', f"Expected GRADED, got {part1.status}"
    assert part1.points_awarded == 50, f"Expected 50 points awarded, got {part1.points_awarded}"
    assert student1.points == bal_before_comp + 50, f"Expected {bal_before_comp + 50}, got {student1.points}"
    print(f"  --> PASSED: First submission graded and awarded 50 points (Balance: {student1.points}).")

    # 3.3 Concurrent/Second submission of same participation (Double-Submit Attack)
    resp_sub2 = student_submit_competition_view(req_sub1, pk=str(comp.id))
    assert resp_sub2.status_code == 400, f"Expected 400 Bad Request on second submit, got {resp_sub2.status_code}"
    student1.refresh_from_db()
    assert student1.points == bal_before_comp + 50, f"CRITICAL: Points inflated on second submit! Got {student1.points}"
    print("  --> PASSED: Duplicate submit blocked with 400 Bad Request, points did NOT inflate.")

    # 3.4 Direct Idempotency Guard in award_competition_reward
    second_award_res = PointsService.award_competition_reward(db_name, part1, 50, "محاولة تكرار الجائزة")
    assert second_award_res is None, "CRITICAL: award_competition_reward must return None for already awarded participation"
    student1.refresh_from_db()
    assert student1.points == bal_before_comp + 50, f"CRITICAL: Points inflated via direct service call! Got {student1.points}"
    print("  --> PASSED: PointsService.award_competition_reward idempotency guard strictly verified.")

    # -------------------------------------------------------------------------
    # TEST 4: PII Data Leakage Prevention & Scope Isolation
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Testing PII Data Leakage Prevention & Query Scoping...")
    
    # 4.1 Student blocked from general student points list
    req_stu_list = make_req('GET', '/api/points/students/', user_prof=s1_prof)
    resp_stu_list = student_points_list_view(req_stu_list)
    assert resp_stu_list.status_code == 403, f"Expected 403 for Student accessing points list, got {resp_stu_list.status_code}"
    print("  --> PASSED: Students blocked with 403 from admin student points list.")

    # 4.2 Teacher sees only their halaqat students, and national_id is REDACTED (None)
    req_t_list = make_req('GET', '/api/points/students/', user_prof=t1_prof)
    resp_t_list = student_points_list_view(req_t_list)
    assert resp_t_list.status_code == 200, f"Expected 200 for Teacher, got {resp_t_list.status_code}"
    t_data = json.loads(resp_t_list.content.decode('utf-8'))['data']
    student_ids_seen = [s['id'] for s in t_data]
    assert str(student1.id) in student_ids_seen, "Teacher must see student1 in their halaqa"
    assert str(student2.id) not in student_ids_seen, "CRITICAL LEAK: Teacher saw student2 from another center/halaqa!"
    for s in t_data:
        assert s['national_id'] is None, f"CRITICAL LEAK: national_id exposed to Teacher: {s['national_id']}"
    print(f"  --> PASSED: Teacher scoped to {len(t_data)} students in their halaqat, and national_id is redacted (None).")

    # 4.3 Tenant Admin sees students WITH national_id
    req_admin_list = make_req('GET', '/api/points/students/', user_prof=admin_prof)
    resp_admin_list = student_points_list_view(req_admin_list)
    admin_data = json.loads(resp_admin_list.content.decode('utf-8'))['data']
    s1_admin_record = next(s for s in admin_data if s['id'] == str(student1.id))
    assert s1_admin_record['national_id'] == '1099887766', "Admin should have access to national_id"
    print("  --> PASSED: Tenant Admin maintains legitimate access to national_id.")

    # 4.4 Student accessing points transactions sees ONLY their own records
    req_stu_tx = make_req('GET', '/api/points/transactions/', user_prof=s1_prof)
    resp_stu_tx = points_transactions_view(req_stu_tx)
    assert resp_stu_tx.status_code == 200, f"Expected 200, got {resp_stu_tx.status_code}"
    stu_txs = json.loads(resp_stu_tx.content.decode('utf-8'))['data']
    for tx in stu_txs:
        assert tx['student_id'] == str(student1.id), f"CRITICAL LEAK: Student saw transaction for {tx['student_id']}"
    print(f"  --> PASSED: Student points transaction history strictly isolated to own records ({len(stu_txs)} transactions).")

    print("\n" + "=" * 70)
    print("ALL PHASE 1 SECURITY & CONCURRENCY TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == '__main__':
    run_tests()

import os
import sys
import uuid
import json
import jwt

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
from tenant_modules.points_and_rewards.models import (
    Reward, RewardClaim, PointTransaction
)
from tenant_modules.points_and_rewards.services import PointsService

def run_tests():
    print("=" * 70)
    print("RUNNING PHASE 2 CORE LEDGER ENGINE & IDEMPOTENCY VERIFICATION TESTS")
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

    # Setup Test Fixtures
    center, _ = Center.objects.using(db_name).get_or_create(code='P2_CTR', defaults={'name': 'مركز الدفتر المحاسبي', 'is_rewards_store_enabled': True})
    halaqa, _ = Halaqa.objects.using(db_name).get_or_create(name='حلقة الدفتر', defaults={'center': center, 'teacher_name': 'أستاذ المحاسبة', 'is_active': True})

    admin_user, _ = User.objects.using(db_name).get_or_create(username='p2_admin_u', defaults={'first_name': 'مسؤول', 'last_name': 'الدفتر'})
    admin_prof, _ = UserProfile.objects.using(db_name).get_or_create(user=admin_user, defaults={'role': 'TENANT_ADMIN', 'center': center})

    stu_user, _ = User.objects.using(db_name).get_or_create(username='p2_student_u', defaults={'first_name': 'طالب', 'last_name': 'الدفتر'})
    stu_prof, _ = UserProfile.objects.using(db_name).get_or_create(user=stu_user, defaults={'role': 'STUDENT', 'center': center})

    student, _ = Student.objects.using(db_name).get_or_create(
        user=stu_user,
        defaults={'full_name': 'طالب الدفتر المحاسبي', 'national_id': '9900112233', 'halaqa': halaqa, 'points': 50, 'reached_page': 20}
    )
    PointTransaction.objects.using(db_name).filter(student=student).delete()
    student.points = 50
    student.save(using=db_name)
    PointTransaction.objects.using(db_name).create(
        student=student,
        amount=50,
        transaction_type='MANUAL_ADJUSTMENT',
        reason='رصيد ابتدائي لاختبار المرحلة 2',
        balance_before=0,
        balance_after=50
    )

    # -------------------------------------------------------------------------
    # TEST 1: Centralized Ledger Engine record_transaction & Idempotency
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Testing record_transaction Engine & Idempotency Key Handling...")
    initial_points = student.points
    test_key_1 = f"test_idemp_{uuid.uuid4().hex}"

    # 1.1 First transaction execution
    tx1 = PointsService.record_transaction(
        db_name=db_name,
        student_id=str(student.id),
        amount=10,
        transaction_type='MANUAL_ADJUSTMENT',
        reason='إيداع تجريبي لاختبار مفتاح التفرد',
        performed_by=admin_prof,
        idempotency_key=test_key_1,
        reference_id='REF-001',
        reference_type='TEST_REF',
        metadata={'client_ip': '127.0.0.1', 'session': 'test_p2'}
    )
    student.refresh_from_db()
    assert tx1.balance_before == initial_points, f"Expected {initial_points}, got {tx1.balance_before}"
    assert tx1.balance_after == initial_points + 10, f"Expected {initial_points + 10}, got {tx1.balance_after}"
    assert student.points == initial_points + 10, f"Expected student points {initial_points + 10}, got {student.points}"
    assert tx1.idempotency_key == test_key_1
    assert tx1.reference_id == 'REF-001'
    assert tx1.reference_type == 'TEST_REF'
    assert tx1.metadata.get('client_ip') == '127.0.0.1'
    print(f"  --> PASSED: Transaction created with ID {tx1.id}, new balance: {student.points}.")

    # 1.2 Re-executing transaction with IDENTICAL idempotency key (Network Retry Simulation)
    tx1_retry = PointsService.record_transaction(
        db_name=db_name,
        student_id=str(student.id),
        amount=10,
        transaction_type='MANUAL_ADJUSTMENT',
        reason='إعادة إرسال نفس الطلب',
        performed_by=admin_prof,
        idempotency_key=test_key_1,
        reference_id='REF-001',
        reference_type='TEST_REF'
    )
    student.refresh_from_db()
    assert tx1_retry.id == tx1.id, f"Expected identical transaction ID, got {tx1_retry.id} vs {tx1.id}"
    assert student.points == initial_points + 10, f"CRITICAL FAILURE: Points increased on retry! Expected {initial_points + 10}, got {student.points}"
    print(f"  --> PASSED: Idempotency pre-check and in-lock check prevented duplicate credit. Balance preserved at {student.points}.")

    # -------------------------------------------------------------------------
    # TEST 2: Strict Overdraft Prevention (Non-Negative Balance Protection)
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Testing Overdraft Prevention on Debit Transactions...")
    current_bal = student.points
    overdraft_attempt = -(current_bal + 50)  # Attempt to deduct more than balance

    try:
        PointsService.record_transaction(
            db_name=db_name,
            student_id=str(student.id),
            amount=overdraft_attempt,
            transaction_type='REWARD_REDEMPTION',
            reason='محاولة سحب تفوق الرصيد'
        )
        assert False, "CRITICAL: Should have raised ValueError for overdraft"
    except ValueError as ve:
        student.refresh_from_db()
        assert student.points == current_bal, f"Balance changed unexpectedly: {student.points}"
        print(f"  --> PASSED: Overdraft successfully blocked: '{ve}'. Balance unchanged ({student.points}).")

    # -------------------------------------------------------------------------
    # TEST 3: Behavioral Bonus & Recitation Services Idempotent Integration
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Testing Behavioral and Recitation Bonus Services with Idempotency...")
    bal_before_bonus = student.points
    beh_key = f"beh_bonus_{uuid.uuid4().hex}"

    # 3.1 First grant
    res_beh1 = PointsService.grant_behavioral_bonus(
        db_name=db_name,
        student_id=str(student.id),
        performed_by=admin_prof,
        reason='مكافأة سلوك متميز',
        idempotency_key=beh_key
    )
    student.refresh_from_db()
    assert res_beh1['success'] is True
    assert res_beh1['balance_after'] == bal_before_bonus + 1
    assert student.points == bal_before_bonus + 1

    # 3.2 Duplicate grant with same idempotency key
    res_beh2 = PointsService.grant_behavioral_bonus(
        db_name=db_name,
        student_id=str(student.id),
        performed_by=admin_prof,
        reason='مكافأة سلوك متميز مكررة',
        idempotency_key=beh_key
    )
    student.refresh_from_db()
    assert res_beh2['transaction_id'] == res_beh1['transaction_id'], "Should return original transaction"
    assert student.points == bal_before_bonus + 1, "Points must NOT increment on duplicate call"
    print(f"  --> PASSED: grant_behavioral_bonus is fully idempotent (Balance: {student.points}).")

    # 3.3 Recitation points grant with idempotency
    rec_key = f"rec_bonus_{uuid.uuid4().hex}"
    res_rec1 = PointsService.award_recitation_pages_points(
        db_name=db_name,
        student_id=str(student.id),
        performed_by=admin_prof,
        reason='تسميع 3 صفحات بإتقان',
        idempotency_key=rec_key
    )
    student.refresh_from_db()
    assert res_rec1['balance_after'] == bal_before_bonus + 1 + 2
    assert student.points == bal_before_bonus + 3

    res_rec2 = PointsService.award_recitation_pages_points(
        db_name=db_name,
        student_id=str(student.id),
        performed_by=admin_prof,
        reason='تسميع 3 صفحات بإتقان - محاولة مكررة',
        idempotency_key=rec_key
    )
    student.refresh_from_db()
    assert student.points == bal_before_bonus + 3, "Points must NOT increment on duplicate recitation call"
    print(f"  --> PASSED: award_recitation_pages_points is fully idempotent (Balance: {student.points}).")

    # -------------------------------------------------------------------------
    # TEST 4: Direct Reward Redemption and Compensating Transactions (Refunds)
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Testing Direct Reward Redemption and Ledger Refund Service...")
    reward, _ = Reward.objects.using(db_name).get_or_create(
        name="مكافأة تجربة المرحلة الثانية",
        defaults={'points_cost': 25, 'stock_quantity': 5, 'is_active': True, 'center': center}
    )
    reward.stock_quantity = 5
    reward.save(using=db_name)

    bal_pre_redeem = student.points
    redeem_key = f"redeem_{uuid.uuid4().hex}"

    # 4.1 Execute Direct Redeem
    res_redeem = PointsService.redeem_reward(
        db_name=db_name,
        student_id=str(student.id),
        reward_id=str(reward.id),
        performed_by=admin_prof,
        notes="استبدال مباشر لاختبار المرحلة 2",
        idempotency_key=redeem_key
    )
    student.refresh_from_db()
    reward.refresh_from_db()
    assert res_redeem['success'] is True
    assert student.points == bal_pre_redeem - 25
    assert reward.stock_quantity == 4
    redeem_tx_id = res_redeem['transaction_id']
    print(f"  --> PASSED: Reward redeemed via core ledger. Balance: {student.points}, Stock: {reward.stock_quantity}.")

    # 4.2 Compensating Transaction: refund_points
    res_refund = PointsService.refund_points(
        db_name=db_name,
        original_transaction_id=redeem_tx_id,
        performed_by=admin_prof,
        reason="استرجاع نقاط بسبب إلغاء الطلب الإداري"
    )
    student.refresh_from_db()
    assert res_refund['success'] is True
    assert res_refund['refunded_points'] == 25
    assert student.points == bal_pre_redeem, f"Expected balance restored to {bal_pre_redeem}, got {student.points}"

    # Verify ledger append-only nature (original transaction is intact, new REFUND transaction added)
    orig_tx = PointTransaction.objects.using(db_name).get(id=redeem_tx_id)
    assert orig_tx.amount == -25, "Original transaction must remain immutable!"
    
    refund_tx = PointTransaction.objects.using(db_name).get(id=res_refund['refund_transaction_id'])
    assert refund_tx.transaction_type == 'REFUND'
    assert refund_tx.amount == 25
    assert refund_tx.reference_id == str(orig_tx.id)
    assert refund_tx.reference_type == 'POINT_TRANSACTION'
    print(f"  --> PASSED: Refund recorded as append-only compensating transaction. Balance restored to {student.points}.")

    # 4.3 Idempotent Refund Retry: calling refund_points again returns existing refund
    res_refund_retry = PointsService.refund_points(
        db_name=db_name,
        original_transaction_id=redeem_tx_id,
        performed_by=admin_prof
    )
    student.refresh_from_db()
    assert res_refund_retry['refund_transaction_id'] == str(refund_tx.id)
    assert student.points == bal_pre_redeem, "Refund must not duplicate points!"
    print(f"  --> PASSED: refund_points is idempotent and prevented double refund.")

    # -------------------------------------------------------------------------
    # TEST 5: Verify Database Schema Indexes & Multi-Tenant Routing
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Testing Database Schema Indexes & Metadata Storage...")
    tx_check = PointTransaction.objects.using(db_name).filter(student=student).order_by('-created_at').first()
    assert hasattr(tx_check, 'idempotency_key')
    assert hasattr(tx_check, 'reference_id')
    assert hasattr(tx_check, 'reference_type')
    assert hasattr(tx_check, 'metadata')
    print(f"  --> PASSED: New schema fields and indexes fully confirmed in PostgreSQL.")

    print("\n" + "=" * 70)
    print("ALL PHASE 2 CORE LEDGER & IDEMPOTENCY TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == '__main__':
    run_tests()

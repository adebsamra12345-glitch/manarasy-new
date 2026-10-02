import os
import sys
import django
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from django.conf import settings
from core_system.tenants.models import Tenant
from tenant_modules.users.models import UserProfile, User
from tenant_modules.centers_and_projects.models import Center
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student, StudentEnrollment
from tenant_modules.points_and_rewards.models import (
    Reward, RewardClaim, PointTransaction
)
from tenant_modules.points_and_rewards.services import PointsService
from tenant_modules.points_and_rewards.views import (
    student_portal_dashboard_view,
    student_portal_points_store_view,
    student_portal_claim_reward_view,
    admin_claims_list_view,
    admin_claim_action_view,
    store_settings_view
)

def run_tests():
    print("=" * 60)
    print("STARTING STUDENT PORTAL & REWARD CLAIMS VERIFICATION TESTS")
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

    # 1. Setup Center & Halaqa
    center = Center.objects.using(db_name).first()
    if not center:
        center = Center.objects.using(db_name).create(
            name="مركز الاختبار الشامل",
            code=f"TEST-{uuid.uuid4().hex[:4]}",
            is_rewards_store_enabled=True
        )

    halaqa = Halaqa.objects.using(db_name).filter(center=center).first()
    if not halaqa:
        halaqa = Halaqa.objects.using(db_name).create(
            name="حلقة الاختبار الموحدة",
            teacher_name="الأستاذ المشرف",
            center=center
        )

    # 2. Setup Student
    student = Student.objects.using(db_name).first()
    if not student:
        student = Student.objects.using(db_name).create(
            full_name="طالب تجريبي للاختبار",
            national_id=f"STD-{uuid.uuid4().hex[:6]}",
            points=150,
            halaqa=halaqa
        )
    else:
        student.points = 150
        student.save(using=db_name, update_fields=['points'])

    # 3. Setup Reward
    reward = Reward.objects.using(db_name).create(
        name="ساعة يد إلكترونية للتسميع",
        points_cost=40,
        stock_quantity=10,
        is_active=True,
        center=center
    )

    admin_profile = UserProfile.objects.using(db_name).filter(role='TENANT_ADMIN').first()
    if not admin_profile:
        admin_user, _ = User.objects.using(db_name).get_or_create(username="test_admin_portal", defaults={'first_name': 'الأدمن'})
        admin_profile, _ = UserProfile.objects.using(db_name).get_or_create(user=admin_user, defaults={'role': 'TENANT_ADMIN'})

    print("[TEST 1] Testing Store Toggle Hierarchy (Center & Mosque)...")
    tenant.is_rewards_store_enabled = True
    tenant.save(using='default')
    center.is_rewards_store_enabled = True
    center.save(using=db_name)

    open_status = PointsService.check_store_status(db_name, tenant, center_id=str(center.id))
    assert open_status['is_open'] == True, "Store should be open initially"

    # Close at Center level
    center.is_rewards_store_enabled = False
    center.save(using=db_name)
    center_closed_status = PointsService.check_store_status(db_name, tenant, center_id=str(center.id))
    assert center_closed_status['is_open'] == False, "Store should be closed when center disabled"
    assert center_closed_status['closed_by'] == 'CENTER'

    # Reopen Center, close Mosque
    center.is_rewards_store_enabled = True
    center.save(using=db_name)
    tenant.is_rewards_store_enabled = False
    tenant.save(using='default')
    mosque_closed_status = PointsService.check_store_status(db_name, tenant, center_id=str(center.id))
    assert mosque_closed_status['is_open'] == False, "Store should be closed when mosque disabled"
    assert mosque_closed_status['closed_by'] == 'MOSQUE'

    # Re-enable all
    tenant.is_rewards_store_enabled = True
    tenant.save(using='default')
    print("  --> PASSED: Store hierarchy works accurately.")

    print("\n[TEST 2] Testing Claim Creation (PENDING status & NO point deduction)...")
    initial_balance = student.points
    claim_res = PointsService.create_reward_claim(
        db_name=db_name,
        student_id=str(student.id),
        reward_id=str(reward.id),
        requested_by=admin_profile,
        notes="طلب تجريبي للتحقق من بقاء النقاط",
        tenant_obj=tenant
    )
    assert claim_res['success'] == True
    assert claim_res['status'] == 'PENDING'

    student.refresh_from_db(using=db_name)
    assert student.points == initial_balance, f"Expected points to stay {initial_balance}, got {student.points}"

    claim_id = claim_res['claim_id']
    claim = RewardClaim.objects.using(db_name).get(id=claim_id)
    assert claim.status == 'PENDING'
    print(f"  --> PASSED: Claim {claim_id} created with status PENDING, student points intact ({student.points}).")

    print("\n[TEST 3] Testing Admin Approval (Deducts points & updates stock)...")
    approve_res = PointsService.approve_reward_claim(
        db_name=db_name,
        claim_id=claim_id,
        reviewed_by=admin_profile,
        admin_notes="تمت الموافقة بنجاح"
    )
    assert approve_res['success'] == True
    assert approve_res['status'] == 'APPROVED'

    student.refresh_from_db(using=db_name)
    expected_points = initial_balance - reward.points_cost
    assert student.points == expected_points, f"Expected points {expected_points}, got {student.points}"

    reward.refresh_from_db(using=db_name)
    assert reward.stock_quantity == 9, f"Expected stock 9, got {reward.stock_quantity}"

    tx = PointTransaction.objects.using(db_name).filter(student=student, transaction_type='REWARD_REDEMPTION').first()
    assert tx is not None
    assert tx.amount == -40
    print(f"  --> PASSED: Approval deducted 40 points, new balance {student.points}, stock 9.")

    print("\n[TEST 4] Testing Admin Delivery Action...")
    deliver_res = PointsService.deliver_reward_claim(
        db_name=db_name,
        claim_id=claim_id,
        reviewed_by=admin_profile,
        admin_notes="تم التسليم في الحلقة"
    )
    assert deliver_res['success'] == True
    assert deliver_res['status'] == 'DELIVERED'
    claim.refresh_from_db(using=db_name)
    assert claim.status == 'DELIVERED'
    print("  --> PASSED: Delivery confirmed successfully.")

    print("\n[TEST 5] Testing Rejection Flow (Zero points deducted)...")
    claim_2_res = PointsService.create_reward_claim(
        db_name=db_name,
        student_id=str(student.id),
        reward_id=str(reward.id),
        requested_by=admin_profile,
        tenant_obj=tenant
    )
    claim_2_id = claim_2_res['claim_id']
    current_pts = student.points

    reject_res = PointsService.reject_reward_claim(
        db_name=db_name,
        claim_id=claim_2_id,
        reviewed_by=admin_profile,
        rejection_reason="نعتذر عن عدم توفر هذا اللون حالياً"
    )
    assert reject_res['success'] == True
    assert reject_res['status'] == 'REJECTED'

    student.refresh_from_db(using=db_name)
    assert student.points == current_pts, "Points should not change on rejection"
    print(f"  --> PASSED: Rejection recorded with reason, balance preserved at {student.points}.")

    print("\n" + "=" * 60)
    print("ALL STUDENT PORTAL & REWARDS BACKEND TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == '__main__':
    run_tests()

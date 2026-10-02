from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from core_system.tenants.models import Tenant
from tenant_modules.users.models import UserProfile
from tenant_modules.centers_and_projects.models import Center
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student, StudentEnrollment
from tenant_modules.attendance.models import AttendanceLog, HalaqaSession
from tenant_modules.recitation_and_sabr.models import RecitationLog
from tenant_modules.points_and_rewards.models import (
    Reward, RewardClaim, PointTransaction, Competition
)
from tenant_modules.points_and_rewards.services import PointsService

User = get_user_model()

class PointsAndStudentPortalTestCase(TestCase):
    def setUp(self):
        # 1. Master Tenant
        self.tenant = Tenant.objects.create(
            name="مسجد النور التجريبي",
            subdomain="alnoor",
            db_name="default",
            is_rewards_store_enabled=True
        )

        # 2. Center & Halaqa
        self.center = Center.objects.create(
            name="مركز الفرقان",
            code="CTR-01",
            is_rewards_store_enabled=True
        )
        self.halaqa = Halaqa.objects.create(
            name="حلقة الإمام عاصم",
            teacher_name="الشيخ أحمد",
            center=self.center
        )

        # 3. Users & Profiles
        self.admin_user = User.objects.create_user(username="admin_user", password="password123")
        self.admin_profile = UserProfile.objects.create(user=self.admin_user, role="TENANT_ADMIN")

        self.student_user = User.objects.create_user(username="student1", password="password123")
        self.student_profile = UserProfile.objects.create(user=self.student_user, role="STUDENT")

        # 4. Student record
        self.student = Student.objects.create(
            full_name="عمر عبد الله",
            national_id="student1",
            points=100,
            halaqa=self.halaqa,
            reached_page=45
        )
        StudentEnrollment.objects.create(
            student=self.student,
            user_profile=self.student_profile,
            halaqa=self.halaqa
        )

        # 5. Reward
        self.reward = Reward.objects.create(
            name="مصحف تهجد فاخر",
            points_cost=30,
            stock_quantity=5,
            is_active=True,
            center=self.center
        )

    def test_claim_creation_pending_no_points_deducted(self):
        """التحقق من إنشاء الطلب بحالة قيد الانتظار وعدم خصم النقاط"""
        initial_points = self.student.points
        res = PointsService.create_reward_claim(
            db_name='default',
            student_id=str(self.student.id),
            reward_id=str(self.reward.id),
            requested_by=self.student_profile,
            notes="أرجو التكرم بالموافقة",
            tenant_obj=self.tenant
        )

        self.assertTrue(res['success'])
        self.assertEqual(res['status'], 'PENDING')

        self.student.refresh_from_db()
        self.assertEqual(self.student.points, initial_points, "يجب عدم خصم أي نقاط عند إنشاء الطلب بحالة قيد الانتظار")

        claim = RewardClaim.objects.get(id=res['claim_id'])
        self.assertEqual(claim.status, 'PENDING')
        self.assertEqual(claim.notes, "أرجو التكرم بالموافقة")

    def test_claim_approval_deducts_points(self):
        """التحقق من خصم النقاط وتحديث المخزون عند موافقة الإدارة"""
        res_create = PointsService.create_reward_claim(
            db_name='default',
            student_id=str(self.student.id),
            reward_id=str(self.reward.id),
            requested_by=self.student_profile,
            tenant_obj=self.tenant
        )
        claim_id = res_create['claim_id']

        # الموافقة
        res_approve = PointsService.approve_reward_claim(
            db_name='default',
            claim_id=claim_id,
            reviewed_by=self.admin_profile,
            admin_notes="مبارك، استمر في التميز"
        )

        self.assertTrue(res_approve['success'])
        self.assertEqual(res_approve['status'], 'APPROVED')

        self.student.refresh_from_db()
        self.assertEqual(self.student.points, 70, "يجب خصم 30 نقطة لتصبح 70 نقطة")

        self.reward.refresh_from_db()
        self.assertEqual(self.reward.stock_quantity, 4, "يجب إنقاص المخزون بمقدار 1")

        # التحقق من تسجيل حركة في دفتر الأستاذ
        tx = PointTransaction.objects.filter(student=self.student, transaction_type='REWARD_REDEMPTION').first()
        self.assertIsNotNone(tx)
        self.assertEqual(tx.amount, -30)

    def test_claim_rejection_no_deduction(self):
        """التحقق من عدم خصم النقاط وتسجيل سبب الرفض عند الرفض"""
        res_create = PointsService.create_reward_claim(
            db_name='default',
            student_id=str(self.student.id),
            reward_id=str(self.reward.id),
            requested_by=self.student_profile,
            tenant_obj=self.tenant
        )
        claim_id = res_create['claim_id']

        res_reject = PointsService.reject_reward_claim(
            db_name='default',
            claim_id=claim_id,
            reviewed_by=self.admin_profile,
            rejection_reason="الكمية محجوزة لمسابقة قادمة"
        )

        self.assertTrue(res_reject['success'])
        self.assertEqual(res_reject['status'], 'REJECTED')

        self.student.refresh_from_db()
        self.assertEqual(self.student.points, 100, "يجب ألا يتم خصم أي نقاط عند الرفض")

    def test_store_toggle_hierarchy(self):
        """التحقق من هرمية إعدادات فتح وإغلاق المتجر (المركز > المسجد)"""
        # الحالة الطبيعية: مفتوح
        status = PointsService.check_store_status('default', self.tenant, center_id=str(self.center.id))
        self.assertTrue(status['is_open'])

        # إغلاق من المركز
        self.center.is_rewards_store_enabled = False
        self.center.save()
        status_center_closed = PointsService.check_store_status('default', self.tenant, center_id=str(self.center.id))
        self.assertFalse(status_center_closed['is_open'])
        self.assertEqual(status_center_closed['closed_by'], 'CENTER')

        # إغلاق من المسجد وفتح المركز
        self.center.is_rewards_store_enabled = True
        self.center.save()
        self.tenant.is_rewards_store_enabled = False
        self.tenant.save()
        status_mosque_closed = PointsService.check_store_status('default', self.tenant, center_id=str(self.center.id))
        self.assertFalse(status_mosque_closed['is_open'])
        self.assertEqual(status_mosque_closed['closed_by'], 'MOSQUE')

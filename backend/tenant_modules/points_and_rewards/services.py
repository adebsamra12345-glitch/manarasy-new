import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from tenant_modules.students_and_parents.models import Student
from tenant_modules.users.models import UserProfile
from tenant_modules.centers_and_projects.models import Center, SystemNotification
from .models import PointTransaction, Reward, RewardClaim, CompetitionParticipation

logger = logging.getLogger(__name__)

class PointsService:
    @staticmethod
    def check_store_status(db_name: str, tenant_obj, center_id=None):
        """
        التحقق من حالة متجر المكافآت وفق هرمية الصلاحيات:
        1. إعداد المركز (إذا أغلِق من المركز، يُعطَّل بالكامل لجميع طلاب المركز).
        2. إعداد المسجد (إذا أغلِق من المسجد، يُعطَّل لجميع الطلاب في المسجد).
        """
        # 1. فحص إعداد المركز إن وجد
        if center_id:
            try:
                center = Center.objects.using(db_name).get(id=center_id)
                if not center.is_rewards_store_enabled:
                    return {
                        "is_open": False,
                        "closed_by": "CENTER",
                        "message": f"متجر المكافآت مغلق حالياً من قبل إدارة المركز ({center.name})"
                    }
            except Center.DoesNotExist:
                pass

        # 2. فحص إعداد المسجد / التينانت
        if tenant_obj and hasattr(tenant_obj, 'is_rewards_store_enabled') and not tenant_obj.is_rewards_store_enabled:
            return {
                "is_open": False,
                "closed_by": "MOSQUE",
                "message": "متجر المكافآت مغلق حالياً من قبل إدارة المسجد"
            }

        return {
            "is_open": True,
            "closed_by": None,
            "message": "متجر المكافآت متاح للشراء واستبدال النقاط"
        }

    @staticmethod
    def grant_behavioral_bonus(db_name: str, student_id: str, performed_by: UserProfile, reason: str):
        """
        منح مكافأة سلوكية للطالب بقيمة (+1) نقطة لسلوك ممتاز.
        يتم تنفيذ العملية بشكل ذري وتسجيل الرصيد قبل وبعد مع كشف الحساب.
        """
        if not reason or not reason.strip():
            raise ValueError("يجب تحديد سبب المكافأة السلوكية")

        # تقييم ممتاز سلوكياً يمنح نقطة واحدة
        BONUS_AMOUNT = 1

        with transaction.atomic(using=db_name):
            try:
                student = Student.objects.using(db_name).select_for_update().select_related('halaqa__center').get(id=student_id)
            except Student.DoesNotExist:
                raise ValueError("الطالب المحدد غير موجود")

            balance_before = student.points
            balance_after = balance_before + BONUS_AMOUNT
            
            student.points = balance_after
            student.save(using=db_name, update_fields=['points'])

            tx = PointTransaction.objects.using(db_name).create(
                student=student,
                amount=BONUS_AMOUNT,
                transaction_type='BEHAVIORAL_BONUS',
                reason=reason.strip(),
                balance_before=balance_before,
                balance_after=balance_after,
                performed_by=performed_by
            )
            
            try:
                from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
                StudentNotificationService.notify_points_awarded(
                    db_name=db_name,
                    student=student,
                    amount=BONUS_AMOUNT,
                    reason=reason.strip(),
                    balance_after=balance_after
                )
            except Exception as notify_err:
                logger.warning(f"Failed to notify points award: {notify_err}")

            return {
                "success": True,
                "student_id": str(student.id),
                "student_name": student.full_name,
                "awarded_points": BONUS_AMOUNT,
                "balance_before": balance_before,
                "balance_after": balance_after,
                "transaction_id": str(tx.id),
                "created_at": tx.created_at.isoformat()
            }

    @staticmethod
    def award_recitation_pages_points(db_name: str, student_id: str, performed_by: UserProfile = None, reason: str = ""):
        """
        منح نقطتين (+2 نقاط) عند تسميع 3 صفحات بتقييم عالي.
        """
        RECITATION_BONUS = 2

        with transaction.atomic(using=db_name):
            try:
                student = Student.objects.using(db_name).select_for_update().select_related('halaqa__center').get(id=student_id)
            except Student.DoesNotExist:
                raise ValueError("الطالب المحدد غير موجود")

            balance_before = student.points
            balance_after = balance_before + RECITATION_BONUS
            
            student.points = balance_after
            student.save(using=db_name, update_fields=['points'])

            tx = PointTransaction.objects.using(db_name).create(
                student=student,
                amount=RECITATION_BONUS,
                transaction_type='RECITATION',
                reason=reason or "مكافأة إتقان: تسميع 3 صفحات بتقييم عالي (+2 نقاط)",
                balance_before=balance_before,
                balance_after=balance_after,
                performed_by=performed_by
            )

            try:
                from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
                StudentNotificationService.notify_points_awarded(
                    db_name=db_name,
                    student=student,
                    amount=RECITATION_BONUS,
                    reason=reason or "مكافأة إتقان: تسميع 3 صفحات بتقييم عالي (+2 نقاط)",
                    balance_after=balance_after
                )
            except Exception as notify_err:
                logger.warning(f"Failed to notify recitation points: {notify_err}")

            return {
                "success": True,
                "student_id": str(student.id),
                "student_name": student.full_name,
                "awarded_points": RECITATION_BONUS,
                "balance_before": balance_before,
                "balance_after": balance_after,
                "transaction_id": str(tx.id),
                "created_at": tx.created_at.isoformat()
            }

    @staticmethod
    def create_reward_claim(db_name: str, student_id: str, reward_id: str, requested_by: UserProfile, notes: str = "", tenant_obj=None):
        """
        إنشاء طلب شراء مكافأة بحالة 'قيد الانتظار' (PENDING).
        قاعدة مهمة: عدم خصم النقاط حتى تتم الموافقة النهائية.
        """
        try:
            student = Student.objects.using(db_name).select_related('halaqa', 'halaqa__center').get(id=student_id)
        except Student.DoesNotExist:
            raise ValueError("الطالب المحدد غير موجود")

        center_id = student.halaqa.center_id if (student.halaqa and student.halaqa.center) else None
        
        # فحص إعدادات فتح وإغلاق المتجر
        store_status = PointsService.check_store_status(db_name, tenant_obj, center_id=center_id)
        if not store_status["is_open"]:
            raise ValueError(store_status["message"])

        with transaction.atomic(using=db_name):
            try:
                reward = Reward.objects.using(db_name).select_for_update().get(id=reward_id)
            except Reward.DoesNotExist:
                raise ValueError("المكافأة المحددة غير موجودة")

            if not reward.is_active:
                raise ValueError("هذه المكافأة غير متاحة حالياً")

            # Check real available stock considering PENDING claims to avoid overbooking
            pending_count = RewardClaim.objects.using(db_name).filter(
                reward=reward, status='PENDING'
            ).count()
            available_stock = reward.stock_quantity - pending_count

            if available_stock <= 0:
                raise ValueError("نفدت الكمية المتاحة من هذه المكافأة (أو تم حجزها لطلبات سابقة)")

            if student.points < reward.points_cost:
                raise ValueError(f"رصيد الطالب غير كافٍ ({student.points} نقطة)، والمطلوب {reward.points_cost} نقطة")

            # إنشاء الطلب بحالة قيد الانتظار دون خصم نقاط
            claim = RewardClaim.objects.using(db_name).create(
                student=student,
                reward=reward,
                points_spent=reward.points_cost,
                status='PENDING',
                notes=notes.strip() if notes else None,
                processed_by=None
            )

        # إرسال إشعار للمسؤول المختص / الطالب
        try:
            from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
            StudentNotificationService.notify_points_redemption(
                db_name=db_name,
                student=student,
                points_spent=reward.points_cost,
                reward_name=reward.name,
                balance_after=student.points,
                is_approval=False
            )
        except Exception as notify_err:
            logger.warning(f"Failed to create claim notification: {notify_err}")

        return {
            "success": True,
            "claim_id": str(claim.id),
            "reward_name": reward.name,
            "points_cost": reward.points_cost,
            "status": claim.status,
            "status_display": "قيد الانتظار",
            "message": "تم إرسال طلب المكافأة بنجاح وهو بانتظار موافقة الإدارة دون خصم من رصيدك حتى الاعتماد."
        }

    @staticmethod
    def approve_reward_claim(db_name: str, claim_id: str, reviewed_by: UserProfile, admin_notes: str = ""):
        """
        الموافقة على طلب المكافأة:
        - التحقق من كفاية الرصيد
        - خصم النقاط فعلياً وتسجيل حركة دفتر الأستاذ
        - تحديث المخزون
        - تغيير الحالة إلى APPROVED
        - إشعار الطالب / ولي الأمر
        """
        with transaction.atomic(using=db_name):
            try:
                claim = RewardClaim.objects.using(db_name).select_for_update().select_related('student__halaqa__center', 'reward').get(id=claim_id)
            except RewardClaim.DoesNotExist:
                raise ValueError("طلب المكافأة غير موجود")

            if claim.status not in ['PENDING']:
                raise ValueError(f"لا يمكن الموافقة على طلب بحالته الحالية ({claim.get_status_display()})")

            student = Student.objects.using(db_name).select_for_update().select_related('halaqa__center').get(id=claim.student_id)
            reward = Reward.objects.using(db_name).select_for_update().get(id=claim.reward_id)

            if student.points < claim.points_spent:
                raise ValueError(f"رصيد الطالب الحالي ({student.points} نقطة) غير كافٍ لإتمام الموافقة ({claim.points_spent} نقطة)")

            if reward.stock_quantity <= 0:
                raise ValueError("المخزون المتاح من هذه المكافأة قد نفد")

            # خصم النقاط
            balance_before = student.points
            balance_after = balance_before - claim.points_spent
            student.points = balance_after
            student.save(using=db_name, update_fields=['points'])

            # خصم المخزون إن كان محدداً
            if reward.stock_quantity > 0:
                reward.stock_quantity -= 1
                reward.save(using=db_name, update_fields=['stock_quantity'])

            # تسجيل الحركة في دفتر حركات النقاط
            tx = PointTransaction.objects.using(db_name).create(
                student=student,
                amount=-claim.points_spent,
                transaction_type='REWARD_REDEMPTION',
                reason=f"موافقة على طلب مكافأة: {reward.name}",
                balance_before=balance_before,
                balance_after=balance_after,
                performed_by=reviewed_by
            )

            # تحديث حالة الطلب
            claim.status = 'APPROVED'
            if admin_notes:
                claim.admin_notes = admin_notes.strip()
            claim.processed_by = reviewed_by
            claim.save(using=db_name, update_fields=['status', 'admin_notes', 'processed_by', 'updated_at'])

            # إشعار الطالب / ولي الأمر
            try:
                from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
                StudentNotificationService.notify_points_redemption(
                    db_name=db_name,
                    student=student,
                    points_spent=claim.points_spent,
                    reward_name=reward.name,
                    balance_after=balance_after,
                    is_approval=True
                )
            except Exception as notify_err:
                logger.warning(f"Notification error on approve: {notify_err}")

            return {
                "success": True,
                "claim_id": str(claim.id),
                "status": "APPROVED",
                "status_display": "تمت الموافقة",
                "balance_after": balance_after,
                "transaction_id": str(tx.id)
            }

    @staticmethod
    def reject_reward_claim(db_name: str, claim_id: str, reviewed_by: UserProfile, rejection_reason: str = "", admin_notes: str = ""):
        """
        رفض طلب المكافأة دون خصم أي نقاط، مع تسجيل السبب وإشعار الطالب / ولي الأمر.
        """
        with transaction.atomic(using=db_name):
            try:
                claim = RewardClaim.objects.using(db_name).select_for_update().select_related('student__halaqa__center', 'reward').get(id=claim_id)
            except RewardClaim.DoesNotExist:
                raise ValueError("طلب المكافأة غير موجود")

            if claim.status not in ['PENDING']:
                raise ValueError(f"لا يمكن رفض طلب بحالته الحالية ({claim.get_status_display()})")

            claim.status = 'REJECTED'
            claim.rejection_reason = rejection_reason.strip() if rejection_reason else "تم رفض الطلب من قبل الإدارة"
            if admin_notes:
                claim.admin_notes = admin_notes.strip()
            claim.processed_by = reviewed_by
            claim.save(using=db_name, update_fields=['status', 'rejection_reason', 'admin_notes', 'processed_by', 'updated_at'])

            student = claim.student
            reward = claim.reward

            # إشعار الطالب / ولي الأمر
            try:
                SystemNotification.objects.using(db_name).create(
                    center=student.halaqa.center if (student.halaqa and student.halaqa.center) else None,
                    title="تم رفض طلب المكافأة",
                    message=f"نعتذر، تم رفض طلب مكافأة ({reward.name}) للطالب {student.full_name}. السبب: {claim.rejection_reason}"
                )
            except Exception as notify_err:
                logger.warning(f"Notification error on reject: {notify_err}")

            return {
                "success": True,
                "claim_id": str(claim.id),
                "status": "REJECTED",
                "status_display": "مرفوض",
                "rejection_reason": claim.rejection_reason
            }

    @staticmethod
    def deliver_reward_claim(db_name: str, claim_id: str, reviewed_by: UserProfile, admin_notes: str = ""):
        """
        تسليم المكافأة للطالب (DELIVERED).
        إذا كان الطلب ما يزال PENDING يتم تنفيذ الموافقة والخصم أولاً ثم التحويل إلى DELIVERED.
        """
        # Pre-check status without locking to handle PENDING -> APPROVED transition
        # outside of the DELIVERED lock boundary (prevent nested locks/transactions queueing)
        try:
            initial_status = RewardClaim.objects.using(db_name).values_list('status', flat=True).get(id=claim_id)
        except RewardClaim.DoesNotExist:
            raise ValueError("طلب المكافأة غير موجود")

        if initial_status == 'REJECTED':
            raise ValueError("لا يمكن تسليم طلب مرفوض")

        if initial_status == 'PENDING':
            # Execute approval first (opens its own transaction and locks appropriately)
            PointsService.approve_reward_claim(db_name, claim_id, reviewed_by, admin_notes)

        with transaction.atomic(using=db_name):
            try:
                claim = RewardClaim.objects.using(db_name).select_for_update().select_related('student__halaqa__center', 'reward').get(id=claim_id)
            except RewardClaim.DoesNotExist:
                raise ValueError("طلب المكافأة غير موجود")

            if claim.status == 'REJECTED':
                raise ValueError("لا يمكن تسليم طلب مرفوض")

            if claim.status == 'PENDING':
                raise ValueError("عذراً، الطلب لا يزال قيد الانتظار ولم تتم الموافقة عليه.")

            claim.status = 'DELIVERED'
            if admin_notes:
                claim.admin_notes = admin_notes.strip()
            claim.processed_by = reviewed_by
            claim.save(using=db_name, update_fields=['status', 'admin_notes', 'processed_by', 'updated_at'])

            student = claim.student
            reward = claim.reward

            # إشعار الطالب / ولي الأمر
            try:
                SystemNotification.objects.using(db_name).create(
                    center=student.halaqa.center if (student.halaqa and student.halaqa.center) else None,
                    title="تم تسليم المكافأة بنجاح 🎉",
                    message=f"تهانينا! تم تسليم مكافأة ({reward.name}) للطالب {student.full_name} بنجاح. بارك الله في جهودكم."
                )
            except Exception as notify_err:
                logger.warning(f"Notification error on deliver: {notify_err}")

            return {
                "success": True,
                "claim_id": str(claim.id),
                "status": "DELIVERED",
                "status_display": "تم التسليم"
            }

    @staticmethod
    def redeem_reward(db_name: str, student_id: str, reward_id: str, performed_by: UserProfile, notes: str = ""):
        """
        استبدال فوري ومباشر لمكافأة للطالب (من قبل المعلم أو الأدمن).
        """
        with transaction.atomic(using=db_name):
            try:
                student = Student.objects.using(db_name).select_for_update().select_related('halaqa__center').get(id=student_id)
            except Student.DoesNotExist:
                raise ValueError("الطالب غير موجود")

            try:
                reward = Reward.objects.using(db_name).select_for_update().get(id=reward_id)
            except Reward.DoesNotExist:
                raise ValueError("المكافأة المحددة غير موجودة")

            if not reward.is_active:
                raise ValueError("هذه المكافأة غير مفعلة حالياً")

            if reward.stock_quantity <= 0:
                raise ValueError("نفدت الكمية المتاحة من هذه المكافأة")

            if student.points < reward.points_cost:
                raise ValueError(f"رصيد الطالب غير كافٍ ({student.points} نقطة)، والمطلوب {reward.points_cost} نقطة")

            # خصم النقاط
            balance_before = student.points
            balance_after = balance_before - reward.points_cost
            student.points = balance_after
            student.save(using=db_name, update_fields=['points'])

            # تحديث المخزون
            if reward.stock_quantity > 0:
                reward.stock_quantity -= 1
                reward.save(using=db_name, update_fields=['stock_quantity'])

            # تسجيل الحركة المالية في دفتر النقاط
            tx = PointTransaction.objects.using(db_name).create(
                student=student,
                amount=-reward.points_cost,
                transaction_type='REWARD_REDEMPTION',
                reason=f"استبدال مكافأة مباشر: {reward.name}",
                balance_before=balance_before,
                balance_after=balance_after,
                performed_by=performed_by
            )

            # إنشاء سجل المطالبة / التسليم
            claim = RewardClaim.objects.using(db_name).create(
                student=student,
                reward=reward,
                points_spent=reward.points_cost,
                status='DELIVERED',
                notes=notes,
                processed_by=performed_by
            )

            try:
                from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
                StudentNotificationService.notify_points_redemption(
                    db_name=db_name,
                    student=student,
                    points_spent=reward.points_cost,
                    reward_name=reward.name,
                    balance_after=balance_after,
                    is_approval=True
                )
            except Exception as notify_err:
                logger.warning(f"Notification error on direct redeem: {notify_err}")

            return {
                "success": True,
                "claim_id": str(claim.id),
                "reward_name": reward.name,
                "points_spent": reward.points_cost,
                "balance_after": balance_after,
                "transaction_id": str(tx.id)
            }

    @staticmethod
    def award_competition_reward(db_name: str, participation: CompetitionParticipation, points: int, reason: str = ""):
        """
        منح نقاط جائزة المسابقة عند اجتياز المسابقة بنجاح.
        """
        if points <= 0:
            return None

        with transaction.atomic(using=db_name):
            student = Student.objects.using(db_name).select_for_update().get(id=participation.student_id)
            balance_before = student.points
            balance_after = balance_before + points
            
            student.points = balance_after
            student.save(using=db_name, update_fields=['points'])

            tx = PointTransaction.objects.using(db_name).create(
                student=student,
                amount=points,
                transaction_type='COMPETITION_PRIZE',
                reason=reason or f"جائزة الفوز/الاجتياز في مسابقة: {participation.competition.title}",
                balance_before=balance_before,
                balance_after=balance_after,
                performed_by=participation.reviewed_by
            )

            participation.points_awarded = points
            participation.save(using=db_name, update_fields=['points_awarded'])

            try:
                from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
                StudentNotificationService.notify_points_awarded(
                    db_name=db_name,
                    student=student,
                    amount=points,
                    reason=reason or f"جائزة الفوز/الاجتياز في مسابقة: {participation.competition.title}",
                    balance_after=balance_after
                )
            except Exception as notify_err:
                logger.warning(f"Notification error on comp reward: {notify_err}")

            return tx

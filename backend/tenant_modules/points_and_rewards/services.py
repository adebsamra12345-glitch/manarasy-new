import uuid
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
    def record_transaction(
        db_name: str,
        student_id: str,
        amount: int,
        transaction_type: str,
        reason: str,
        performed_by: UserProfile = None,
        idempotency_key: str = None,
        reference_id: str = None,
        reference_type: str = None,
        metadata: dict = None
    ) -> PointTransaction:
        """
        المحرك المحاسبي الموحد لتسجيل حركات دفتر الأستاذ (Append-Only Ledger Engine):
        1. فحص مفتاح التفرد (Idempotency) لمنع تكرار أي معاملة عند انقطاع الشبكة أو إعادة الإرسال.
        2. معاملة ذرية كاملة transaction.atomic(using=db_name).
        3. قفل متشائم select_for_update() على سجل الطالب لضمان التزامن ومنع Lost Updates.
        4. فحص الرصيد الكافي ومنع الأرصدة السالبة عند الخصم.
        5. تحديث رصيد الطالب الكاش وتوثيق الرصيد قبل وبعد بدقة تامة.
        6. إنشاء قيد الدفتر المحاسبي PointTransaction غير القابل للتعديل.
        """
        if not reason or not reason.strip():
            raise ValueError("يجب تحديد سبب الحركة المالية في دفتر الأستاذ")

        if amount == 0:
            raise ValueError("لا يمكن تسجيل حركة بقيمة صفر نقاط")

        # 1. Idempotency Pre-flight Check (Outside transaction for performance)
        if idempotency_key:
            existing_tx = PointTransaction.objects.using(db_name).filter(
                student_id=student_id,
                idempotency_key=idempotency_key
            ).first()
            if existing_tx:
                logger.info(f"[Idempotency Hit] Returning existing transaction {existing_tx.id} for key {idempotency_key}")
                return existing_tx

        with transaction.atomic(using=db_name):
            # 2. In-Lock Idempotency Check (Guard against concurrent identical requests)
            if idempotency_key:
                existing_tx = PointTransaction.objects.using(db_name).select_for_update().filter(
                    student_id=student_id,
                    idempotency_key=idempotency_key
                ).first()
                if existing_tx:
                    logger.info(f"[In-Lock Idempotency Hit] Returning existing transaction {existing_tx.id} for key {idempotency_key}")
                    return existing_tx

            # 3. Lock Student Row (Enforcing Lock Hierarchy: Student first)
            try:
                student = Student.objects.using(db_name).select_for_update().get(id=student_id)
            except Student.DoesNotExist:
                raise ValueError("الطالب المحدد غير موجود")

            balance_before = student.points
            balance_after = balance_before + amount

            # 4. Strict Non-negative Balance Enforcement
            if balance_after < 0:
                raise ValueError(
                    f"رصيد الطالب الحالي ({balance_before} نقطة) غير كافٍ لإتمام العملية (المطلوب خصم {abs(amount)} نقطة)"
                )

            # 5. Atomic Update of Cached Balance
            student.points = balance_after
            student.save(using=db_name, update_fields=['points'])

            # 6. Append-Only Entry in Ledger
            tx = PointTransaction.objects.using(db_name).create(
                student=student,
                amount=amount,
                transaction_type=transaction_type,
                reason=reason.strip(),
                balance_before=balance_before,
                balance_after=balance_after,
                performed_by=performed_by,
                idempotency_key=idempotency_key,
                reference_id=str(reference_id) if reference_id else None,
                reference_type=reference_type,
                metadata=metadata or {}
            )
            return tx

    @staticmethod
    def grant_behavioral_bonus(db_name: str, student_id: str, performed_by: UserProfile, reason: str, idempotency_key: str = None):
        """
        منح مكافأة سلوكية للطالب بقيمة (+1) نقطة لسلوك ممتاز عبر محرك الدفتر المركزي.
        """
        if not reason or not reason.strip():
            raise ValueError("يجب تحديد سبب المكافأة السلوكية")

        BONUS_AMOUNT = 1

        tx = PointsService.record_transaction(
            db_name=db_name,
            student_id=student_id,
            amount=BONUS_AMOUNT,
            transaction_type='BEHAVIORAL_BONUS',
            reason=reason.strip(),
            performed_by=performed_by,
            idempotency_key=idempotency_key
        )

        try:
            from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
            student = Student.objects.using(db_name).get(id=student_id)
            StudentNotificationService.notify_points_awarded(
                db_name=db_name,
                student=student,
                amount=BONUS_AMOUNT,
                reason=reason.strip(),
                balance_after=tx.balance_after
            )
        except Exception as notify_err:
            logger.warning(f"Failed to notify points award: {notify_err}")

        return {
            "success": True,
            "student_id": str(tx.student_id),
            "student_name": tx.student.full_name,
            "awarded_points": BONUS_AMOUNT,
            "balance_before": tx.balance_before,
            "balance_after": tx.balance_after,
            "transaction_id": str(tx.id),
            "created_at": tx.created_at.isoformat()
        }

    @staticmethod
    def award_recitation_pages_points(db_name: str, student_id: str, performed_by: UserProfile = None, reason: str = "", idempotency_key: str = None):
        """
        منح نقطتين (+2 نقاط) عند تسميع 3 صفحات بتقييم عالي عبر محرك الدفتر المركزي.
        """
        RECITATION_BONUS = 2
        rec_reason = reason or "مكافأة إتقان: تسميع 3 صفحات بتقييم عالي (+2 نقاط)"

        tx = PointsService.record_transaction(
            db_name=db_name,
            student_id=student_id,
            amount=RECITATION_BONUS,
            transaction_type='RECITATION',
            reason=rec_reason,
            performed_by=performed_by,
            idempotency_key=idempotency_key
        )

        try:
            from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
            student = Student.objects.using(db_name).get(id=student_id)
            StudentNotificationService.notify_points_awarded(
                db_name=db_name,
                student=student,
                amount=RECITATION_BONUS,
                reason=rec_reason,
                balance_after=tx.balance_after
            )
        except Exception as notify_err:
            logger.warning(f"Failed to notify recitation points: {notify_err}")

        return {
            "success": True,
            "student_id": str(tx.student_id),
            "student_name": tx.student.full_name,
            "awarded_points": RECITATION_BONUS,
            "balance_before": tx.balance_before,
            "balance_after": tx.balance_after,
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
                claim = RewardClaim.objects.using(db_name).select_for_update().get(id=claim_id)
            except RewardClaim.DoesNotExist:
                raise ValueError("طلب المكافأة غير موجود")

            if claim.status not in ['PENDING']:
                raise ValueError(f"لا يمكن الموافقة على طلب بحالته الحالية ({claim.get_status_display()})")

            reward = Reward.objects.using(db_name).select_for_update().get(id=claim.reward_id)

            if reward.stock_quantity <= 0:
                raise ValueError("المخزون المتاح من هذه المكافأة قد نفد")

            claim_idemp_key = f"claim_approval_{claim.id}"
            tx = PointsService.record_transaction(
                db_name=db_name,
                student_id=str(claim.student_id),
                amount=-claim.points_spent,
                transaction_type='REWARD_REDEMPTION',
                reason=f"موافقة على طلب مكافأة: {reward.name}",
                performed_by=reviewed_by,
                idempotency_key=claim_idemp_key,
                reference_id=str(claim.id),
                reference_type='REWARD_CLAIM'
            )

            # خصم المخزون إن كان محدداً
            if reward.stock_quantity > 0:
                reward.stock_quantity -= 1
                reward.save(using=db_name, update_fields=['stock_quantity'])

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
                    student=tx.student,
                    points_spent=claim.points_spent,
                    reward_name=reward.name,
                    balance_after=tx.balance_after,
                    is_approval=True
                )
            except Exception as notify_err:
                logger.warning(f"Notification error on approve: {notify_err}")

            return {
                "success": True,
                "claim_id": str(claim.id),
                "status": "APPROVED",
                "status_display": "تمت الموافقة",
                "balance_after": tx.balance_after,
                "transaction_id": str(tx.id)
            }

    @staticmethod
    def reject_reward_claim(db_name: str, claim_id: str, reviewed_by: UserProfile, rejection_reason: str = "", admin_notes: str = ""):
        """
        رفض طلب المكافأة دون خصم أي نقاط، مع تسجيل السبب وإشعار الطالب / ولي الأمر.
        """
        with transaction.atomic(using=db_name):
            try:
                claim = RewardClaim.objects.using(db_name).select_for_update().get(id=claim_id)
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
                claim = RewardClaim.objects.using(db_name).select_for_update().get(id=claim_id)
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
    def redeem_reward(db_name: str, student_id: str, reward_id: str, performed_by: UserProfile, notes: str = "", idempotency_key: str = None):
        """
        استبدال فوري ومباشر لمكافأة للطالب عبر محرك الدفتر المركزي.
        """
        key = idempotency_key or f"direct_redeem_{student_id}_{reward_id}_{uuid.uuid4().hex[:8]}"

        with transaction.atomic(using=db_name):
            try:
                reward = Reward.objects.using(db_name).select_for_update().get(id=reward_id)
            except Reward.DoesNotExist:
                raise ValueError("المكافأة المحددة غير موجودة")

            if not reward.is_active:
                raise ValueError("هذه المكافأة غير مفعلة حالياً")

            if reward.stock_quantity <= 0:
                raise ValueError("نفدت الكمية المتاحة من هذه المكافأة")

            # خصم النقاط عبر الدفتر المركزي مع قفل الطالب وفحص الرصيد
            tx = PointsService.record_transaction(
                db_name=db_name,
                student_id=student_id,
                amount=-reward.points_cost,
                transaction_type='REWARD_REDEMPTION',
                reason=f"استبدال مكافأة مباشر: {reward.name}",
                performed_by=performed_by,
                idempotency_key=key,
                reference_id=str(reward.id),
                reference_type='REWARD'
            )

            # تحديث المخزون
            if reward.stock_quantity > 0:
                reward.stock_quantity -= 1
                reward.save(using=db_name, update_fields=['stock_quantity'])

            # إنشاء سجل المطالبة / التسليم
            claim = RewardClaim.objects.using(db_name).create(
                student_id=student_id,
                reward=reward,
                points_spent=reward.points_cost,
                status='DELIVERED',
                notes=notes,
                processed_by=performed_by
            )

            try:
                from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
                student = Student.objects.using(db_name).get(id=student_id)
                StudentNotificationService.notify_points_redemption(
                    db_name=db_name,
                    student=student,
                    points_spent=reward.points_cost,
                    reward_name=reward.name,
                    balance_after=tx.balance_after,
                    is_approval=True
                )
            except Exception as notify_err:
                logger.warning(f"Notification error on direct redeem: {notify_err}")

            return {
                "success": True,
                "claim_id": str(claim.id),
                "reward_name": reward.name,
                "points_spent": reward.points_cost,
                "balance_after": tx.balance_after,
                "transaction_id": str(tx.id)
            }

    @staticmethod
    def award_competition_reward(db_name: str, participation: CompetitionParticipation, points: int, reason: str = "", idempotency_key: str = None):
        """
        منح نقاط جائزة المسابقة عند اجتياز المسابقة بنجاح عبر محرك الدفتر المركزي.
        """
        if points <= 0:
            return None

        key = idempotency_key or f"comp_prize_{participation.id}"

        with transaction.atomic(using=db_name):
            # 1. Lock participation to prevent concurrent prize award calls (Idempotency)
            part = CompetitionParticipation.objects.using(db_name).select_for_update().get(id=participation.id)
            if part.points_awarded > 0:
                logger.warning(f"Points already awarded ({part.points_awarded}) for participation {part.id}")
                return None

            # 2. Record Transaction via Central Ledger Engine
            tx = PointsService.record_transaction(
                db_name=db_name,
                student_id=str(part.student_id),
                amount=points,
                transaction_type='COMPETITION_PRIZE',
                reason=reason or f"جائزة الفوز/الاجتياز في مسابقة: {part.competition.title} [ref:{part.id}]",
                performed_by=part.reviewed_by,
                idempotency_key=key,
                reference_id=str(part.id),
                reference_type='COMPETITION_PARTICIPATION'
            )

            part.points_awarded = points
            part.save(using=db_name, update_fields=['points_awarded'])

            try:
                from tenant_modules.centers_and_projects.student_notifications import StudentNotificationService
                student = Student.objects.using(db_name).get(id=part.student_id)
                StudentNotificationService.notify_points_awarded(
                    db_name=db_name,
                    student=student,
                    amount=points,
                    reason=reason or f"جائزة الفوز/الاجتياز في مسابقة: {part.competition.title}",
                    balance_after=tx.balance_after
                )
            except Exception as notify_err:
                logger.warning(f"Notification error on comp reward: {notify_err}")

            return tx

    @staticmethod
    def refund_points(db_name: str, original_transaction_id: str, performed_by: UserProfile, reason: str = ""):
        """
        استرجاع نقاط لحركة سابقة (Compensating Transaction) دون تعديل أو حذف الحركة الأصلية في الدفتر.
        """
        try:
            orig_tx = PointTransaction.objects.using(db_name).get(id=original_transaction_id)
        except PointTransaction.DoesNotExist:
            raise ValueError("الحركة الأصلية غير موجودة")

        if orig_tx.amount >= 0:
            raise ValueError("لا يمكن استرجاع حركة موجبة (إيداع)، الاسترجاع يخص حركات الخصم فقط")

        refund_amount = abs(orig_tx.amount)
        refund_key = f"refund_{orig_tx.id}"

        tx = PointsService.record_transaction(
            db_name=db_name,
            student_id=str(orig_tx.student_id),
            amount=refund_amount,
            transaction_type='REFUND',
            reason=reason or f"استرجاع نقاط للحركة: {orig_tx.reason} [ref:{orig_tx.id}]",
            performed_by=performed_by,
            idempotency_key=refund_key,
            reference_id=str(orig_tx.id),
            reference_type='POINT_TRANSACTION'
        )

        return {
            "success": True,
            "refund_transaction_id": str(tx.id),
            "original_transaction_id": str(orig_tx.id),
            "refunded_points": refund_amount,
            "balance_after": tx.balance_after
        }

import logging
from datetime import timedelta
from django.utils import timezone
from .models import SystemNotification, Center
from tenant_modules.students_and_parents.models import Student

logger = logging.getLogger(__name__)

class StudentNotificationService:
    """
    خدمة الإشعارات المركزية للطالب وولي الأمر.
    تضمن:
    - توحيد إنشاء الإشعارات عبر المنصة
    - منع ازدواجية وتكرار الإشعارات (Idempotency Protection)
    - ربط الإشعار بالمستخدم المناسب (الطالب أو ولي الأمر)
    - أداء عالٍ وآمن
    """

    @staticmethod
    def resolve_student_recipient_user(db_name: str, student: Student):
        """
        استخراج حساب المستخدم (auth_user) المرتبط بالطالب
        سواء من علاقة user المباشرة أو عبر enrollments/parent
        """
        if not student:
            return None

        # 1. فحص المستخدم المباشر
        if getattr(student, 'user', None):
            return student.user

        # 2. فحص المستخدم عبر التسجيل (Enrollment)
        try:
            enrollment = student.enrollments.using(db_name).filter(
                user_profile__user__isnull=False
            ).select_related('user_profile__user').first()
            if enrollment and enrollment.user_profile and enrollment.user_profile.user:
                return enrollment.user_profile.user
        except Exception:
            pass

        return None

    @classmethod
    def send_notification(
        cls,
        db_name: str,
        student: Student,
        title: str,
        message: str,
        center=None,
        dedup_window_minutes: int = 60
    ):
        """
        إنشاء إشعار للطالب مع منع التكرار خلال نافذة زمنية محددة
        """
        if not student:
            return None

        recipient_user = cls.resolve_student_recipient_user(db_name, student)
        center_obj = center or (student.halaqa.center if (student.halaqa and student.halaqa.center) else None)

        # منع تكرار نفس الإشعار خلال dedup_window_minutes
        if dedup_window_minutes > 0:
            since = timezone.now() - timedelta(minutes=dedup_window_minutes)
            filter_kwargs = {
                'title': title,
                'message': message,
                'created_at__gte': since
            }
            if recipient_user:
                filter_kwargs['recipient'] = recipient_user
            elif center_obj:
                filter_kwargs['center'] = center_obj

            exists = SystemNotification.objects.using(db_name).filter(**filter_kwargs).exists()
            if exists:
                logger.info(f"Duplicate notification suppressed for student {student.id}: {title}")
                return None

        try:
            notification = SystemNotification.objects.using(db_name).create(
                recipient=recipient_user,
                center=center_obj,
                title=title,
                message=message,
                is_read=False
            )
            return notification
        except Exception as e:
            logger.error(f"Failed to create notification for student {student.id}: {e}")
            return None

    # =========================================================
    # 1. إشعار الغياب (Absence Notification)
    # =========================================================
    @classmethod
    def notify_absence(cls, db_name: str, attendance_log):
        """
        عند تسجيل غياب الطالب بدون عذر أو بعذر
        """
        if not attendance_log:
            return None

        try:
            student = Student.objects.using(db_name).select_related('halaqa').get(id=attendance_log.student_id)
        except Student.DoesNotExist:
            return None

        halaqa_name = student.halaqa.name if student.halaqa else "الحلقة القرآنية"
        date_str = str(attendance_log.session_date)
        status_label = attendance_log.get_status_display() if hasattr(attendance_log, 'get_status_display') else attendance_log.status

        title = "إشعار غياب عن الجلسة"
        message = f"تم تسجيل غيابك ({status_label}) في حلقة ({halaqa_name}) بتاريخ {date_str}. نرجو الحرص على الحضور واستدراك ما فاتك."

        return cls.send_notification(
            db_name=db_name,
            student=student,
            title=title,
            message=message,
            dedup_window_minutes=720 # 12 ساعة لمنع تكرار إشعار نفس اليوم
        )

    # =========================================================
    # 2. إشعار التقييم اليومي (Daily Evaluation Notification)
    # =========================================================
    @classmethod
    def notify_daily_evaluation(
        cls,
        db_name: str,
        student: Student,
        memorization_grade: str = "",
        behavior_grade: str = "",
        notes: str = "",
        page_number=None,
        recitation_type: str = "حفظ جديد"
    ):
        """
        عند إضافة تقييم يومي جديد (تسميع أو سلوك)
        """
        if not student:
            return None

        title = "تم إضافة تقييمك اليومي 📖"

        lines = ["تم تسجيل تقييمك اليوم:"]
        if memorization_grade:
            page_text = f" (صفحة {page_number})" if page_number else ""
            lines.append(f"• الحفظ والمراجعة: {memorization_grade}{page_text} [{recitation_type}]")
        if behavior_grade:
            lines.append(f"• السلوك والانضباط: {behavior_grade}")
        if notes and notes.strip():
            lines.append(f"• ملاحظات المعلم: {notes.strip()}")

        message = "\n".join(lines)

        return cls.send_notification(
            db_name=db_name,
            student=student,
            title=title,
            message=message,
            dedup_window_minutes=15 # منع تكرار نفس التقييم خلال 15 دقيقة
        )

    # =========================================================
    # 3. إشعار منح النقاط أو المكافآت (Points Award Notification)
    # =========================================================
    @classmethod
    def notify_points_awarded(
        cls,
        db_name: str,
        student: Student,
        amount: int,
        reason: str = "",
        balance_after: int = 0
    ):
        """
        عند منح الطالب نقاطاً من الإدارة أو المعلم أو النظام
        """
        if not student or amount <= 0:
            return None

        title = "مكافأة نقاط جديدة 🎉"
        reason_text = f" ({reason})" if reason else ""
        message = f"تمت إضافة {amount} نقطة إلى حسابك{reason_text}. رصيدك المتاح الحالي: {balance_after} نقطة."

        return cls.send_notification(
            db_name=db_name,
            student=student,
            title=title,
            message=message,
            dedup_window_minutes=5
        )

    # =========================================================
    # 4. إشعارات المسابقات (Competition Participation & Results)
    # =========================================================
    @classmethod
    def notify_competition_registered(cls, db_name: str, participation):
        """
        عند تسجيل الطالب وبدء مشاركته في مسابقة
        """
        if not participation:
            return None

        student = participation.student
        comp = participation.competition

        title = "تأكيد المشاركة في المسابقة 🎯"
        message = f"تم تسجيل مشاركتك بنجاح في مسابقة ({comp.title}). لديك {comp.duration_minutes} دقيقة للإجابة. نتمنى لك التوفيق!"

        return cls.send_notification(
            db_name=db_name,
            student=student,
            title=title,
            message=message,
            dedup_window_minutes=60
        )

    @classmethod
    def notify_competition_result(
        cls,
        db_name: str,
        participation,
        points_awarded: int = 0,
        rank_text: str = None
    ):
        """
        عند صدور نتيجة المسابقة
        """
        if not participation:
            return None

        student = participation.student
        comp = participation.competition

        title = "نتيجة المسابقة القرآنية 🏆"
        rank_part = f" بالمركز ({rank_text})" if rank_text else ""
        points_part = f" وحصلت على +{points_awarded} نقطة مكافأة!" if points_awarded > 0 else ""
        
        score_val = float(participation.score)
        total_val = float(participation.total_possible_score)
        
        message = f"مبروك! تم اعتماد نتيجتك في مسابقة ({comp.title}){rank_part} بدرجة {score_val}/{total_val}.{points_part}"

        return cls.send_notification(
            db_name=db_name,
            student=student,
            title=title,
            message=message,
            dedup_window_minutes=120
        )

    # =========================================================
    # 5. إشعار استبدال النقاط (Points Redemption Notification)
    # =========================================================
    @classmethod
    def notify_points_redemption(
        cls,
        db_name: str,
        student: Student,
        points_spent: int,
        reward_name: str,
        balance_after: int,
        is_approval: bool = False
    ):
        """
        عند استبدال النقاط بمكافأة أو اعتماد طلب المكافأة
        """
        if not student:
            return None

        if is_approval:
            title = "تمت الموافقة على طلب المكافأة 🎁"
            message = f"تم استبدال {points_spent} نقطة بمكافأة ({reward_name})، ورصيدك الحالي المتبقي: {balance_after} نقطة. تهانينا لك!"
        else:
            title = "تم تقديم طلب استبدال النقاط 🛍️"
            message = f"تم تقديم طلب استبدال {points_spent} نقطة بمكافأة ({reward_name}). رصيدك الحالي: {balance_after} نقطة وهو بانتظار تسليم الإدارة."

        return cls.send_notification(
            db_name=db_name,
            student=student,
            title=title,
            message=message,
            dedup_window_minutes=10
        )

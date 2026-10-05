from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils import timezone


class PlatformAdminManager(BaseUserManager):
    use_in_migrations = False

    def create_user(self, email, password, full_name=''):
        if not email:
            raise ValueError('البريد الإلكتروني مطلوب')
        if not password:
            raise ValueError('كلمة المرور مطلوبة')
        admin = self.model(email=self.normalize_email(email).lower(), full_name=full_name)
        admin.set_password(password)
        admin.save(using=self._db)
        return admin


class PlatformAdmin(AbstractBaseUser):
    """
    أدمن المنصة ككل (Platform Super Admin).

    - يعيش في القاعدة المركزية (default) فقط، ولا علاقة له بمستخدمي المساجد (users.User في قواعد المساجد).
    - ليس هو AUTH_USER_MODEL عمداً، حتى لا يختلط بمسار تسجيل دخول المساجد.
    - توكناته JWT بمفتاح/audience مختلفين (انظر authentication.py).
    """
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True, default='')
    is_active = models.BooleanField(default=True)

    # حماية من التخمين: قفل مؤقت بعد عدة محاولات فاشلة
    failed_login_count = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    # زيادة هذا الرقم تُبطل كل التوكنات الصادرة سابقاً (تسجيل خروج من كل الأجهزة / تغيير كلمة المرور)
    token_version = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    objects = PlatformAdminManager()

    class Meta:
        db_table = 'platform_admins'

    def __str__(self):
        return self.email

    @property
    def is_locked(self):
        return bool(self.locked_until and self.locked_until > timezone.now())

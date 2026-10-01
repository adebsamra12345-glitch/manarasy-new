import uuid
from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from tenant_modules.centers_and_projects.models import Center

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        db_table = 'auth_user'

ROLE_CHOICES = [
    ('TENANT_ADMIN', 'Tenant Admin'),
    ('CENTER_MANAGER', 'Center Manager'),
    ('TEACHER', 'Teacher'),
    ('STUDENT', 'Student'),
    ('PARENT', 'Parent'),
]

class UserProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='STUDENT')
    center = models.ForeignKey(Center, on_delete=models.SET_NULL, null=True, blank=True, related_name='user_profiles')
    father_name = models.CharField(max_length=150, null=True, blank=True)
    mother_name = models.CharField(max_length=150, null=True, blank=True)
    mother_last_name = models.CharField(max_length=150, null=True, blank=True)
    GUARDIAN_CHOICES = [
        ('FATHER', 'الأب'),
        ('MOTHER', 'الأم'),
    ]
    guardian_type = models.CharField(max_length=10, choices=GUARDIAN_CHOICES, default='FATHER', null=True, blank=True)
    phone = models.CharField(max_length=30, null=True, blank=True)
    father_phone = models.CharField(max_length=30, null=True, blank=True)
    mother_phone = models.CharField(max_length=30, null=True, blank=True)
    health_status = models.TextField(null=True, blank=True)
    monthly_income = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    ORPHAN_CHOICES = [
        ('m', 'يتيم الأم'),
        ('f', 'يتيم الأب'),
        ('t', 'يتيم الاثنين'),
    ]
    orphan_status = models.CharField(max_length=5, choices=ORPHAN_CHOICES, null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    reached_page = models.IntegerField(default=1, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    parent_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='children_users')

    class Meta:
        db_table = 'user_profiles'

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class AccountRequest(models.Model):
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='submitted_account_requests')
    center = models.ForeignKey(Center, on_delete=models.SET_NULL, null=True, blank=True, related_name='account_requests')
    action_type = models.CharField(max_length=20, choices=ACTION_CHOICES)
    target_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='targeted_account_requests')
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_account_requests')
    rejection_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'account_requests'

    def __str__(self):
        return f"Request {self.action_type} by {self.requested_by.username} ({self.status})"

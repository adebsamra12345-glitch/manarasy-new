# core_system/tenants/models.py
import uuid
from django.db import models

class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    subdomain = models.CharField(max_length=63, unique=True)
    custom_domain = models.CharField(max_length=255, unique=True, null=True, blank=True)
    
    # بيانات الاتصال بقاعدة بيانات المسجد
    db_name = models.CharField(max_length=63, unique=True)
    db_host = models.CharField(max_length=255, default='localhost')
    db_port = models.IntegerField(default=5432)
    db_user = models.CharField(max_length=63)
    db_password_hash = models.TextField()
    
    # كلمة مرور مدير المسجد الافتراضي (manager)
    admin_password_hash = models.CharField(max_length=255, default='')

    is_active = models.BooleanField(default=True)
    contact_phone = models.CharField(max_length=20)
    contact_email = models.EmailField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tenants'
        indexes = [models.Index(fields=['subdomain'])]
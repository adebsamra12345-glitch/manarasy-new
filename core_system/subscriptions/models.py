import uuid
from django.db import models
from core_system.tenants.models import Tenant

class Plan(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True) # M_BASIC_30, M_AI_50, etc.
    billing_cycle = models.CharField(max_length=20, choices=[('MONTHLY', 'Monthly'), ('ANNUAL', 'Annual')])
    price_usd = models.DecimalField(max_digits=10, decimal_places=2)
    has_ai_features = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    class Meta:
        db_table = 'plans'

class Subscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=[('ACTIVE', 'Active'), ('PENDING', 'Pending')])
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    auto_renew = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'subscriptions'
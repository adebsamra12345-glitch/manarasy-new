import uuid
from django.db import models
from core_system.subscriptions.models import Subscription

class PaymentTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='USD')
    payment_method = models.CharField(max_length=50, default='SHAM_CASH')
    transaction_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    status = models.CharField(max_length=20, choices=[
        ('SUCCESS', 'Success'), ('PENDING', 'Pending'), ('FAILED', 'Failed')
    ], default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'payments'
        

import uuid
from django.db import models
from core_system.tenants.models import Tenant

class BackupLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='backups')
    file_url = models.TextField()
    size_bytes = models.BigIntegerField(default=0)
    status = models.CharField(max_length=20, choices=[
        ('COMPLETED', 'Completed'), ('IN_PROGRESS', 'In Progress'), ('FAILED', 'Failed')
    ], default='COMPLETED')
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'backup_logs'

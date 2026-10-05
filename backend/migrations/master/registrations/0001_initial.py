import core_system.registrations.models
import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('platform_auth', '0001_initial'),
        ('subscriptions', '0001_initial'),
        ('tenants', '0003_tenant_logo'),
    ]

    operations = [
        migrations.CreateModel(
            name='RegistrationRequest',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('source', models.CharField(choices=[('SELF_SERVICE', 'تسجيل ذاتي'), ('ADMIN_CREATED', 'أضافه أدمن المنصة')], default='SELF_SERVICE', max_length=20)),
                ('status', models.CharField(choices=[('PENDING_PAYMENT', 'بانتظار إيصال الدفع'), ('PENDING_APPROVAL', 'بانتظار موافقة الأدمن'), ('PROVISIONING', 'جارٍ تجهيز قاعدة البيانات'), ('APPROVED', 'مقبول'), ('REJECTED', 'مرفوض'), ('PROVISIONING_FAILED', 'فشل التجهيز')], db_index=True, default='PENDING_PAYMENT', max_length=20)),
                ('mosque_name', models.CharField(max_length=150)),
                ('subdomain', models.CharField(max_length=63)),
                ('contact_phone', models.CharField(max_length=20)),
                ('contact_email', models.EmailField(blank=True, default='', max_length=100)),
                ('center_latitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('center_longitude', models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True)),
                ('admin_username', models.CharField(default='manager', max_length=150)),
                ('admin_first_name', models.CharField(blank=True, default='', max_length=150)),
                ('admin_password_hash', models.CharField(blank=True, default='', max_length=255)),
                ('amount_usd', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('upload_token_hash', models.CharField(blank=True, default='', max_length=64)),
                ('rejection_reason', models.TextField(blank=True, default='')),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('provisioning_error', models.TextField(blank=True, default='')),
                ('provisioning_attempts', models.PositiveSmallIntegerField(default=0)),
                ('provisioning_started_at', models.DateTimeField(blank=True, null=True)),
                ('submitted_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('plan', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='registration_requests', to='subscriptions.plan')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_registrations', to='platform_auth.platformadmin')),
                ('tenant', models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='registration_request', to='tenants.tenant')),
            ],
            options={
                'db_table': 'registration_requests',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='RegistrationEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('actor_label', models.CharField(default='applicant', max_length=150)),
                ('action', models.CharField(max_length=40)),
                ('detail', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='platform_auth.platformadmin')),
                ('request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='registrations.registrationrequest')),
            ],
            options={
                'db_table': 'registration_events',
                'ordering': ['created_at'],
            },
        ),
        migrations.CreateModel(
            name='PaymentReceipt',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('file', models.FileField(max_length=255, storage=core_system.registrations.models.receipt_storage, upload_to=core_system.registrations.models.receipt_upload_to)),
                ('original_name', models.CharField(max_length=120)),
                ('content_type', models.CharField(max_length=50)),
                ('size', models.PositiveIntegerField()),
                ('sha256', models.CharField(db_index=True, max_length=64)),
                ('reference_number', models.CharField(blank=True, default='', max_length=60)),
                ('uploaded_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='receipts', to='registrations.registrationrequest')),
            ],
            options={
                'db_table': 'registration_receipts',
                'ordering': ['uploaded_at'],
            },
        ),
        migrations.AddIndex(
            model_name='registrationrequest',
            index=models.Index(fields=['status', '-created_at'], name='regreq_status_created_idx'),
        ),
        migrations.AddConstraint(
            model_name='registrationrequest',
            constraint=models.UniqueConstraint(condition=models.Q(('status', 'REJECTED'), _negated=True), fields=('subdomain',), name='uniq_open_registration_subdomain'),
        ),
    ]

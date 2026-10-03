from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0002_tenant_is_rewards_store_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenant',
            name='logo',
            field=models.FileField(blank=True, null=True, upload_to='tenant_logos/'),
        ),
    ]

# Generated manually for tenant_template students_and_parents migration
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
        ('students_and_parents', '0008_add_student_deletion_request'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentregistrationrequest',
            name='rejection_reason',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='studentregistrationrequest',
            name='reviewed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reviewed_registration_requests',
                to='users.userprofile'
            ),
        ),
    ]

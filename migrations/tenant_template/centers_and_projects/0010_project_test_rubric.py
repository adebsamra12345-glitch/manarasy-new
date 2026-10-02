import django.db.models.deletion
import uuid
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('centers_and_projects', '0009_mosqueweeklyschedule'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='TestRubric',
                    fields=[
                        ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                        ('title', models.CharField(max_length=150)),
                        ('description', models.TextField(blank=True, null=True)),
                        ('is_active', models.BooleanField(default=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                    ],
                    options={
                        'db_table': 'test_rubrics',
                    },
                ),
                migrations.CreateModel(
                    name='RubricErrorType',
                    fields=[
                        ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                        ('name', models.CharField(max_length=150)),
                        ('value', models.DecimalField(decimal_places=2, default=1.0, max_digits=5)),
                        ('max_count', models.IntegerField(default=3)),
                        ('notes', models.TextField(blank=True, null=True)),
                        ('order', models.IntegerField(default=1)),
                        ('rubric', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='error_types', to='centers_and_projects.testrubric')),
                    ],
                    options={
                        'db_table': 'rubric_error_types',
                        'ordering': ['order', 'id'],
                    },
                ),
            ],
            database_operations=[]
        ),
        migrations.AddField(
            model_name='project',
            name='test_rubric',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='projects',
                to='centers_and_projects.testrubric'
            ),
        ),
    ]

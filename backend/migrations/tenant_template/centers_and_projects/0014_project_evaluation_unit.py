from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('centers_and_projects', '0013_project_recitation_direction'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='evaluation_unit',
            field=models.CharField(
                choices=[('PAGES', 'صفحات'), ('LESSONS', 'دروس مخصصة'), ('TOPICS', 'محاور مخصصة')],
                default='PAGES',
                max_length=20
            ),
        ),
        migrations.AlterField(
            model_name='stagepart',
            name='part_type',
            field=models.CharField(
                choices=[('DEFAULT_QURAN', 'جزء قرآني افتراضي'), ('CUSTOM', 'جزء مخصص'), ('LESSON', 'درس مخصص'), ('TOPIC', 'محور مخصص')],
                default='DEFAULT_QURAN',
                max_length=20
            ),
        ),
    ]

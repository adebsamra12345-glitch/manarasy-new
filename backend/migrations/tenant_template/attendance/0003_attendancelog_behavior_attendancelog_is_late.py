from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0002_halaqasession_alter_attendancelog_unique_together_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendancelog',
            name='is_late',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='attendancelog',
            name='behavior',
            field=models.CharField(
                blank=True,
                choices=[
                    ('EXCELLENT', 'ممتاز'),
                    ('VERY_GOOD', 'جيد جداً'),
                    ('GOOD', 'جيد'),
                    ('ACCEPTABLE', 'مقبول'),
                    ('WEAK', 'ضعيف'),
                    ('LEFT_WITHOUT_EXCUSE', 'مغادرة الحلقة دون عذر')
                ],
                default='EXCELLENT',
                max_length=50,
                null=True
            ),
        ),
        migrations.AlterField(
            model_name='attendancelog',
            name='status',
            field=models.CharField(
                choices=[
                    ('PRESENT', 'حاضر'),
                    ('ABSENT', 'غائب بدون عذر'),
                    ('EXCUSED', 'غائب بعذر'),
                    ('LATE', 'متأخر')
                ],
                default='PRESENT',
                max_length=20
            ),
        ),
    ]

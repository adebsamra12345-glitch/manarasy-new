import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from django.db import transaction
from core_system.tenants.models import Tenant
from tenant_modules.attendance.models import HalaqaSession, AttendanceLog
from tenant_modules.recitation_and_sabr.models import RecitationLog
from collections import defaultdict

def clean_duplicates_for_tenant(tenant):
    db_name = tenant.db_name
    cfg = settings.DATABASES['default'].copy()
    cfg.update({
        'NAME': tenant.db_name,
        'USER': tenant.db_user or settings.DATABASES['default'].get('USER'),
        'PASSWORD': tenant.db_password_hash or settings.DATABASES['default'].get('PASSWORD'),
        'HOST': tenant.db_host or 'localhost',
        'PORT': tenant.db_port or 5432
    })
    settings.DATABASES[db_name] = cfg

    try:
        sessions = list(HalaqaSession.objects.using(db_name).all().order_by('start_time'))
    except Exception as e:
        print(f"Skipping tenant {tenant.subdomain}: table does not exist or error ({e})")
        return

    grouped = defaultdict(list)
    for s in sessions:
        grouped[(str(s.halaqa_id), str(s.session_date))].append(s)

    duplicate_groups = {k: v for k, v in grouped.items() if len(v) > 1}
    print(f"Tenant {tenant.subdomain}: Found {len(duplicate_groups)} duplicate (halaqa, date) groups.")

    if not duplicate_groups:
        return

    deleted_sessions_count = 0
    with transaction.atomic(using=db_name):
        for (halaqa_id, session_date), session_list in duplicate_groups.items():
            def score_session(sess):
                att_logs = list(sess.attendance_logs.using(db_name).all())
                rec_count = sum(l.recitations.using(db_name).count() for l in att_logs)
                return (rec_count, len(att_logs), sess.start_time)

            sorted_sessions = sorted(session_list, key=score_session, reverse=True)
            keeper = sorted_sessions[0]
            duplicates_to_remove = sorted_sessions[1:]

            keeper_student_ids = set(
                str(att.student_id) for att in keeper.attendance_logs.using(db_name).all()
            )

            for dup in duplicates_to_remove:
                for att in dup.attendance_logs.using(db_name).all():
                    if str(att.student_id) not in keeper_student_ids:
                        att.session = keeper
                        att.save(using=db_name)
                        keeper_student_ids.add(str(att.student_id))
                    else:
                        existing_att = keeper.attendance_logs.using(db_name).filter(student_id=att.student_id).first()
                        if existing_att:
                            for rec in att.recitations.using(db_name).all():
                                if not existing_att.recitations.using(db_name).filter(page_number=rec.page_number).exists():
                                    rec.attendance = existing_att
                                    rec.save(using=db_name)
                        att.delete(using=db_name)

                dup.delete(using=db_name)
                deleted_sessions_count += 1

    print(f"Tenant {tenant.subdomain}: Successfully cleaned up {deleted_sessions_count} duplicate sessions.")

if __name__ == '__main__':
    for t in Tenant.objects.all():
        clean_duplicates_for_tenant(t)

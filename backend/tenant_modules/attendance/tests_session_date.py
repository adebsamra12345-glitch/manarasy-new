import os
import sys
import django
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from django.conf import settings
from core_system.tenants.models import Tenant
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.attendance.models import HalaqaSession, AttendanceLog, SessionAuditLog
from tenant_modules.attendance.views import (
    session_start_view,
    session_list_view,
    session_detail_view,
    available_dates_view
)
import json

def run_tests():
    tenant = Tenant.objects.get(subdomain='alnasseer')
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

    halaqa = Halaqa.objects.using(db_name).first()
    assert halaqa is not None, "A halaqa is required for testing"

    factory = RequestFactory()

    print(f"Testing on Halaqa: {halaqa.name} ({halaqa.id})")

    # 1. Clean test dates (e.g., 2026-09-10 and 2026-09-11)
    d1 = datetime.date(2026, 9, 10)
    d2 = datetime.date(2026, 9, 11)
    HalaqaSession.objects.using(db_name).filter(halaqa_id=halaqa.id, session_date__in=[d1, d2]).delete()

    # 2. Test create first session on 2026-09-10
    req1 = factory.post('/api/attendance/sessions/start/', data=json.dumps({
        'halaqa_id': str(halaqa.id),
        'session_date': d1.isoformat()
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp1 = session_start_view(req1)
    assert resp1.status_code == 201, f"Expected 201, got {resp1.status_code}: {resp1.content}"
    data1 = json.loads(resp1.content.decode('utf-8'))
    session_id1 = data1['data']['session_id']
    print(f"[PASS] Test 1: Successfully created session on {d1} (id: {session_id1})")

    # 3. Test duplicate create on same date 2026-11-10 -> should fail with 409
    req2 = factory.post('/api/attendance/sessions/start/', data=json.dumps({
        'halaqa_id': str(halaqa.id),
        'session_date': d1.isoformat()
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp2 = session_start_view(req2)
    assert resp2.status_code == 409, f"Expected 409, got {resp2.status_code}: {resp2.content}"
    data2 = json.loads(resp2.content.decode('utf-8'))
    assert data2.get('error_code') == 'SESSION_DATE_CONFLICT'
    print(f"[PASS] Test 2: Rejected duplicate session on {d1} with 409 SESSION_DATE_CONFLICT")

    # 4. Test available-dates endpoint for month 2026-09
    req3 = factory.get(f'/api/attendance/sessions/available-dates/?halaqa_id={halaqa.id}&month=2026-09', HTTP_TENANT_ID=str(tenant.id))
    resp3 = available_dates_view(req3)
    assert resp3.status_code == 200
    data3 = json.loads(resp3.content.decode('utf-8'))['data']
    assert d1.isoformat() in data3['booked_dates']
    assert any(x['date'] == d2.isoformat() for x in data3['available_dates'])
    print(f"[PASS] Test 3: available_dates_view accurately reports {d1} as booked and {d2} as available")

    # 5. Create another session on d2
    req4 = factory.post('/api/attendance/sessions/', data=json.dumps({
        'halaqa_id': str(halaqa.id),
        'session_date': d2.isoformat(),
        'start_time': '16:00',
        'end_time': '18:00'
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp4 = session_list_view(req4)
    assert resp4.status_code == 201
    session_id2 = json.loads(resp4.content.decode('utf-8'))['data']['id']
    print(f"[PASS] Test 4: Created second session on {d2} (id: {session_id2})")

    # 6. Test updating session_id2 to date d1 (should conflict and fail with 409)
    req5 = factory.put(f'/api/attendance/sessions/{session_id2}/', data=json.dumps({
        'session_date': d1.isoformat()
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp5 = session_detail_view(req5, pk=session_id2)
    assert resp5.status_code == 409, f"Expected 409, got {resp5.status_code}"
    data5 = json.loads(resp5.content.decode('utf-8'))
    assert data5.get('error_code') == 'SESSION_DATE_CONFLICT'
    print(f"[PASS] Test 5: Prevented updating session 2 to already occupied date {d1}")

    # 7. Test updating session_id2 without changing date (should succeed)
    req6 = factory.put(f'/api/attendance/sessions/{session_id2}/', data=json.dumps({
        'session_date': d2.isoformat(),
        'notes': 'ملاحظات محدثة'
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp6 = session_detail_view(req6, pk=session_id2)
    assert resp6.status_code == 200
    print(f"[PASS] Test 6: Updating session without changing date succeeds without conflict")

    # 8. Test moving session_id2 to empty date d3 (2026-09-12) -> should succeed and log audit
    d3 = datetime.date(2026, 9, 12)
    HalaqaSession.objects.using(db_name).filter(halaqa_id=halaqa.id, session_date=d3).delete()

    req7 = factory.put(f'/api/attendance/sessions/{session_id2}/', data=json.dumps({
        'session_date': d3.isoformat(),
        'modified_by_id': str(halaqa.id),
        'modified_by_name': 'أحمد المدرس'
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp7 = session_detail_view(req7, pk=session_id2)
    assert resp7.status_code == 200

    # Verify audit log
    audit = SessionAuditLog.objects.using(db_name).filter(session_id=session_id2).first()
    assert audit is not None, "Audit log must be created!"
    assert audit.previous_date == d2
    assert audit.new_date == d3
    assert audit.changed_by_name == 'أحمد المدرس'
    print(f"[PASS] Test 7: Updating session date moved to {d3} and logged in SessionAuditLog: prev={audit.previous_date}, new={audit.new_date}")

    # Cleanup test sessions
    HalaqaSession.objects.using(db_name).filter(halaqa_id=halaqa.id, session_date__in=[d1, d2, d3]).delete()
    print("ALL BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()

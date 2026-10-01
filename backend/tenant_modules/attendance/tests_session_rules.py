import os
import sys
import django
import datetime
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from django.conf import settings
from django.utils import timezone
from core_system.tenants.models import Tenant
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.attendance.models import HalaqaSession, AttendanceLog
from tenant_modules.attendance.views import (
    session_start_view,
    session_list_view,
    session_detail_view,
    available_dates_view,
    save_schedule_view
)

def run_backend_tests():
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
    today = timezone.now().date()
    past_date = today - datetime.timedelta(days=7)
    future_date = today + datetime.timedelta(days=7)

    print("=" * 60)
    print(f"RUNNING BACKEND TESTS ON HALAQA: {halaqa.name} ({halaqa.id})")
    print(f"TODAY: {today}, PAST: {past_date}, FUTURE: {future_date}")
    print("=" * 60)

    # Clean up any existing test sessions
    HalaqaSession.objects.using(db_name).filter(
        halaqa_id=halaqa.id, 
        session_date__in=[today, past_date, future_date]
    ).delete()

    MANDATORY_FUTURE_MSG = "لا يمكن إنشاء جلسة بتاريخ مستقبلي. يرجى اختيار تاريخ اليوم أو أي تاريخ سابق."
    MANDATORY_CONFLICT_MSG = "توجد جلسة مسجلة مسبقاً لهذه الحلقة في التاريخ المحدد."

    # ─────────────────────────────────────────────────────────
    # TEST-B1: إنشاء جلسة بتاريخ اليوم (Success)
    # ─────────────────────────────────────────────────────────
    req_b1 = factory.post('/api/attendance/sessions/start/', data=json.dumps({
        'halaqa_id': str(halaqa.id),
        'session_date': today.isoformat()
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp_b1 = session_start_view(req_b1)
    assert resp_b1.status_code == 201, f"TEST-B1 failed: expected 201, got {resp_b1.status_code}: {resp_b1.content}"
    data_b1 = json.loads(resp_b1.content.decode('utf-8'))
    today_session_id = data_b1['data']['session_id']
    print(f"[PASS] TEST-B1: Successfully created session with TODAY's date ({today}) -> session_id: {today_session_id}")

    # ─────────────────────────────────────────────────────────
    # TEST-B2: إنشاء جلسة بتاريخ سابق (Success)
    # ─────────────────────────────────────────────────────────
    req_b2 = factory.post('/api/attendance/sessions/', data=json.dumps({
        'halaqa_id': str(halaqa.id),
        'session_date': past_date.isoformat(),
        'start_time': '16:00',
        'end_time': '18:00'
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp_b2 = session_list_view(req_b2)
    assert resp_b2.status_code == 201, f"TEST-B2 failed: expected 201, got {resp_b2.status_code}: {resp_b2.content}"
    data_b2 = json.loads(resp_b2.content.decode('utf-8'))
    past_session_id = data_b2['data']['id']
    print(f"[PASS] TEST-B2: Successfully created session with PAST date ({past_date}) -> session_id: {past_session_id}")

    # ─────────────────────────────────────────────────────────
    # TEST-B3: إنشاء جلسة بتاريخ مستقبلي (Rejection 400 + Exact Message)
    # ─────────────────────────────────────────────────────────
    # 3a: عبر session_start_view
    req_b3_start = factory.post('/api/attendance/sessions/start/', data=json.dumps({
        'halaqa_id': str(halaqa.id),
        'session_date': future_date.isoformat()
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp_b3_start = session_start_view(req_b3_start)
    assert resp_b3_start.status_code == 400, f"TEST-B3 start failed: expected 400, got {resp_b3_start.status_code}"
    data_b3_start = json.loads(resp_b3_start.content.decode('utf-8'))
    assert data_b3_start['message'] == MANDATORY_FUTURE_MSG, f"Unexpected message: {data_b3_start['message']}"

    # 3b: عبر session_list_view (POST)
    req_b3_list = factory.post('/api/attendance/sessions/', data=json.dumps({
        'halaqa_id': str(halaqa.id),
        'session_date': future_date.isoformat()
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp_b3_list = session_list_view(req_b3_list)
    assert resp_b3_list.status_code == 400, f"TEST-B3 list failed: expected 400, got {resp_b3_list.status_code}"
    data_b3_list = json.loads(resp_b3_list.content.decode('utf-8'))
    assert data_b3_list['message'] == MANDATORY_FUTURE_MSG, f"Unexpected message: {data_b3_list['message']}"

    # 3c: عبر session_detail_view (PUT update date)
    req_b3_detail = factory.put(f'/api/attendance/sessions/{today_session_id}/', data=json.dumps({
        'session_date': future_date.isoformat()
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp_b3_detail = session_detail_view(req_b3_detail, pk=today_session_id)
    assert resp_b3_detail.status_code == 400, f"TEST-B3 detail failed: expected 400, got {resp_b3_detail.status_code}"
    data_b3_detail = json.loads(resp_b3_detail.content.decode('utf-8'))
    assert data_b3_detail['message'] == MANDATORY_FUTURE_MSG, f"Unexpected message: {data_b3_detail['message']}"

    # 3d: عبر save_schedule_view
    req_b3_sched = factory.post('/api/attendance/sessions/save-schedule/', data=json.dumps({
        'halaqa_id': str(halaqa.id),
        'month': future_date.strftime('%Y-%m'),
        'sessions': [{'session_date': future_date.isoformat()}]
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp_b3_sched = save_schedule_view(req_b3_sched)
    assert resp_b3_sched.status_code == 400, f"TEST-B3 sched failed: expected 400, got {resp_b3_sched.status_code}"
    data_b3_sched = json.loads(resp_b3_sched.content.decode('utf-8'))
    assert data_b3_sched['message'] == MANDATORY_FUTURE_MSG, f"Unexpected message: {data_b3_sched['message']}"

    print(f"[PASS] TEST-B3: Prevented future date ({future_date}) across all endpoints with 400 and mandatory message: '{MANDATORY_FUTURE_MSG}'")

    # ─────────────────────────────────────────────────────────
    # TEST-B4: إنشاء جلسة مكررة لنفس الحلقة ونفس التاريخ (Conflict 409 + Exact Message)
    # ─────────────────────────────────────────────────────────
    # 4a: عبر session_start_view
    req_b4_start = factory.post('/api/attendance/sessions/start/', data=json.dumps({
        'halaqa_id': str(halaqa.id),
        'session_date': today.isoformat()
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp_b4_start = session_start_view(req_b4_start)
    assert resp_b4_start.status_code == 409, f"TEST-B4 start failed: expected 409, got {resp_b4_start.status_code}"
    data_b4_start = json.loads(resp_b4_start.content.decode('utf-8'))
    assert data_b4_start['message'] == MANDATORY_CONFLICT_MSG, f"Unexpected message: {data_b4_start['message']}"

    # 4b: عبر session_list_view (POST)
    req_b4_list = factory.post('/api/attendance/sessions/', data=json.dumps({
        'halaqa_id': str(halaqa.id),
        'session_date': today.isoformat()
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp_b4_list = session_list_view(req_b4_list)
    assert resp_b4_list.status_code == 409, f"TEST-B4 list failed: expected 409, got {resp_b4_list.status_code}"
    data_b4_list = json.loads(resp_b4_list.content.decode('utf-8'))
    assert data_b4_list['message'] == MANDATORY_CONFLICT_MSG, f"Unexpected message: {data_b4_list['message']}"

    # 4c: عبر session_detail_view (PUT moving past session to today)
    req_b4_detail = factory.put(f'/api/attendance/sessions/{past_session_id}/', data=json.dumps({
        'session_date': today.isoformat()
    }), content_type='application/json', HTTP_TENANT_ID=str(tenant.id))
    resp_b4_detail = session_detail_view(req_b4_detail, pk=past_session_id)
    assert resp_b4_detail.status_code == 409, f"TEST-B4 detail failed: expected 409, got {resp_b4_detail.status_code}"
    data_b4_detail = json.loads(resp_b4_detail.content.decode('utf-8'))
    assert data_b4_detail['message'] == MANDATORY_CONFLICT_MSG, f"Unexpected message: {data_b4_detail['message']}"

    print(f"[PASS] TEST-B4: Rejected duplicate session on ({today}) across all endpoints with 409 and unified message: '{MANDATORY_CONFLICT_MSG}'")

    # ─────────────────────────────────────────────────────────
    # TEST-B5: التحقق من available_dates_view (عدم وجود أي تاريخ مستقبلي)
    # ─────────────────────────────────────────────────────────
    current_month = today.strftime('%Y-%m')
    req_b5 = factory.get(f'/api/attendance/sessions/available-dates/?halaqa_id={halaqa.id}&month={current_month}', HTTP_TENANT_ID=str(tenant.id))
    resp_b5 = available_dates_view(req_b5)
    assert resp_b5.status_code == 200, f"TEST-B5 failed: expected 200, got {resp_b5.status_code}"
    data_b5 = json.loads(resp_b5.content.decode('utf-8'))['data']
    avail_dates = data_b5['available_dates']

    for item in avail_dates:
        item_date = datetime.datetime.strptime(item['date'], '%Y-%m-%d').date()
        assert item_date <= today, f"TEST-B5 failed: found future date in available_dates: {item['date']}"
        assert item['is_future'] is False, f"TEST-B5 failed: is_future is True for {item['date']}"

    print(f"[PASS] TEST-B5: available_dates_view verified: {len(avail_dates)} available dates returned for {current_month}, ALL <= TODAY ({today}). Zero future dates.")

    # Cleanup
    HalaqaSession.objects.using(db_name).filter(
        halaqa_id=halaqa.id, 
        session_date__in=[today, past_date]
    ).delete()

    print("=" * 60)
    print("ALL BACKEND TESTS (TEST-B1 to TEST-B5) PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == '__main__':
    run_backend_tests()

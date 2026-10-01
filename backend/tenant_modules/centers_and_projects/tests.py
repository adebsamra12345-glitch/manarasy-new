import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

import json
import uuid
import datetime
import unittest
from django.test import RequestFactory
from django.conf import settings
from core_system.tenants.models import Tenant
from tenant_modules.centers_and_projects.models import Center, Project, MosqueWeeklySchedule
from tenant_modules.centers_and_projects.views import (
    mosque_schedule_list_create_view,
    mosque_schedule_detail_view,
    mosque_schedule_bulk_save_view
)

class MosqueWeeklyScheduleLiveAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tenant_db = 'tenant_alnasseer_db'
        if cls.tenant_db not in settings.DATABASES:
            new_db_config = settings.DATABASES['default'].copy()
            new_db_config['NAME'] = cls.tenant_db
            settings.DATABASES[cls.tenant_db] = new_db_config
        cls.tenant = Tenant.objects.using('default').filter(subdomain='alnasseer').first()
        cls.factory = RequestFactory()

    def setUp(self):
        self.center = Center.objects.using(self.tenant_db).first()
        self.project = Project.objects.using(self.tenant_db).first()

    def test_01_create_schedule_slot(self):
        post_data = {
            "center_id": str(self.center.id) if self.center else None,
            "project_id": str(self.project.id) if self.project else None,
            "month": "2026-03",
            "week_number": 1,
            "day_of_week": 1,
            "start_time": "09:00",
            "end_time": "11:00",
            "session_title": "حلقة الإتقان الصباحية",
            "notes": "جلسة مخصصة لطلاب المستوى المتقدم"
        }
        req = self.factory.post(
            '/api/centers/schedules/',
            data=json.dumps(post_data),
            content_type='application/json',
            HTTP_TENANT_ID=str(self.tenant.id)
        )
        res = mosque_schedule_list_create_view(req)
        self.assertEqual(res.status_code, 201)
        res_json = json.loads(res.content)
        self.assertEqual(res_json['status'], 'success')
        self.assertEqual(res_json['data']['start_time'], '09:00')
        self.assertEqual(res_json['data']['end_time'], '11:00')

    def test_02_list_schedules(self):
        req_get = self.factory.get(
            f'/api/centers/schedules/?month=2026-03',
            HTTP_TENANT_ID=str(self.tenant.id)
        )
        res_get = mosque_schedule_list_create_view(req_get)
        self.assertEqual(res_get.status_code, 200)
        res_json = json.loads(res_get.content)
        self.assertEqual(res_json['status'], 'success')
        self.assertGreaterEqual(res_json['count'], 1)
        self.assertEqual(res_json['data'][0]['day_name'], 'الإثنين')

    def test_03_update_and_delete_schedule_slot(self):
        item = MosqueWeeklySchedule.objects.using(self.tenant_db).filter(month="2026-03").first()
        self.assertIsNotNone(item)

        # GET Detail
        req_get = self.factory.get(
            f'/api/centers/schedules/{item.id}/',
            HTTP_TENANT_ID=str(self.tenant.id)
        )
        res_get = mosque_schedule_detail_view(req_get, pk=item.id)
        self.assertEqual(res_get.status_code, 200)
        self.assertEqual(json.loads(res_get.content)['data']['day_name'], 'الإثنين')

        # PUT Update
        update_data = {
            "start_time": "16:00",
            "end_time": "18:00",
            "session_title": "جلسة مسائية معدلة"
        }
        req_put = self.factory.put(
            f'/api/centers/schedules/{item.id}/',
            data=json.dumps(update_data),
            content_type='application/json',
            HTTP_TENANT_ID=str(self.tenant.id)
        )
        res_put = mosque_schedule_detail_view(req_put, pk=item.id)
        self.assertEqual(res_put.status_code, 200)
        self.assertEqual(json.loads(res_put.content)['data']['start_time'], '16:00')

        # DELETE
        req_del = self.factory.delete(
            f'/api/centers/schedules/{item.id}/',
            HTTP_TENANT_ID=str(self.tenant.id)
        )
        res_del = mosque_schedule_detail_view(req_del, pk=item.id)
        self.assertEqual(res_del.status_code, 200)
        self.assertFalse(MosqueWeeklySchedule.objects.using(self.tenant_db).filter(id=item.id).exists())

    def test_04_bulk_save_schedule_matrix(self):
        bulk_data = {
            "center_id": str(self.center.id) if self.center else None,
            "project_id": str(self.project.id) if self.project else None,
            "month": "2026-02",
            "schedules": [
                {"week_number": 1, "day_of_week": 1, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 1"},
                {"week_number": 1, "day_of_week": 3, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 2"},
                {"week_number": 1, "day_of_week": 5, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 3"},
                {"week_number": 2, "day_of_week": 1, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 4"},
                {"week_number": 2, "day_of_week": 3, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 5"},
                {"week_number": 2, "day_of_week": 5, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 6"},
                {"week_number": 3, "day_of_week": 1, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 7"},
                {"week_number": 3, "day_of_week": 3, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 8"},
                {"week_number": 3, "day_of_week": 5, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 9"},
                {"week_number": 4, "day_of_week": 1, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 10"},
                {"week_number": 4, "day_of_week": 3, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 11"},
                {"week_number": 4, "day_of_week": 5, "start_time": "09:00", "end_time": "11:00", "session_title": "جلسة 12"},
            ]
        }
        req = self.factory.post(
            '/api/centers/schedules/bulk-save/',
            data=json.dumps(bulk_data),
            content_type='application/json',
            HTTP_TENANT_ID=str(self.tenant.id)
        )
        res = mosque_schedule_bulk_save_view(req)
        self.assertEqual(res.status_code, 200)
        res_json = json.loads(res.content)
        self.assertEqual(res_json['status'], 'success')
        self.assertEqual(res_json['count'], 12)
        self.assertEqual(MosqueWeeklySchedule.objects.using(self.tenant_db).filter(month="2026-02").count(), 12)

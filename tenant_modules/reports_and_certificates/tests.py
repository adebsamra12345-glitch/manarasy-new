import json
import time
import uuid
from datetime import date, timedelta
import unittest

from django.test import RequestFactory
from django.conf import settings
from django.utils import timezone

from core_system.tenants.models import Tenant
from tenant_modules.centers_and_projects.models import Center, Project, StudentExamResult, ProjectStage
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student, StudentEnrollment, Parent
from tenant_modules.attendance.models import HalaqaSession, AttendanceLog
from tenant_modules.recitation_and_sabr.models import RecitationLog

from tenant_modules.reports_and_certificates.views import (
    reports_data_view,
    student_activity_view,
    available_months_view,
    compute_rating,
    get_date_range_from_filter
)
from tenant_modules.reports_and_certificates.analytical_engines import (
    get_available_mosque_months,
    analyze_circle_performance,
    analyze_project_progress,
    analyze_student_trend,
    compute_overall_assessment
)


class AnalyticalEngineTests(unittest.TestCase):
    """Unit tests for the AI & Analytical engines using tenant DB."""

    @classmethod
    def setUpClass(cls):
        cls.tenant_db = 'tenant_alnasseer_db'
        if cls.tenant_db not in settings.DATABASES:
            new_db_config = settings.DATABASES['default'].copy()
            new_db_config['NAME'] = cls.tenant_db
            settings.DATABASES[cls.tenant_db] = new_db_config

    def test_available_mosque_months_extraction(self):
        months = get_available_mosque_months(self.tenant_db)
        self.assertIsInstance(months, list)
        self.assertGreaterEqual(len(months), 1)
        self.assertIn('value', months[0])
        self.assertIn('label', months[0])
        self.assertIn('year', months[0])
        self.assertIn('month', months[0])

    def test_cpi_circle_performance_engine(self):
        res = analyze_circle_performance(self.tenant_db)
        self.assertIn('average_cpi', res)
        self.assertIn('total_halaqat_analyzed', res)
        self.assertIn('halaqat_rankings', res)
        self.assertIn('ai_insight', res)
        if res['total_halaqat_analyzed'] > 0:
            ranking = res['halaqat_rankings'][0]
            self.assertIn('cpi_numeric', ranking)
            self.assertIn('metrics_breakdown', ranking)
            self.assertIn('attendance_score', ranking['metrics_breakdown'])

    def test_ppai_project_progress_engine(self):
        res = analyze_project_progress(self.tenant_db)
        self.assertIn('period', res)
        self.assertIn('projects_analysis', res)
        if len(res['projects_analysis']) > 0:
            p_data = res['projects_analysis'][0]
            self.assertIn('progress_index', p_data)
            self.assertIn('progress_numeric', p_data)
            self.assertIn('exams_conducted', p_data)

    def test_student_trend_engine(self):
        student = Student.objects.using(self.tenant_db).first()
        if student:
            res = analyze_student_trend(self.tenant_db, str(student.id))
            self.assertIsNotNone(res)
            self.assertIn('overall_attendance_rate', res)
            self.assertIn('attendance_trend', res)
            self.assertIn('memorization_velocity_weekly', res)
            self.assertIn('risk_classification', res)
            self.assertIn('recommendation', res)

    def test_overall_assessment_engine(self):
        res = compute_overall_assessment(self.tenant_db)
        self.assertIn('overall_score', res)
        self.assertIn('overall_numeric', res)
        self.assertIn('breakdown', res)
        self.assertEqual(len(res['breakdown']), 3)

    def test_compute_rating_helper(self):
        self.assertEqual(compute_rating(95, 600), "ممتاز")
        self.assertEqual(compute_rating(88, 360), "جيد جداً")
        self.assertEqual(compute_rating(78, 210), "جيد")
        self.assertEqual(compute_rating(60, 50), "مقبول")

    def test_date_range_filter_helper(self):
        today = timezone.localdate()
        s1, e1 = get_date_range_from_filter('today')
        self.assertEqual(s1, today)
        self.assertEqual(e1, today)

        s2, e2 = get_date_range_from_filter('all')
        self.assertIsNone(s2)
        self.assertIsNone(e2)

        s3, e3 = get_date_range_from_filter('2026-03')
        self.assertEqual(s3, date(2026, 3, 1))
        self.assertEqual(e3, date(2026, 3, 31))


class TenantLiveReportsAndRegressionTests(unittest.TestCase):
    """Integration & regression tests on the multi-tenant database."""

    @classmethod
    def setUpClass(cls):
        cls.factory = RequestFactory()
        cls.tenant_id = '2f34a04d-4f94-4c90-913e-9039be5eb03f'
        cls.tenant_db = 'tenant_alnasseer_db'

        if cls.tenant_db not in settings.DATABASES:
            new_db_config = settings.DATABASES['default'].copy()
            new_db_config['NAME'] = cls.tenant_db
            settings.DATABASES[cls.tenant_db] = new_db_config

    def _make_request(self, path, params=None):
        req = self.factory.get(path, params or {}, HTTP_TENANT_ID=self.tenant_id)
        return req

    def test_live_available_months_endpoint(self):
        req = self._make_request('/api/reports/available-months/')
        start_time = time.time()
        res = available_months_view(req)
        duration_ms = (time.time() - start_time) * 1000

        self.assertEqual(res.status_code, 200)
        self.assertLess(duration_ms, 250, "API response time should be < 250ms")

        data = json.loads(res.content.decode('utf-8'))['data']
        self.assertIsInstance(data, list)
        if len(data) > 0:
            self.assertIn('value', data[0])
            self.assertIn('label', data[0])

    def test_live_reports_halaqat_tab(self):
        req = self._make_request('/api/reports/data/', {'tab': 'halaqat', 'time_filter': 'all'})
        start_time = time.time()
        res = reports_data_view(req)
        duration_ms = (time.time() - start_time) * 1000

        self.assertEqual(res.status_code, 200)
        self.assertLess(duration_ms, 250, "Latency must be < 250ms")

        data = json.loads(res.content.decode('utf-8'))['data']
        self.assertEqual(data['tab'], 'halaqat')
        self.assertIn('stats', data)
        self.assertIn('avg_attendance', data['stats'])
        self.assertIn('total_sessions', data['stats'])
        self.assertIn('total_pages', data['stats'])
        self.assertNotIn('total_points', data['stats'], "total_points must be removed")

        for item in data['items']:
            self.assertIn('halaqa_name', item)
            self.assertIn('students_count', item)
            self.assertIn('pages_recited', item)

    def test_live_reports_centers_tab(self):
        req = self._make_request('/api/reports/data/', {'tab': 'centers', 'time_filter': 'all'})
        res = reports_data_view(req)
        self.assertEqual(res.status_code, 200)

        data = json.loads(res.content.decode('utf-8'))['data']
        self.assertEqual(data['tab'], 'centers')
        self.assertIn('total_centers', data['stats'])
        self.assertIn('total_managers', data['stats'])

    def test_live_reports_projects_tab(self):
        req = self._make_request('/api/reports/data/', {'tab': 'projects', 'time_filter': 'all'})
        res = reports_data_view(req)
        self.assertEqual(res.status_code, 200)

        data = json.loads(res.content.decode('utf-8'))['data']
        self.assertEqual(data['tab'], 'projects')
        self.assertNotIn('enrolled_halaqat', data['stats'], "enrolled_halaqat must be removed")
        self.assertNotIn('enrolled_students', data['stats'], "enrolled_students must be removed")

        for item in data['items']:
            self.assertIn('completion_rate', item)
            self.assertIn('project_name', item)

    def test_live_reports_teachers_tab(self):
        req = self._make_request('/api/reports/data/', {'tab': 'teachers', 'time_filter': 'all'})
        res = reports_data_view(req)
        self.assertEqual(res.status_code, 200)

        data = json.loads(res.content.decode('utf-8'))['data']
        self.assertEqual(data['tab'], 'teachers')
        self.assertNotIn('avg_rating', data['stats'], "avg_rating must be removed from stats")
        self.assertNotIn('total_sessions', data['stats'], "total_sessions must be removed from stats")

        for item in data['items']:
            self.assertIn('teacher_name', item)
            self.assertIn('rating', item)

    def test_live_reports_students_tab(self):
        req = self._make_request('/api/reports/data/', {'tab': 'students', 'time_filter': 'all'})
        res = reports_data_view(req)
        self.assertEqual(res.status_code, 200)

        data = json.loads(res.content.decode('utf-8'))['data']
        self.assertEqual(data['tab'], 'students')
        self.assertIn('top_students_list', data['stats'])
        self.assertIsInstance(data['stats']['top_students_list'], list)

    def test_live_reports_pages_tab(self):
        req = self._make_request('/api/reports/data/', {'tab': 'pages', 'time_filter': 'all'})
        res = reports_data_view(req)
        self.assertEqual(res.status_code, 200)

        data = json.loads(res.content.decode('utf-8'))['data']
        self.assertEqual(data['tab'], 'pages')
        self.assertIn('new_memorization', data['stats'])
        self.assertIn('minor_review', data['stats'])
        self.assertIn('major_review', data['stats'])

    def test_live_reports_evaluation_tab(self):
        req = self._make_request('/api/reports/data/', {'tab': 'evaluation', 'time_filter': 'all'})
        res = reports_data_view(req)
        self.assertEqual(res.status_code, 200)

        data = json.loads(res.content.decode('utf-8'))['data']
        self.assertEqual(data['tab'], 'evaluation')
        self.assertIn('overall_score', data['stats'])
        self.assertIn('attendance_index', data['stats'])
        self.assertIn('memorization_index', data['stats'])
        self.assertIn('discipline_index', data['stats'])
        self.assertIn('items', data)
        self.assertEqual(len(data['items']), 3)

    def test_live_student_activity_endpoint(self):
        # Fetch first student from live DB
        student = Student.objects.using(self.tenant_db).first()
        if student:
            req = self._make_request('/api/reports/student-activity/', {'student_id': str(student.id), 'time_filter': 'all'})
            start_time = time.time()
            res = student_activity_view(req)
            duration_ms = (time.time() - start_time) * 1000

            self.assertEqual(res.status_code, 200)
            self.assertLess(duration_ms, 250, "Latency must be < 250ms")

            data = json.loads(res.content.decode('utf-8'))['data']
            self.assertEqual(data['student_info']['id'], str(student.id))
            self.assertIn('summary_stats', data)
            self.assertIn('recitations_history', data)
            self.assertIn('attendance_history', data)
            self.assertIn('ai_trend_analysis', data)

    def test_student_activity_not_found(self):
        random_id = str(uuid.uuid4())
        req = self._make_request('/api/reports/student-activity/', {'student_id': random_id})
        res = student_activity_view(req)
        self.assertEqual(res.status_code, 404)

    def test_edge_case_empty_filter_results(self):
        non_existent_center_id = str(uuid.uuid4())
        req = self._make_request('/api/reports/data/', {'tab': 'halaqat', 'center_id': non_existent_center_id})
        res = reports_data_view(req)
        self.assertEqual(res.status_code, 200)

        data = json.loads(res.content.decode('utf-8'))['data']
        self.assertEqual(len(data['items']), 0)
        self.assertEqual(data['stats']['total_pages'], 0)
        self.assertEqual(data['stats']['total_sessions'], 0)

    def test_time_filter_variations(self):
        for tf in ['today', 'this_week', 'this_month', 'last_month', 'this_year']:
            req = self._make_request('/api/reports/data/', {'tab': 'halaqat', 'time_filter': tf})
            res = reports_data_view(req)
            self.assertEqual(res.status_code, 200, f"Time filter {tf} should return 200")


if __name__ == '__main__':
    unittest.main()

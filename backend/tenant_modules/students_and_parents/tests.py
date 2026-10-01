import jwt
import uuid
from django.test import TestCase, Client
from django.conf import settings
from tenant_modules.users.models import User, UserProfile
from tenant_modules.students_and_parents.models import Student, StudentRegistrationRequest, StudentDeletionRequest

class StudentRequestsApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Create user & teacher profile
        self.user = User.objects.create_user(username='teacher1', password='password123', email='teacher1@example.com')
        self.profile = UserProfile.objects.create(user=self.user, roles=['TEACHER'])
        
        # JWT Token for authentication
        secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        self.token = jwt.encode({'user_id': str(self.user.id)}, secret, algorithm='HS256')
        self.headers = {'HTTP_AUTHORIZATION': f'Bearer {self.token}'}

        # Create sample student
        self.student = Student.objects.create(full_name='طالب تجريبي', gender='M')

    def test_get_registration_requests(self):
        # Create a pending registration request
        req = StudentRegistrationRequest.objects.create(
            full_name='طالب جديد',
            requested_by=self.profile,
            request_type='NEW',
            status='PENDING'
        )
        
        response = self.client.get('/api/students-and-parents/students/registration-requests/', **self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertGreaterEqual(data['count'], 1)

    def test_cancel_registration_request_success(self):
        req = StudentRegistrationRequest.objects.create(
            full_name='طالب لإلغاء طلب تسجيله',
            requested_by=self.profile,
            request_type='NEW',
            status='PENDING'
        )
        
        url = f'/api/students-and-parents/students/registration-requests/{req.id}/cancel/'
        response = self.client.post(url, **self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        
        # Verify status in database
        req.refresh_from_db()
        self.assertEqual(req.status, 'CANCELLED')

    def test_cancel_registration_request_forbidden_when_approved(self):
        req = StudentRegistrationRequest.objects.create(
            full_name='طالب مقبول',
            requested_by=self.profile,
            request_type='NEW',
            status='APPROVED'
        )
        
        url = f'/api/students-and-parents/students/registration-requests/{req.id}/cancel/'
        response = self.client.post(url, **self.headers)
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertEqual(data['status'], 'error')

    def test_cancel_deletion_request_success(self):
        del_req = StudentDeletionRequest.objects.create(
            student=self.student,
            requested_by=self.profile,
            reason='طلب حذف تجريبي',
            status='PENDING'
        )
        
        url = f'/api/students-and-parents/students/deletion-requests/{del_req.id}/cancel/'
        response = self.client.post(url, **self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        
        del_req.refresh_from_db()
        self.assertEqual(del_req.status, 'CANCELLED')

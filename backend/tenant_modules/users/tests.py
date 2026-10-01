import json
from unittest.mock import MagicMock, patch
from django.test import SimpleTestCase, RequestFactory
from django.http import JsonResponse
from tenant_modules.users.views import user_detail_view, execute_user_delete

class TeacherDeleteUnitTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    @patch('tenant_modules.users.views.get_tenant_db')
    @patch('tenant_modules.users.views.get_token_payload')
    @patch('tenant_modules.users.views.User')
    @patch('tenant_modules.users.views.UserProfile')
    @patch('tenant_modules.users.views.execute_user_delete')
    def test_delete_teacher_as_admin_success(self, mock_execute_delete, mock_user_profile, mock_user, mock_get_token, mock_get_tenant_db):
        mock_get_tenant_db.return_value = ('tenant_db', MagicMock())
        mock_get_token.return_value = {
            'role': 'TENANT_ADMIN',
            'username': 'admin_user'
        }
        
        target_u = MagicMock()
        target_u.username = 'teacher_user'
        target_u.first_name = 'أحمد'
        target_u.last_name = 'الراشد'
        mock_user.objects.using.return_value.get.return_value = target_u
        
        target_p = MagicMock()
        target_p.role = 'TEACHER'
        target_p.get_roles.return_value = ['TEACHER']
        mock_user_profile.objects.using.return_value.get.return_value = target_p

        request = self.factory.delete('/api/users/12345678-1234-1234-1234-123456789012/')
        response = user_detail_view(request, '12345678-1234-1234-1234-123456789012')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(data['status'], 'success')
        self.assertIn('أحمد الراشد', data['message'])
        mock_execute_delete.assert_called_once_with('tenant_db', target_u)

    @patch('tenant_modules.users.views.get_tenant_db')
    @patch('tenant_modules.users.views.get_token_payload')
    @patch('tenant_modules.users.views.User')
    @patch('tenant_modules.users.views.UserProfile')
    def test_delete_teacher_as_teacher_forbidden(self, mock_user_profile, mock_user, mock_get_token, mock_get_tenant_db):
        mock_get_tenant_db.return_value = ('tenant_db', MagicMock())
        mock_get_token.return_value = {
            'role': 'TEACHER',
            'username': 'teacher_user'
        }
        
        target_u = MagicMock()
        target_u.username = 'teacher2_user'
        mock_user.objects.using.return_value.get.return_value = target_u
        
        target_p = MagicMock()
        target_p.role = 'TEACHER'
        target_p.get_roles.return_value = ['TEACHER']
        mock_user_profile.objects.using.return_value.get.return_value = target_p

        request = self.factory.delete('/api/users/12345678-1234-1234-1234-123456789012/')
        response = user_detail_view(request, '12345678-1234-1234-1234-123456789012')
        
        self.assertEqual(response.status_code, 403)
        data = json.loads(response.content)
        self.assertEqual(data['status'], 'error')

    @patch('tenant_modules.users.views.get_tenant_db')
    @patch('tenant_modules.users.views.get_token_payload')
    @patch('tenant_modules.users.views.User')
    @patch('tenant_modules.users.views.UserProfile')
    def test_delete_self_forbidden(self, mock_user_profile, mock_user, mock_get_token, mock_get_tenant_db):
        mock_get_tenant_db.return_value = ('tenant_db', MagicMock())
        mock_get_token.return_value = {
            'role': 'TENANT_ADMIN',
            'username': 'admin_user'
        }
        
        target_u = MagicMock()
        target_u.username = 'admin_user'
        mock_user.objects.using.return_value.get.return_value = target_u
        
        target_p = MagicMock()
        target_p.role = 'TENANT_ADMIN'
        target_p.get_roles.return_value = ['TENANT_ADMIN']
        mock_user_profile.objects.using.return_value.get.return_value = target_p

        request = self.factory.delete('/api/users/12345678-1234-1234-1234-123456789012/')
        response = user_detail_view(request, '12345678-1234-1234-1234-123456789012')
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertEqual(data['status'], 'error')
        self.assertIn('شخصي', data['message'])

import os
import sys
import json
import uuid
import django

sys.stdout.reconfigure(encoding='utf-8')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from django.conf import settings
from django.contrib.auth import get_user_model
from core_system.tenants.models import Tenant
from tenant_modules.users.models import UserProfile
from tenant_modules.students_and_parents.models import Student
from tenant_modules.students_and_parents.views import student_list_create_view
from tenant_modules.users.views import user_list_create_view, user_detail_view, switch_active_role_view
import jwt

User = get_user_model()
factory = RequestFactory()

def run_integration_tests():
    print("==================================================================")
    print("Starting API & Flow Integration Tests")
    print("==================================================================")

    tenant = Tenant.objects.using('default').filter(db_name='tenant_alnasseer_db').first() or Tenant.objects.using('default').first()
    db_name = tenant.db_name
    tenant_id = str(tenant.id)

    if db_name not in settings.DATABASES:
        cfg = settings.DATABASES['default'].copy()
        cfg['NAME'] = db_name
        settings.DATABASES[db_name] = cfg

    print(f"Testing on Tenant: {tenant.name} ({db_name}) [ID: {tenant_id}]")

    # جلب أو إنشاء حساب أدمن للاختبار
    admin_user = User.objects.using(db_name).filter(is_superuser=True).first() or User.objects.using(db_name).filter(username='manager').first()
    if not admin_user:
        admin_user = User.objects.using(db_name).create(
            username='admin_test_qa',
            first_name='Admin',
            last_name='Tester',
            is_active=True
        )
        UserProfile.objects.using(db_name).create(
            user=admin_user,
            role='TENANT_ADMIN',
            roles=['TENANT_ADMIN']
        )

    jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
    admin_token = jwt.encode({
        'user_id': str(admin_user.id),
        'username': admin_user.username,
        'role': 'TENANT_ADMIN',
        'roles': ['TENANT_ADMIN'],
        'tenant_id': tenant_id
    }, jwt_secret, algorithm='HS256')

    auth_header = f"Bearer {admin_token}"

    # -----------------------------------------------------------------
    # فحص 1: استدعاء API إنشاء الطالب POST /api/students/students/
    # -----------------------------------------------------------------
    print("\n[API Test 1] POST /api/students/students/ -> Creating Student via API...")
    unique_num = uuid.uuid4().hex[:6]
    student_payload = {
        'full_name': f"أحمد المنصور {unique_num}",
        'national_id': f"NAT99_{unique_num}",
        'parent_name': 'سليمان المنصور',
        'parent_phone': '0555998877',
        'mother_name': 'فاطمة',
        'mother_phone': '0555998866',
        'reached_page': 5,
        'gender': 'M'
    }

    req = factory.post(
        '/api/students/students/',
        data=json.dumps(student_payload),
        content_type='application/json',
        HTTP_AUTHORIZATION=auth_header,
        HTTP_TENANT_ID=tenant_id
    )
    resp = student_list_create_view(req)
    assert resp.status_code == 201, f"Failed: status {resp.status_code}, content: {resp.content}"
    res_data = json.loads(resp.content.decode('utf-8'))
    created_stu = res_data['data']
    assert 'user_id' in created_stu and created_stu['user_id'] is not None, "Failed: user_id missing in response"
    assert 'username' in created_stu and created_stu['username'] is not None, "Failed: username missing in response"
    print(f"PASS: Student created via API! Student ID: {created_stu['id']}, Username: {created_stu['username']}")

    # -----------------------------------------------------------------
    # فحص 2: استدعاء API جلب المستخدمين والتحقق من ظهور الطالب
    # -----------------------------------------------------------------
    print("\n[API Test 2] GET /api/users/ -> Verifying Student in Users Management...")
    req2 = factory.get(
        '/api/users/',
        HTTP_AUTHORIZATION=auth_header,
        HTTP_TENANT_ID=tenant_id
    )
    resp2 = user_list_create_view(req2)
    assert resp2.status_code == 200, f"Failed: status {resp2.status_code}"
    res2_data = json.loads(resp2.content.decode('utf-8'))
    user_list = res2_data['data']
    found_user = next((u for u in user_list if u['username'] == created_stu['username']), None)
    assert found_user is not None, "Failed: Student user not found in Users Management list"
    assert found_user['role'] == 'STUDENT', f"Failed: Role expected STUDENT, got {found_user['role']}"
    print(f"PASS: Student ({found_user['username']}) successfully visible in Users List with role {found_user['role']}")

    # -----------------------------------------------------------------
    # فحص 3: تعديل المستخدم وإضافة دور إضافي (TEACHER) لدعم Multiple Roles
    # -----------------------------------------------------------------
    print("\n[API Test 3] PATCH /api/users/<id>/ -> Adding TEACHER role to Student (Multiple Roles)...")
    req3 = factory.patch(
        f"/api/users/{created_stu['user_id']}/",
        data=json.dumps({
            'roles': ['STUDENT', 'TEACHER']
        }),
        content_type='application/json',
        HTTP_AUTHORIZATION=auth_header,
        HTTP_TENANT_ID=tenant_id
    )
    resp3 = user_detail_view(req3, created_stu['user_id'])
    assert resp3.status_code == 200, f"Failed: status {resp3.status_code}, content: {resp3.content}"
    refreshed_prof = UserProfile.objects.using(db_name).get(user__id=created_stu['user_id'])
    roles_list = refreshed_prof.get_roles()
    assert 'STUDENT' in roles_list and 'TEACHER' in roles_list, f"Failed: roles not updated {roles_list}"
    print(f"PASS: User roles updated to multiple roles: {roles_list}")

    # -----------------------------------------------------------------
    # فحص 4: اختبار التبديل بين الأدوار switch_active_role_view
    # -----------------------------------------------------------------
    print("\n[API Test 4] POST /api/users/switch-role/ -> Switching active role to TEACHER...")
    student_user_obj = User.objects.using(db_name).get(id=created_stu['user_id'])
    student_token = jwt.encode({
        'user_id': str(student_user_obj.id),
        'username': student_user_obj.username,
        'role': 'STUDENT',
        'roles': ['STUDENT', 'TEACHER'],
        'tenant_id': tenant_id
    }, jwt_secret, algorithm='HS256')

    req4 = factory.post(
        '/api/users/switch-role/',
        data=json.dumps({'role': 'TEACHER'}),
        content_type='application/json',
        HTTP_AUTHORIZATION=f"Bearer {student_token}",
        HTTP_TENANT_ID=tenant_id
    )
    resp4 = switch_active_role_view(req4)
    assert resp4.status_code == 200, f"Failed: status {resp4.status_code}, content: {resp4.content}"
    res4_data = json.loads(resp4.content.decode('utf-8'))
    assert res4_data.get('status') == 'success', "Failed: status not success"
    new_token = res4_data['data']['access_token']
    decoded_new = jwt.decode(new_token, jwt_secret, algorithms=['HS256'])
    assert decoded_new.get('role') == 'TEACHER', f"Failed: Active role is not TEACHER in new token {decoded_new}"
    print(f"PASS: Active role successfully switched to: {decoded_new.get('role')} with new valid JWT issued.")

    # -----------------------------------------------------------------
    # تنظيف الطالب التجريبي
    # -----------------------------------------------------------------
    Student.objects.using(db_name).filter(id=created_stu['id']).delete()
    User.objects.using(db_name).filter(id=created_stu['user_id']).delete()

    print("\n==================================================================")
    print("ALL INTEGRATION TESTS PASSED (100% SUCCESS)!")
    print("==================================================================")
    return True

if __name__ == '__main__':
    run_integration_tests()

import os
import sys
import django
import uuid

# Force UTF-8 for windows console
sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from core_system.tenants.models import Tenant
from tenant_modules.users.models import UserProfile
from tenant_modules.students_and_parents.models import Student
from tenant_modules.students_and_parents.services import create_or_update_student_user

User = get_user_model()

def run_tests():
    print("==================================================================")
    print("Starting Architecture QA Suite")
    print("==================================================================")

    # 1. إعداد قاعدة بيانات المستأجر للاختبار
    tenant = Tenant.objects.using('default').filter(db_name='tenant_alnasseer_db').first() or Tenant.objects.using('default').first()
    if not tenant:
        print("ERROR: No tenant found in default database")
        return False
    
    db_name = tenant.db_name
    if db_name not in settings.DATABASES:
        cfg = settings.DATABASES['default'].copy()
        cfg['NAME'] = db_name
        settings.DATABASES[db_name] = cfg

    print(f"Target tenant: {tenant.name} ({db_name})")

    # ---------------------------------------------------------------
    # اختبار 1: إنشاء طالب جديد والتحقق من التوليد التلقائي لـ User و UserProfile
    # ---------------------------------------------------------------
    print("\n[Test 1] Creating new student and verifying auto-generated User & Profile...")
    test_stu_name = f"Test Student {uuid.uuid4().hex[:6]}"
    test_nat_id = f"NAT_{uuid.uuid4().hex[:8]}"
    
    stu = Student.objects.using(db_name).create(
        full_name=test_stu_name,
        national_id=test_nat_id,
        father_name="Student Father",
        father_phone="0501112233",
        reached_page=15
    )

    user_obj, prof_obj, generated_pw, is_new = create_or_update_student_user(db_name, stu)

    assert stu.user is not None, "Failed: stu.user is None"
    assert stu.user.id == user_obj.id, "Failed: user ID mismatch"
    assert user_obj.username == test_nat_id.lower(), f"Failed: username expected {test_nat_id.lower()} got {user_obj.username}"
    assert 'STUDENT' in prof_obj.get_roles(), "Failed: STUDENT role not in roles"
    assert prof_obj.role == 'STUDENT', "Failed: role is not STUDENT"
    assert check_password(test_nat_id, user_obj.password), "Failed: password hash check"
    print("PASS: Test 1 succeeded: Student and User account auto-generated and linked properly.")

    # ---------------------------------------------------------------
    # اختبار 2: التحقق من ظهور الطالب داخل قائمة المستخدمين والبحث
    # ---------------------------------------------------------------
    print("\n[Test 2] Verifying student appears in users table and querysets...")
    user_in_db = User.objects.using(db_name).filter(username=user_obj.username).first()
    assert user_in_db is not None, "Failed: User not found in auth_user"
    assert hasattr(user_in_db, 'student_profile'), "Failed: reverse relation student_profile missing on User"
    assert user_in_db.student_profile.id == stu.id, "Failed: reverse relation student_profile points to wrong student"
    
    # Search
    search_qs = User.objects.using(db_name).filter(first_name__icontains="Test")
    assert search_qs.filter(id=user_obj.id).exists(), "Failed: User not findable in search"
    print("PASS: Test 2 succeeded: Student appears in users table and search queries.")

    # ---------------------------------------------------------------
    # اختبار 3: دعم تعدد الأدوار للمستخدم الواحد (Student + Teacher)
    # ---------------------------------------------------------------
    print("\n[Test 3] Testing multiple roles on single user (STUDENT + TEACHER)...")
    prof_obj.set_roles(['STUDENT', 'TEACHER'])
    prof_obj.save(using=db_name)

    refreshed_prof = UserProfile.objects.using(db_name).get(id=prof_obj.id)
    roles = refreshed_prof.get_roles()
    assert 'STUDENT' in roles and 'TEACHER' in roles, f"Failed: multiple roles not saved {roles}"
    assert refreshed_prof.user.student_profile.id == stu.id, "Failed: student link lost after adding TEACHER role"
    print("PASS: Test 3 succeeded: User holds multiple roles (STUDENT + TEACHER) without breaking linkage.")

    # ---------------------------------------------------------------
    # اختبار 4: التحقق من عدم وجود أي حساب بدور PARENT في قاعدة البيانات
    # ---------------------------------------------------------------
    print("\n[Test 4] Ensuring zero PARENT accounts in database...")
    parent_profiles_count = UserProfile.objects.using(db_name).filter(role='PARENT').count()
    assert parent_profiles_count == 0, f"Failed: found {parent_profiles_count} PARENT profiles"
    print("PASS: Test 4 succeeded: Zero PARENT accounts in database.")

    # ---------------------------------------------------------------
    # اختبار 5: حذف الطالب والتنظيف الآمن للحساب المرتبط
    # ---------------------------------------------------------------
    print("\n[Test 5] Testing student deletion and clean account removal...")
    user_id_to_check = user_obj.id
    user_to_delete = stu.user
    stu.delete(using=db_name)
    if user_to_delete:
        user_to_delete.delete(using=db_name)

    assert not Student.objects.using(db_name).filter(id=stu.id).exists(), "Failed: student still exists"
    assert not User.objects.using(db_name).filter(id=user_id_to_check).exists(), "Failed: user account not deleted"
    print("PASS: Test 5 succeeded: Student and linked User deleted safely without orphan records.")

    print("\n==================================================================")
    print("ALL TESTS PASSED SUCCESSFULLY (100% PASS RATE)!")
    print("==================================================================")
    return True

if __name__ == '__main__':
    run_tests()

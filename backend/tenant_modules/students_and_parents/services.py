import re
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from tenant_modules.users.models import UserProfile
from .models import Student, StudentEnrollment

User = get_user_model()

ARABIC_TO_LATIN = {
    'أ': 'a', 'إ': 'a', 'آ': 'a', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'y', 'ء': '', 'ة': 'a', ' ': '.'
}

def transliterate_arabic(text):
    if not text:
        return ''
    clean = text.strip()
    clean = clean.replace('محمد', 'mohammad') \
                 .replace('أحمد', 'ahmad').replace('احمد', 'ahmad') \
                 .replace('محمود', 'mahmoud') \
                 .replace('مصطفى', 'mustafa') \
                 .replace('عبد', 'abd') \
                 .replace('علي', 'ali') \
                 .replace('عمر', 'omar') \
                 .replace('عثمان', 'othman') \
                 .replace('إبراهيم', 'ibrahim').replace('ابراهيم', 'ibrahim')
    res = ''
    for char in clean:
        if char in ARABIC_TO_LATIN:
            res += ARABIC_TO_LATIN[char]
        elif re.match(r'[a-zA-Z0-9._-]', char):
            res += char.lower()
    res = re.sub(r'\.+', '.', res).strip('.')
    return res or 'student'


def generate_unique_username(db_name, base_candidate):
    candidate = base_candidate.lower().strip()
    candidate = re.sub(r'[^a-zA-Z0-9_.-]', '', candidate)
    if not candidate:
        candidate = 'student'
    
    unique_name = candidate
    counter = 1
    while User.objects.using(db_name).filter(username=unique_name).exists():
        unique_name = f"{candidate}_{counter}"
        counter += 1
    return unique_name


def create_or_update_student_user(db_name, student, password=None, raw_username=None):
    """
    إنشاء حساب User و UserProfile تلقائياً للطالب إذا لم يكن لديه حساب.
    - دور المستخدم يكون STUDENT تلقائياً
    - الربط المباشر OneToOneField بين Student و User
    - ربط UserProfile بـ StudentEnrollment
    - إرجاع (user, profile, generated_password, is_new)
    """
    # إذا كان الطالب مربوطاً بمستخدم بالفعل
    if student.user:
        user = student.user
        try:
            profile = UserProfile.objects.using(db_name).get(user=user)
            roles = profile.get_roles()
            if 'STUDENT' not in roles:
                roles.append('STUDENT')
                profile.set_roles(roles)
                profile.save(using=db_name)
        except UserProfile.DoesNotExist:
            profile = UserProfile.objects.using(db_name).create(
                user=user,
                role='STUDENT',
                roles=['STUDENT'],
                center=student.halaqa.center if (student.halaqa and student.halaqa.center) else None,
                father_name=student.father_name,
                father_phone=student.father_phone,
                mother_name=student.mother_name,
                mother_phone=student.mother_phone,
                reached_page=student.reached_page or 1,
                is_active=True
            )
        return user, profile, None, False

    # تحديد اسم المستخدم
    if raw_username and raw_username.strip():
        username = generate_unique_username(db_name, raw_username)
    elif student.national_id and student.national_id.strip():
        username = generate_unique_username(db_name, student.national_id.strip())
    elif student.registration_number and student.registration_number.strip():
        username = generate_unique_username(db_name, student.registration_number.strip())
    else:
        latin_name = transliterate_arabic(student.full_name)
        username = generate_unique_username(db_name, latin_name)

    # تحديد كلمة المرور
    if password and password.strip():
        final_password = password.strip()
    elif student.national_id and student.national_id.strip():
        final_password = student.national_id.strip()
    elif student.registration_number and student.registration_number.strip():
        final_password = f"std@{student.registration_number.strip().lower()}"
    else:
        final_password = "student123"

    # تجزئة الاسم
    names = student.full_name.strip().split(maxsplit=1)
    first_name = names[0] if len(names) > 0 else "طالب"
    last_name = names[1] if len(names) > 1 else ""

    # إنشاء حساب User
    user = User.objects.using(db_name).create(
        username=username,
        password=make_password(final_password),
        first_name=first_name,
        last_name=last_name,
        is_active=True
    )

    # إنشاء الملف الشخصي UserProfile
    center = student.halaqa.center if (student.halaqa and student.halaqa.center) else None
    profile = UserProfile.objects.using(db_name).create(
        user=user,
        role='STUDENT',
        roles=['STUDENT'],
        center=center,
        father_name=student.father_name,
        father_phone=student.father_phone,
        mother_name=student.mother_name,
        mother_phone=student.mother_phone,
        health_status=student.special_needs_notes if student.has_special_needs else None,
        orphan_status='t' if student.is_orphan else None,
        reached_page=student.reached_page or 1,
        is_active=True
    )

    # ربط الطالب بالمستخدم
    student.user = user
    student.save(using=db_name, update_fields=['user'])

    # ربط أي تسجيلات سابقة بملف المستخدم
    StudentEnrollment.objects.using(db_name).filter(
        student=student, 
        user_profile__isnull=True
    ).update(user_profile=profile)

    return user, profile, final_password, True

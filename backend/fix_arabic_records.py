# -*- coding: utf-8 -*-
import os
import sys
import django

sys.stdout.reconfigure(encoding='utf-8')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from core_system.tenants.models import Tenant

tenant = Tenant.objects.filter(is_active=True).first()
db_name = tenant.db_name

if db_name not in settings.DATABASES:
    master_db = settings.DATABASES['default']
    new_db_config = master_db.copy()
    new_db_config.update({
        'NAME': db_name,
        'USER': tenant.db_user or master_db.get('USER', 'manara_user'),
        'PASSWORD': tenant.db_password_hash or master_db.get('PASSWORD', 'M@nara_2026_Str0ng!'),
        'HOST': tenant.db_host or 'localhost',
        'PORT': tenant.db_port or 5432,
    })
    settings.DATABASES[db_name] = new_db_config

from tenant_modules.centers_and_projects.models import Center, Project
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student, StudentRegistrationRequest
from tenant_modules.users.models import UserProfile
from django.contrib.auth import get_user_model

User = get_user_model()

# Centers
centers = [
    ("MAIN_CENTER", "المركز الرئيسي"),
    ("FURQAN_CENTER", "مركز الفرقان"),
    ("NOOR_CENTER", "مركز النور")
]
for code, name in centers:
    Center.objects.using(db_name).filter(code=code).update(name=name)

# Halaqat
halaqat_data = [
    ("حلقة عاصم بن أبي النجود", "أحمد الراشد"),
    ("حلقة الإمام نافع المدني", "عمر الحصري"),
    ("حلقة أبي عمرو البصري", "سعد المنشاوي"),
    ("حلقة ابن كثير المكي", "ياسر العبدلي"),
    ("حلقة حمزة الكوفي", "عبدالله الغامدي"),
    ("حلقة الإمام الكسائي", "عمر الحصري"),
]
h_objs = list(Halaqa.objects.using(db_name).all())
for i, h in enumerate(h_objs):
    name, tname = halaqat_data[i % len(halaqat_data)]
    h.name = name
    h.teacher_name = tname
    h.save(using=db_name)

# Requests
req_names = [
    "عبدالرحمن محمد العتيبي",
    "خالد بن وليد الميمان",
    "عمر سليمان الفوزان",
    "إبراهيم ناصر القحطاني"
]
req_objs = list(StudentRegistrationRequest.objects.using(db_name).all())
for i, r in enumerate(req_objs):
    r.full_name = req_names[i % len(req_names)]
    r.save(using=db_name)

# Students
male_names = [
    "عبدالرحمن العتيبي", "خالد الميمان", "عمر الفوزان", "سعود الشمري",
    "فيصل الدوسري", "سلطان القحطاني", "تركي المطيري", "إبراهيم السبيعي",
    "عبدالعزيز الحربي", "محمد الشهري", "ياسر القرني", "عبدالله الغامدي"
]
female_names = [
    "سارة أحمد العمري", "نورة سليمان الفهد", "فاطمة عادل السالم", "مريم خالد الحربي",
    "ريما سعود الدوسري", "ليان محمد القحطاني", "هند عبدالله الشمري", "شهد فيصل العتيبي"
]

m_students = list(Student.objects.using(db_name).filter(gender='M'))
for i, s in enumerate(m_students):
    s.full_name = male_names[i % len(male_names)]
    s.save(using=db_name)

f_students = list(Student.objects.using(db_name).filter(gender='F'))
for i, s in enumerate(f_students):
    s.full_name = female_names[i % len(female_names)]
    s.save(using=db_name)

print("All Arabic records updated cleanly in DB!")

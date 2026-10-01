import os
import sys
import django
import uuid
from datetime import datetime, timedelta, date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password

from core_system.tenants.models import Tenant
from tenant_modules.centers_and_projects.models import (
    Center, Project, EvaluationTemplate, EvaluationGrade
)
from tenant_modules.users.models import UserProfile
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import (
    Parent, Student, StudentEnrollment, StudentRegistrationRequest
)
from tenant_modules.attendance.models import HalaqaSession, AttendanceLog
from tenant_modules.recitation_and_sabr.models import RecitationLog

User = get_user_model()

def seed():
    tenant = Tenant.objects.filter(is_active=True).first()
    if not tenant:
        print("No active tenant found!")
        return

    db_name = tenant.db_name
    print(f"Seeding database '{db_name}' for tenant '{tenant.name}' ({tenant.subdomain})...")

    # Ensure DB config exists
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

    # 1. Centers
    centers_data = [
        {"name": "المركز الرئيسي", "code": "MAIN_CENTER", "address": "الرياض - حي الملز"},
        {"name": "مركز الفرقان", "code": "FURQAN_CENTER", "address": "الرياض - حي الروضة"},
        {"name": "مركز النور", "code": "NOOR_CENTER", "address": "الرياض - حي الصحافة"},
    ]
    centers = []
    for c_data in centers_data:
        center, _ = Center.objects.using(db_name).get_or_create(
            code=c_data["code"],
            defaults={"name": c_data["name"], "address": c_data["address"], "is_active": True}
        )
        if center.name != c_data["name"]:
            center.name = c_data["name"]
            center.save(using=db_name)
        centers.append(center)
    print(f"Centers created/verified: {len(centers)}")

    # 2. Evaluation Template & Grades
    eval_template, _ = EvaluationTemplate.objects.using(db_name).get_or_create(
        title="التقييم المعياري للحفظ",
        defaults={"description": "سلم التقييم المعتمد للتسميع والمراجعة"}
    )
    grades_info = [
        ("ممتاز", 1, "#558b2f", False),
        ("جيد جداً", 2, "#8bc34a", False),
        ("جيد", 3, "#fbc02d", False),
        ("يحتاج إعادة", 4, "#e53935", True),
    ]
    grades = []
    for g_name, order, color, rep in grades_info:
        grade, _ = EvaluationGrade.objects.using(db_name).get_or_create(
            template=eval_template,
            name=g_name,
            defaults={"order": order, "color_code": color, "requires_repeat": rep}
        )
        grades.append(grade)

    # 3. Project
    project, _ = Project.objects.using(db_name).get_or_create(
        title="مشروع تحفيظ القرآن الكريم",
        defaults={
            "description": "برنامج شامل للحفظ والمراجعة لجميع الفئات",
            "project_type": "QURAN",
            "is_active": True,
            "evaluation_template": eval_template
        }
    )
    project.centers.set(centers)

    # 4. Users & UserProfiles (Admin + Teachers)
    # Admin
    admin_user, _ = User.objects.using(db_name).get_or_create(
        username="manager",
        defaults={
            "first_name": "محمد",
            "last_name": "العمري",
            "email": "manager@manara.org",
            "password": make_password("admin123"),
            "is_staff": True
        }
    )
    admin_profile, _ = UserProfile.objects.using(db_name).get_or_create(
        user=admin_user,
        defaults={"role": "TENANT_ADMIN", "center": centers[0], "is_active": True}
    )

    teachers_info = [
        ("ahmed_rashed", "أحمد", "الراشد", centers[0]),
        ("omar_hosary", "عمر", "الحصري", centers[0]),
        ("saad_minshawi", "سعد", "المنشاوي", centers[1]),
        ("yaser_abdali", "ياسر", "العبدلي", centers[1]),
        ("abdullah_ghamdi", "عبدالله", "الغامدي", centers[2]),
    ]
    teachers = []
    for uname, fname, lname, cntr in teachers_info:
        user, _ = User.objects.using(db_name).get_or_create(
            username=uname,
            defaults={
                "first_name": fname,
                "last_name": lname,
                "email": f"{uname}@manara.org",
                "password": make_password("teacher123")
            }
        )
        prof, _ = UserProfile.objects.using(db_name).get_or_create(
            user=user,
            defaults={"role": "TEACHER", "center": cntr, "is_active": True}
        )
        teachers.append((user, prof, f"{fname} {lname}"))
    print(f"Teachers created: {len(teachers)}")

    # 5. Halaqat
    halaqat_info = [
        ("حلقة عاصم بن أبي النجود", teachers[0][2], centers[0]),
        ("حلقة الإمام نافع المدني", teachers[1][2], centers[0]),
        ("حلقة أبي عمرو البصري", teachers[2][2], centers[1]),
        ("حلقة ابن كثير المكي", teachers[3][2], centers[1]),
        ("حلقة حمزة الكوفي", teachers[4][2], centers[2]),
        ("حلقة الإمام الكسائي", teachers[1][2], centers[2]),
    ]
    halaqat = []
    for hname, tname, cntr in halaqat_info:
        h, _ = Halaqa.objects.using(db_name).get_or_create(
            name=hname,
            defaults={"teacher_name": tname, "center": cntr, "project": project, "is_active": True}
        )
        if h.teacher_name != tname or h.center != cntr:
            h.teacher_name = tname
            h.center = cntr
            h.save(using=db_name)
        halaqat.append(h)
    print(f"Halaqat created: {len(halaqat)}")

    # 6. Students (Male & Female)
    male_names = [
        "عبدالرحمن العتيبي", "خالد الميمان", "عمر الفوزان", "سعود الشمري",
        "فيصل الدوسري", "سلطان القحطاني", "تركي المطيري", "إبراهيم السبيعي",
        "عبدالعزيز الحربي", "محمد الشهري", "ياسر القرني", "عبدالله الغامدي",
        "سليمان البليهي", "أنس السالم", "بدر الخالدي", "صالح الزهراني",
        "فهد العسيري", "ماجد التميمي"
    ]
    female_names = [
        "سارة أحمد العمري", "نورة سليمان الفهد", "فاطمة عادل السالم", "مريم خالد الحربي",
        "ريما سعود الدوسري", "ليان محمد القحطاني", "هند عبدالله الشمري", "شهد فيصل العتيبي",
        "دانة عبدالعزيز المطيري", "أسماء بدر الخالدي", "جود سلطان القرني", "أروى صالح الشهري"
    ]

    all_students = []
    parent_obj, _ = Parent.objects.using(db_name).get_or_create(
        full_name="ولي أمر افتراضي",
        defaults={"phone": "0501234567"}
    )

    for i, name in enumerate(male_names):
        h = halaqat[i % len(halaqat)]
        std, _ = Student.objects.using(db_name).get_or_create(
            full_name=name,
            defaults={
                "gender": "M",
                "parent": parent_obj,
                "halaqa": h,
                "registration_number": f"M-{100 + i}",
                "birth_date": date(2012, 1 + (i % 12), 15),
                "reached_page": 20 + i * 5
            }
        )
        if std.gender != "M":
            std.gender = "M"
            std.save(using=db_name)
        all_students.append(std)
        StudentEnrollment.objects.using(db_name).get_or_create(
            student=std,
            halaqa=h,
            defaults={"project": project, "is_active": True, "reached_page": std.reached_page}
        )

    for i, name in enumerate(female_names):
        h = halaqat[(i + 2) % len(halaqat)]
        std, _ = Student.objects.using(db_name).get_or_create(
            full_name=name,
            defaults={
                "gender": "F",
                "parent": parent_obj,
                "halaqa": h,
                "registration_number": f"F-{200 + i}",
                "birth_date": date(2013, 1 + (i % 12), 10),
                "reached_page": 15 + i * 4
            }
        )
        if std.gender != "F":
            std.gender = "F"
            std.save(using=db_name)
        all_students.append(std)
        StudentEnrollment.objects.using(db_name).get_or_create(
            student=std,
            halaqa=h,
            defaults={"project": project, "is_active": True, "reached_page": std.reached_page}
        )
    print(f"Students & Enrollments: {len(all_students)} (Male: {len(male_names)}, Female: {len(female_names)})")

    # 7. Halaqa Sessions & Attendance Logs & Recitation Logs
    now = datetime.now()
    # Create sessions over the last 5 months
    months_offsets = [120, 90, 60, 30, 0] # ~ 4 months ago down to this month
    for offset_days in months_offsets:
        ref_date = (now - timedelta(days=offset_days)).date()
        for h_idx, h in enumerate(halaqat):
            # create 2-3 sessions per month per halaqa
            for s_day in [2, 10, 20]:
                session_dt = ref_date.replace(day=min(s_day, 28))
                session, _ = HalaqaSession.objects.using(db_name).get_or_create(
                    halaqa_id=h.id,
                    session_date=session_dt,
                    defaults={
                        "notes": f"جلسة {h.name} بتاريخ {session_dt}",
                        "is_active": True
                    }
                )
                # create attendance for 4 students
                enrolled = StudentEnrollment.objects.using(db_name).filter(halaqa=h, is_active=True)[:4]
                for enr in enrolled:
                    att, _ = AttendanceLog.objects.using(db_name).get_or_create(
                        session=session,
                        student_id=enr.student.id,
                        defaults={
                            "halaqa_id": h.id,
                            "session_date": session_dt,
                            "status": "PRESENT" if s_day != 10 else "ABSENT",
                            "behavior_score": 10
                        }
                    )
                    if att.status == "PRESENT":
                        RecitationLog.objects.using(db_name).get_or_create(
                            attendance=att,
                            student_id=enr.student.id,
                            defaults={
                                "recitation_type": "NEW_MEMORIZATION",
                                "page_number": enr.reached_page,
                                "grade": "ممتاز" if offset_days < 60 else "جيد جداً",
                                "evaluation_grade": grades[0] if offset_days < 60 else grades[1],
                                "behavior_score": 10
                            }
                        )

    print("Sessions, AttendanceLogs and RecitationLogs created.")

    # 8. Pending Registration Requests
    requests_data = [
        {"name": "عبدالرحمن محمد العتيبي", "halaqa": halaqat[0]},
        {"name": "خالد بن وليد الميمان", "halaqa": halaqat[1]},
        {"name": "عمر سليمان الفوزان", "halaqa": halaqat[2]},
        {"name": "إبراهيم ناصر القحطاني", "halaqa": halaqat[3]}
    ]
    for rdata in requests_data:
        StudentRegistrationRequest.objects.using(db_name).get_or_create(
            full_name=rdata["name"],
            defaults={
                "halaqa": rdata["halaqa"],
                "project": project,
                "status": "PENDING"
            }
        )
    print("Pending registration requests created.")
    print("Seeding finished successfully!")

if __name__ == '__main__':
    seed()

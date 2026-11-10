# -*- coding: utf-8 -*-
"""
كتالوج أوامر وكيل منارة: كل نية (intent) مرتبطة بإجراء تنفيذي مباشر (مسار واجهة أو API)
المصدر: App.jsx + urls.py + نماذج attendance/recitation.
الهدف: تصنيف الأمر + استخراج المتغيرات (slots) في خطوة واحدة بلا حوار طويل => أقل زمن ممكن.
"""

# أدوار المنصة (users/models.py)
ROLES = ["TENANT_ADMIN", "CENTER_MANAGER", "TEACHER", "STUDENT"]
ROLE_PREFIX = {"TENANT_ADMIN": "/admin", "CENTER_MANAGER": "/center-manager",
               "TEACHER": "/teacher", "STUDENT": "/student"}

# ---------- صفحات التنقل: (مفتاح الصفحة, الأدوار المسموحة, أسماء/مرادفات) ----------
PAGES = {
    "dashboard": (ROLES, ["الرئيسية", "لوحة التحكم", "الصفحة الرئيسية", "الداشبورد", "لوحة القيادة"]),
    "users": (["TENANT_ADMIN"], ["المستخدمين", "المستخدمون", "إدارة المستخدمين", "الحسابات"]),
    "projects": (["TENANT_ADMIN"], ["المشاريع", "مشاريع المركز", "إدارة المشاريع"]),
    "students": (["TENANT_ADMIN", "CENTER_MANAGER", "TEACHER"], ["الطلاب", "قائمة الطلاب", "إدارة الطلاب", "الدارسين"]),
    "teachers": (["TENANT_ADMIN", "CENTER_MANAGER"], ["المعلمين", "المعلمون", "تعيين المعلمين", "المدرسين", "الأساتذة"]),
    "rings": (["TENANT_ADMIN", "CENTER_MANAGER", "TEACHER"], ["الحلقات", "حلقاتي", "إدارة الحلقات", "الحلقات القرآنية"]),
    "centers": (["TENANT_ADMIN"], ["المراكز", "إدارة المراكز", "مراكز التحفيظ"]),
    "sessions": (["TENANT_ADMIN", "CENTER_MANAGER", "TEACHER"], ["الجلسات", "جلسات التحفيظ", "سجل الجلسات"]),
    "rewards": (["TENANT_ADMIN", "CENTER_MANAGER"], ["النقاط والمكافآت", "المكافآت", "متجر النقاط", "الجوائز"]),
    "reports": (["TENANT_ADMIN", "CENTER_MANAGER"], ["التقارير", "الإحصائيات", "تقارير المركز"]),
    "settings": (["TENANT_ADMIN"], ["الإعدادات", "إعدادات المسجد", "الضبط"]),
    "profile": (ROLES, ["الملف الشخصي", "حسابي", "بياناتي", "صفحتي الشخصية"]),
    "attendance": (["TEACHER"], ["الحضور", "تسجيل الحضور", "التحضير", "شاشة الحضور"]),
    "recitation": (["TEACHER"], ["التسميع", "تقييم التسميع", "شاشة التسميع", "التلاوة"]),
    "progress": (["TEACHER"], ["تقدم الطلاب", "متابعة التقدم", "مسار الحفظ"]),
    "competitions": (["STUDENT"], ["المسابقات", "مسابقاتي", "الاختبارات والمسابقات"]),
    "report": (["STUDENT"], ["تقريري", "بطاقة التقرير", "شهادتي", "كشف الدرجات"]),
    "notifications": (["STUDENT"], ["الإشعارات", "التنبيهات", "إشعاراتي"]),
}

NAV_VERBS = ["افتح", "روح إلى", "خذني إلى", "اذهب إلى", "وديني على", "أبي أشوف", "ورجيني", "عرض", "ابغى", "بدي افتح", "انتقل إلى", "افتحلي"]

# ---------- أسماء/قيم للمتغيرات ----------
FIRST_NAMES = ["أحمد", "محمد", "عمر", "يوسف", "خالد", "عبدالله", "إبراهيم", "علي", "حسن", "سعد",
               "فاطمة", "عائشة", "مريم", "خديجة", "زينب", "سارة", "نور", "ليلى", "هدى", "أنس",
               "بلال", "حمزة", "مصعب", "زيد", "طارق", "ياسر", "ماجد", "رامي", "سلمان", "هشام"]
LAST_NAMES = ["الحلبي", "العمر", "الشامي", "الخطيب", "النجار", "المصري", "الأحمد", "الدمشقي",
              "القاسم", "الحسن", "العلي", "البكري", "الصالح", "الحمصي", "الإدلبي", ""]
HALAQA_NAMES = ["حلقة الفاروق", "حلقة الصديق", "حلقة النور", "حلقة الفرقان", "حلقة البراعم",
                "حلقة التميز", "حلقة الإتقان", "حلقة الهدى", "حلقة الرحمن", "حلقة الفجر"]

# تقييمات التسميع (افتراضية من الكود: "مقبول"، وفيها "إعادة")
GRADES = {"ممتاز": ["ممتاز", "امتياز", "ممتازة"],
          "جيد جداً": ["جيد جدا", "جيد جداً", "جيدجدا"],
          "جيد": ["جيد", "زين"],
          "مقبول": ["مقبول", "وسط"],
          "إعادة": ["إعادة", "اعادة", "يعيد", "يعيدها", "لازم يعيد", "تعاد"]}

RECITATION_TYPES = {"NEW_MEMORIZATION": ["حفظ جديد", "حفظ", "الحفظ الجديد"],
                    "MINOR_REVIEW": ["مراجعة صغرى", "مراجعة صغيرة", "المراجعة الصغرى"],
                    "MAJOR_REVIEW": ["مراجعة كبرى", "مراجعة كبيرة", "المراجعة الكبرى"]}

# حالات الحضور (attendance/models.py)
ATTENDANCE = {"PRESENT": ["حاضر", "موجود", "حضر", "جا", "وصل"],
              "ABSENT": ["غائب", "غايب", "غياب بدون عذر", "ما حضر", "لم يحضر"],
              "EXCUSED": ["غائب بعذر", "غياب بعذر", "معه عذر", "مستأذن", "غايب بعذر"],
              "LATE": ["متأخر", "تأخر", "متأخرة", "جا متأخر", "وصل متأخر"]}

BEHAVIOR = {"EXCELLENT": ["ممتاز"], "VERY_GOOD": ["جيد جداً"], "GOOD": ["جيد"],
            "ACCEPTABLE": ["مقبول"], "WEAK": ["ضعيف"],
            "LEFT_WITHOUT_EXCUSE": ["غادر الحلقة دون عذر", "طلع من الحلقة بدون إذن"]}

# أمثلة سور (رقم, اسم, عدد الآيات)
SURAHS = [(1, "الفاتحة", 7), (2, "البقرة", 286), (3, "آل عمران", 200), (4, "النساء", 176),
          (18, "الكهف", 110), (36, "يس", 83), (55, "الرحمن", 78), (67, "الملك", 30),
          (78, "النبأ", 40), (87, "الأعلى", 19), (96, "العلق", 19), (112, "الإخلاص", 4),
          (113, "الفلق", 5), (114, "الناس", 6)]

REWARD_ITEMS = ["حقيبة", "دفتر", "مصحف", "قلم", "ساعة", "هدية", "كتاب", "ميدالية"]

# ---------- النوايا غير الملاحية ----------
# intent: dict(roles, action{type, method, endpoint|route}, slots, confirm, templates)
# {student} {halaqa} {status} {grade} {page} {points} {n} {surah} {a_from} {a_to} {rtype} {reward} {item} {behavior} {date}
INTENTS = {
    "mark_attendance": dict(
        roles=["TEACHER", "TENANT_ADMIN", "CENTER_MANAGER"],
        action=dict(type="api", method="POST", endpoint="/api/attendance/"),
        slots=["student", "status", "halaqa?"], confirm=False,
        templates=["سجّل {student} {status}", "{student} {status}", "حضّر {student}", "خلي {student} {status}",
                   "علّم {student} {status} اليوم", "الطالب {student} {status}", "سجل حضور {student} {status} في {halaqa}",
                   "اعتبر {student} {status}", "ضع {student} {status}", "{student} {status} في {halaqa}"]),
    "mark_all_present": dict(
        roles=["TEACHER", "TENANT_ADMIN", "CENTER_MANAGER"],
        action=dict(type="ui", handler="attendance.markAllPresent"),
        slots=["halaqa?"], confirm=False,
        templates=["حضّر الكل", "سجل الكل حاضر", "كل الطلاب حاضرين", "الجميع حاضر", "حضّر كل الحلقة", "الكل موجود في {halaqa}"]),
    "start_session": dict(
        roles=["TEACHER", "TENANT_ADMIN", "CENTER_MANAGER"],
        action=dict(type="api", method="POST", endpoint="/api/attendance/sessions/start/"),
        slots=["halaqa?"], confirm=False,
        templates=["ابدأ الجلسة", "ابدأ جلسة {halaqa}", "افتح جلسة جديدة", "بدّي ابدأ حلقة اليوم", "شغّل جلسة اليوم", "ابدأ الحلقة"]),
    "evaluate_recitation": dict(
        roles=["TEACHER"],
        action=dict(type="api", method="POST", endpoint="/api/recitation/evaluate/"),
        slots=["student", "grade", "page?", "recitation_type?", "behavior?"], confirm=False,
        templates=["قيّم {student} {grade}", "{student} سمّع صفحة {page} {grade}", "سمّع {student} صفحة {page} تقييمه {grade}",
                   "قيم تسميع {student} بـ {grade}", "{student} {rtype} صفحة {page} {grade}", "تسميع {student} {grade}",
                   "سجل تسميع {student} {rtype} {grade}", "{student} حفظ صفحة {page} وتقييمه {grade}",
                   "اعطِ {student} {grade} في {rtype}", "{student} {grade}"]),
    "evaluate_recitation_range": dict(
        roles=["TEACHER"],
        action=dict(type="api", method="POST", endpoint="/api/recitation/evaluate/"),
        slots=["student", "grade", "surah", "ayah_from", "ayah_to"], confirm=False,
        templates=["{student} سمّع سورة {surah} من آية {a_from} إلى {a_to} {grade}",
                   "سجل لـ {student} {surah} من {a_from} إلى {a_to} تقييم {grade}",
                   "{student} حفظ من {surah} الآية {a_from} حتى {a_to} {grade}"]),
    "grant_bonus_points": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER", "TEACHER"],
        action=dict(type="api", method="POST", endpoint="/api/points-and-rewards/points/bonus/"),
        slots=["student", "points"], confirm=False,
        templates=["امنح {student} {points} نقطة", "أضف {points} نقاط لـ {student}", "{student} يستحق {points} نقطة",
                   "اعطِ {student} {points} نقطة مكافأة", "زيّد نقاط {student} {points}", "كافئ {student} بـ {points} نقاط"]),
    "show_points_transactions": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER"],
        action=dict(type="api", method="GET", endpoint="/api/points-and-rewards/points/transactions/"),
        slots=[], confirm=False,
        templates=["اعرض سجل النقاط", "حركات النقاط", "وين سجل النقاط", "آخر عمليات النقاط"]),
    "show_reward_claims": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER"],
        action=dict(type="api", method="GET", endpoint="/api/points-and-rewards/rewards/claims/"),
        slots=[], confirm=False,
        templates=["اعرض طلبات المكافآت", "طلبات استبدال الجوائز", "مين طلب مكافأة", "طلبات الاستبدال المعلقة"]),
    "redeem_reward": dict(
        roles=["STUDENT"],
        action=dict(type="api", method="POST", endpoint="/api/points-and-rewards/student-portal/claim-reward/"),
        slots=["reward"], confirm=True,
        templates=["أريد استبدال {item}", "اطلب {item} من المتجر", "بدّي {item} بنقاطي", "استبدل نقاطي بـ {item}"]),
    "show_my_points": dict(
        roles=["STUDENT"],
        action=dict(type="api", method="GET", endpoint="/api/points-and-rewards/student-portal/dashboard/"),
        slots=[], confirm=False,
        templates=["كم نقاطي", "كم عندي نقطة", "رصيدي من النقاط", "شو نقاطي", "اعرض نقاطي"]),
    "mark_notifications_read": dict(
        roles=["STUDENT"],
        action=dict(type="api", method="POST", endpoint="/api/points-and-rewards/student-portal/notifications/mark-read/"),
        slots=[], confirm=False,
        templates=["علّم كل الإشعارات كمقروءة", "اقرأ كل الإشعارات", "امسح التنبيهات", "خلّص الإشعارات"]),
    "search_student": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER", "TEACHER"],
        action=dict(type="ui", handler="students.search"),
        slots=["student"], confirm=False,
        templates=["ابحث عن {student}", "دوّر على الطالب {student}", "وين {student}", "لاقيلي {student}", "اعرض بيانات {student}", "شوفلي {student}"]),
    "open_student_activity": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER", "TEACHER"],
        action=dict(type="navigate", route="{prefix}/students/{studentId}/activity"),
        slots=["student"], confirm=False,
        templates=["افتح نشاط {student}", "اعرض نشاط الطالب {student}", "تقرير {student}", "ورجيني تقدم {student}", "سجل {student} الكامل"]),
    "open_halaqa_sessions": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER", "TEACHER"],
        action=dict(type="navigate", route="{prefix}/rings/{ringId}/sessions"),
        slots=["halaqa"], confirm=False,
        templates=["افتح جلسات {halaqa}", "اعرض جلسات {halaqa}", "سجل جلسات {halaqa}"]),
    "add_student": dict(
        roles=["TEACHER", "TENANT_ADMIN", "CENTER_MANAGER"],
        action=dict(type="ui", handler="students.openAddWizard"),
        slots=["student?", "halaqa?"], confirm=False,
        templates=["أضف طالب جديد", "سجّل طالب اسمه {student}", "طالب جديد {student}", "أضف {student} إلى {halaqa}", "افتح نموذج إضافة طالب"]),
    "delete_student_request": dict(
        roles=["TEACHER", "TENANT_ADMIN", "CENTER_MANAGER"],
        action=dict(type="api", method="POST", endpoint="/api/students-and-parents/students/deletion-requests/"),
        slots=["student"], confirm=True,
        templates=["احذف الطالب {student}", "اطلب حذف {student}", "شيل {student} من النظام", "أريد حذف {student}"]),
    "approve_requests": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER"],
        action=dict(type="api", method="POST", endpoint="/api/students-and-parents/students/requests/bulk-approve/"),
        slots=[], confirm=True,
        templates=["وافق على كل الطلبات", "اعتمد طلبات الطلاب", "اقبل جميع الطلبات المعلقة", "وافق على الطلبات"]),
    "show_requests": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER", "TEACHER"],
        action=dict(type="ui", handler="requests.openPanel"),
        slots=[], confirm=False,
        templates=["اعرض الطلبات المعلقة", "في طلبات جديدة؟", "طلباتي", "شوف الطلبات"]),
    "generate_certificate": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER", "TEACHER"],
        action=dict(type="api", method="POST", endpoint="/api/reports/certificates/"),
        slots=["student"], confirm=False,
        templates=["اطبع شهادة {student}", "أصدر شهادة للطالب {student}", "شهادة {student}", "سوّي شهادة تقدير لـ {student}"]),
    "show_analytics": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER"],
        action=dict(type="api", method="GET", endpoint="/api/reports/analytics/"),
        slots=[], confirm=False,
        templates=["اعرض إحصائيات اليوم", "كم نسبة الحضور", "ملخص الأداء", "شو وضع المركز", "اعطني تحليلات المركز"]),
    "create_competition": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER"],
        action=dict(type="ui", handler="competitions.openCreate"),
        slots=[], confirm=False,
        templates=["أنشئ مسابقة جديدة", "سوّي مسابقة", "أضف مسابقة", "ابدأ مسابقة للطلاب"]),
    "start_competition": dict(
        roles=["STUDENT"],
        action=dict(type="api", method="POST", endpoint="/api/student/competitions/{id}/start/"),
        slots=[], confirm=False,
        templates=["ابدأ المسابقة", "بدّي أبدأ الاختبار", "شغّل المسابقة المتاحة", "خلّيني أدخل المسابقة"]),
    "switch_role": dict(
        roles=ROLES,
        action=dict(type="api", method="POST", endpoint="/api/users/switch-role/"),
        slots=["role"], confirm=False,
        templates=["بدّل الدور إلى {role_ar}", "ادخل كـ {role_ar}", "غيّر صفتي إلى {role_ar}", "حوّلني لحساب {role_ar}"]),
    "change_password": dict(
        roles=ROLES,
        action=dict(type="ui", handler="auth.openChangePassword"),
        slots=[], confirm=False,
        templates=["غيّر كلمة المرور", "أريد تغيير كلمة السر", "افتح تغيير الباسوورد", "نسيت كلمة المرور وأريد تغييرها"]),
    "logout": dict(
        roles=ROLES,
        action=dict(type="ui", handler="auth.logout"),
        slots=[], confirm=True,
        templates=["سجّل خروج", "اخرج", "تسجيل الخروج", "طلعني من الحساب", "خلصنا اخرج"]),
    "open_ai_assistant": dict(
        roles=["TENANT_ADMIN"],
        action=dict(type="ui", handler="ai.openAssistant"),
        slots=[], confirm=False,
        templates=["افتح مساعد منارة", "مساعد منارة الذكي", "افتح المساعد"]),
    "student_memorization_prediction": dict(
        roles=["TENANT_ADMIN", "CENTER_MANAGER", "TEACHER"],
        action=dict(type="api", method="GET", endpoint="/api/ai/memorization-prediction/{studentId}/"),
        slots=["student"], confirm=False,
        templates=["توقع نسيان {student}", "متى يحتاج {student} مراجعة", "اقتراح مراجعة لـ {student}", "حلل حفظ {student}"]),
}

# أوامر خارج النطاق / غامضة (تُدرَّب على رفضها بأدب أو طلب توضيح)
OUT_OF_SCOPE = ["كم الساعة", "حدثني عن الطقس", "اكتب لي قصيدة", "من هو رئيس أمريكا", "شغّل أغنية", "كيف أطبخ الرز",
                "ما سعر الدولار", "احجز لي تذكرة طيران", "ترجم هذه الجملة", "احكي لي نكتة", "قول مرحبا", "اشرح الفيزياء"]
AMBIGUOUS = [("سجّل", "ماذا تريد أن أسجّل؟ حضوراً أم تسميعاً؟"),
             ("افتح", "أي صفحة تريد فتحها؟"),
             ("قيّم", "من هو الطالب وما التقييم؟"),
             ("احذف", "ما الذي تريد حذفه؟ حدّد الطالب."),
             ("ابحث", "عن ماذا تريد البحث؟"),
             ("أضف نقاط", "لأي طالب وكم نقطة؟")]

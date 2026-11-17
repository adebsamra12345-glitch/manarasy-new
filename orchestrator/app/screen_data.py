"""بيانات شاشات المنصة لكل دور (مصدر الحقيقة الوحيد؛ بلا اعتماديات لتجنب الاستيراد الدائري).
مستخلصة من frontend/src/App.jsx والأشرطة الجانبية. عدّلها عند إضافة/حذف تبويب."""
from dataclasses import dataclass, field

ROLE_PREFIX = {
    "TENANT_ADMIN": "/admin",
    "CENTER_MANAGER": "/center-manager",
    "TEACHER": "/teacher",
}


@dataclass(frozen=True)
class Screen:
    id: str
    label: str
    path: str  # بلا بادئة الدور
    roles: frozenset
    synonyms: tuple = field(default_factory=tuple)


_T, _C, _A = "TEACHER", "CENTER_MANAGER", "TENANT_ADMIN"
_ALL = frozenset({_T, _C, _A})
_MGR = frozenset({_C, _A})

SCREENS: tuple[Screen, ...] = (
    Screen("dashboard", "لوحة التحكم", "dashboard", _ALL,
           ("لوحة التحكم", "لوحه التحكم", "الرئيسية", "الصفحة الرئيسية", "الداشبورد", "الرئيسيه")),
    Screen("rings", "الحلقات", "rings", _ALL, ("الحلقات", "حلقاتي", "قائمة الحلقات")),
    Screen("students", "الطلاب", "students", _ALL, ("الطلاب", "طلابي", "قائمة الطلاب")),
    Screen("sessions", "الجلسات", "sessions", _ALL, ("الجلسات", "جلسات")),
    Screen("profile", "الملف الشخصي", "profile", _ALL, ("الملف الشخصي", "ملفي الشخصي", "ملفي", "حسابي", "بروفايل")),
    Screen("attendance", "الحضور", "attendance", frozenset({_T}), ("الحضور", "تحضير", "الحضور اليومي")),
    Screen("recitation", "التسميع", "recitation", frozenset({_T}), ("التسميع", "تقييم التسميع")),
    Screen("progress", "متابعة التقدم", "progress", frozenset({_T}), ("متابعة التقدم", "التقدم")),
    Screen("teachers", "المعلمون", "teachers", _MGR, ("المعلمين", "المعلمون", "معلمين", "تعيين المعلمين")),
    Screen("rewards", "النقاط والمكافآت", "rewards", _MGR, ("النقاط", "المكافآت", "المكافات", "نقاط")),
    Screen("reports", "التقارير", "reports", _MGR, ("التقارير", "تقارير")),
    Screen("users", "المستخدمون", "users", frozenset({_A}), ("المستخدمين", "المستخدمون", "ادارة المستخدمين")),
    Screen("projects", "المراكز والمشاريع", "projects", frozenset({_A}), ("المشاريع", "المشروعات")),
    Screen("centers", "المراكز", "centers", frozenset({_A}), ("المراكز",)),
    Screen("settings", "الإعدادات", "settings", frozenset({_A}), ("الاعدادات", "الإعدادات", "اعدادات")),
)


def screens_for(role: str) -> list[Screen]:
    return [s for s in SCREENS if role in s.roles]


def route_for(role: str, screen: Screen) -> str:
    return f"{ROLE_PREFIX[role]}/{screen.path}"


SCREEN_BY_ID = {s.id: s for s in SCREENS}

# إجراءات «افتراضية» تتجاوز تبويباً واحداً (تحتاج معاملاً أو تأكيداً أو نافذة)
VIRTUAL_SCREEN_IDS = ("halaqa_sessions", "start_session", "student_profile", "change_password", "logout")
ALL_SCREEN_IDS = [s.id for s in SCREENS] + list(VIRTUAL_SCREEN_IDS)


def screen_ids_for_role(role: str) -> list[str]:
    """معرّفات التبويبات المتاحة لدور حقيقي (TEACHER/CENTER_MANAGER/TENANT_ADMIN) + الإجراءات الافتراضية."""
    if role not in ROLE_PREFIX:
        return list(ALL_SCREEN_IDS)
    return [s.id for s in screens_for(role)] + list(VIRTUAL_SCREEN_IDS)

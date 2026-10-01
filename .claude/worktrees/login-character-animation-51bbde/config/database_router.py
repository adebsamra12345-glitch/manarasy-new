class TenantRouter:
    """
    موجه قواعد البيانات لمنع ترحيل تطبيقات المساجد إلى القاعدة المركزية
    """
    # قائمة بأسماء تطبيقات قالب المسجد
    tenant_apps = [
        'users',
        'centers_and_projects',
        'halaqat',
        'students_and_parents',
        'attendance',
        'recitation_and_sabr',
        'reports_and_certificates'
    ]

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        # إذا كانت الوجهة هي القاعدة المركزية manara_db (والتي تسمى default في Django)
        if db == 'default':
            # منع ترحيل تطبيقات المسجد إليها
            if app_label in self.tenant_apps:
                return False
            # السماح بترحيل تطبيقات النظام المركزي
            return True
        return None
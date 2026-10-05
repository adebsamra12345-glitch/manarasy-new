# Celery اختياري: يُستخدم فقط عند تفعيل PROVISIONING_ASYNC (انظر settings.py)
try:
    from .celery import app as celery_app
    __all__ = ('celery_app',)
except ImportError:      # celery غير مثبّت
    pass

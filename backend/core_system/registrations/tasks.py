"""
مهمة Celery اختيارية لتجهيز قاعدة المسجد في الخلفية (PROVISIONING_ASYNC=true).
عند عدم توفر Celery يعمل التجهيز متزامناً (انظر services.dispatch_provisioning).
"""
from celery import shared_task

from .services import run_provisioning


@shared_task(name='registrations.provision_registration', bind=True, max_retries=0, acks_late=True)
def provision_registration_task(self, request_id: str):
    run_provisioning(request_id)

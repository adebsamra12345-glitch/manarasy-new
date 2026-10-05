import getpass

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.password_validation import validate_password

from platform_auth.models import PlatformAdmin


class Command(BaseCommand):
    help = 'ينشئ أدمن منصة (Platform Super Admin) في القاعدة المركزية'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True)
        parser.add_argument('--full-name', default='')
        parser.add_argument('--password', help='اتركه فارغاً ليُطلب بشكل تفاعلي (الأفضل أمنياً)')

    def handle(self, *args, **opts):
        email = opts['email'].strip().lower()
        if PlatformAdmin.objects.filter(email=email).exists():
            raise CommandError('هذا البريد مسجّل مسبقاً')
        password = opts['password'] or getpass.getpass('Password: ')
        if not opts['password'] and password != getpass.getpass('Password (again): '):
            raise CommandError('كلمتا المرور غير متطابقتين')
        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError('; '.join(exc.messages))
        if len(password) < 12:
            raise CommandError('كلمة مرور أدمن المنصة يجب ألا تقل عن 12 حرفاً')
        PlatformAdmin.objects.create_user(email=email, password=password, full_name=opts['full_name'])
        self.stdout.write(self.style.SUCCESS(f'تم إنشاء أدمن المنصة: {email}'))

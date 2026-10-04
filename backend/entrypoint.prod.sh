#!/bin/sh
set -e

echo "==> [Entrypoint] التحقق من جاهزية خادم PostgreSQL..."

# انتظار اتصال قاعدة البيانات بدون استخدام sleep أعمى
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; do
  echo "    قاعدة البيانات غير متاحة بعد، جاري الانتظار ثانية واحدة..."
  sleep 1
done

echo "==> [Entrypoint] قاعدة البيانات جاهزة للاتصال."

# تجميع الملفات الثابتة إلى المجلد المشترك مع Nginx
echo "==> [Entrypoint] جاري تنفيذ collectstatic..."
python manage.py collectstatic --noinput

# تنفيذ الترحيل لقاعدة البيانات المركزية
echo "==> [Entrypoint] جاري تطبيق الترحيلات على القاعدة المركزية..."
python manage.py migrate --noinput

echo "==> [Entrypoint] بدء تشغيل خادم التطبيق..."
exec "$@"

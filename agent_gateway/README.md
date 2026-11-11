# agent_gateway (المرحلة 1 - Mock)
تشغيل: `AGENT_JWT_SECRET=... .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8100`
اختبار: `.venv/bin/python -m pytest -q`
تراجع كامل: `rm -rf /root/manarasy/agent_gateway` (لا يلمس أي ملف آخر في المشروع، ولا commit).

## وضع Django الحقيقي
```
AGENT_BACKEND=django DJANGO_BASE_URL=http://<django>:8000 uvicorn app.main:app --port 8100
```
العميل يرسل `Authorization: Bearer <JWT المنصة>` و`Tenant-ID: <uuid>`؛ الـ Gateway يمررهما كما هما إلى Django،
ويحدد الدور من `/api/users/me/`. نطاق المعلم/المسجد تفرضه Django نفسها.

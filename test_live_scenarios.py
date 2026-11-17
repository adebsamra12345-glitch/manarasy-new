import urllib.request
import json
import base64
import wave
import io
import sys

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiOTQ5ZDhiNDQtZjEyMy00ZWFhLThiMmYtNjg2YjIyZTNhMzlkIiwidGVuYW50X2lkIjoiZDQ3MWM4MzMtZmRlMi00MjMyLWFkN2UtYThhMmJiNjBjM2YzIiwicm9sZSI6IlRFQUNIRVIiLCJleHAiOjE3OTQ5NDUwMjN9.CP117ZxZMl-W9l2Ksm3kXORSDyjddQKIPgyzyPHtQb8"
TENANT_ID = "d471c833-fde2-4232-ad7e-a8a2bb60c3f3"
BASE_URL = "http://manarasy-backend:8000"

def post_json(path, data):
    url = f"{BASE_URL}{path}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TOKEN}",
            "Tenant-ID": TENANT_ID,
            "X-Forwarded-Proto": "https",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw_error": raw}
    except Exception as e:
        return 500, {"exception": str(e)}

print("=== 1. أمر نصي (Text message) ===")
s1, r1 = post_json("/api/ai/agent/chat/", {"message": "السلام عليكم، ما هي الحلقات المتاحة لدي؟", "session_id": "test-live-1"})
print(f"Status: {s1}")
print("Response:", json.dumps(r1, ensure_ascii=False, indent=2))

print("\n=== 2. سؤال عن المنصة (KB Question) ===")
s2, r2 = post_json("/api/ai/agent/chat/", {"message": "كيف أسجل تقييم تسميع لطالب؟", "session_id": "test-live-1"})
print(f"Status: {s2}")
print("Response:", json.dumps(r2, ensure_ascii=False, indent=2))

print("\n=== 3. طالب خارج نطاقك (Cross-ring student) ===")
# الطالب "ربيع الزور" ليس في حلقة الأستاذ أنس عبارة
s3, r3 = post_json("/api/ai/agent/chat/", {"message": "أريد معرفة نقاط الطالب ربيع الزور", "session_id": "test-live-1"})
print(f"Status: {s3}")
print("Response:", json.dumps(r3, ensure_ascii=False, indent=2))

print("\n=== 4. أمر كتابة (Write command => confirm_required) ===")
s4, r4 = post_json("/api/ai/agent/chat/", {"message": "سجل غياب للطالب خالد غالي", "session_id": "test-live-1"})
print(f"Status: {s4}")
print("Response:", json.dumps(r4, ensure_ascii=False, indent=2))

print("\n=== 5. أمر صوتي (STT Audio Transcription) ===")
# إنشاء ملف صوتي WAV بسيط صالح
buf = io.BytesIO()
with wave.open(buf, 'wb') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(16000)
    # 0.5 ثانية من الصمت المضمّن
    wf.writeframes(b'\x00\x00' * 8000)
audio_b64 = base64.b64encode(buf.getvalue()).decode('ascii')

s5, r5 = post_json("/api/ai/audio-eval/", {"audio_base64": audio_b64, "filename": "test.wav"})
print(f"Status: {s5}")
print("Response:", json.dumps(r5, ensure_ascii=False, indent=2))

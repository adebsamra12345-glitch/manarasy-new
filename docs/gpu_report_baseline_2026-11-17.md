# خط الأساس الحي للمحوّلات (من خادم التطبيق عبر Tailscale، قراءة فقط)

التاريخ: 2026-11-17. نُفِّذ التقييم الذهبي (20 حالة) من `orchestrator/eval/evaluate_golden.py` بوضع `EVAL_LIVE_VLLM=1`
ضد vLLM على 100.119.62.40:8000 (النماذج المحمّلة: base, manarasy, manarasy_v2, manarasy_v1). لم يُنفَّذ تدريب ولا تعديل على الجهاز.

| النموذج | النتيجة | missing_param | rbac_security | tool_call |
|---|---|---|---|---|
| manarasy | 14/20 (70%) | 0/3 | 0/2 | 11/12 |
| manarasy_v2 | 17/20 (85%) | 2/3 | 2/2 | 10/12 |
| base | 14/20 (70%) | 0/3 | 0/2 | 11/12 |

- اسم `manarasy` يعطي نتائج مطابقة لـ base في كل الفئات؛ يجب التحقق على جهاز الـ GPU من المجلد الذي يُحمَّل تحت هذا الاسم (`LORA_MODULES` في `gpu-stack/.env`).
- docker-compose.yml للتطبيق يضبط `VLLM_MODEL_AGENT=manarasy`؛ إن تأكد أنه ليس v2 فالإنتاج يعمل بنتيجة أدنى بـ 15 نقطة.
- تقييم الواجهة (`evaluate_ui.py`) على `manarasy` بلا أداة open_screen: التنقل 9/20 (45%) من الموجّه الحتمي وحده، تحويل خاطئ 0، خرق صلاحيات 0.

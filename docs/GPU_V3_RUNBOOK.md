# دليل تدريب ونشر محوّل v4 على جهاز الـ GPU

> **تحديث 2026-11-17:** المحوّل `manarasy-qwen3-v3` موجود أصلاً على الجهاز (دُرِّب في 16 نوفمبر، ويُحمَّل حالياً تحت اسم `manarasy`) وتراجع في `missing_param`. لذلك سُمّي المحوّل الجديد **v4**.
> **سبب أساسي اكتُشف:** المحوّلات v1-v3 دُرِّبت على 8 أدوات، بينما كود المستودع يعرض 13 أداة (أضيفت `list_students` و`attendance_report` و`recitation_history` و`points_history`، ثم `open_screen`). عرض أدوات لم يُدرَّب عليها يخفض الدقة: v2 يسجل 20/20 مع الكود القديم و17/20 مع الكود الجديد. بيانات v4 تشمل الآن الأدوات الأربع. راجع `docs/gpu_report_baseline_2026-11-17.md`.


> هذه الخطوات تُنفَّذ على عقدة الـ GPU (adebserver). لم تُنفَّذ من بيئة التطوير: لا يوجد GPU هناك.
> كل ما قبل الخطوة 3 يمكن إعادة تشغيله على أي جهاز؛ الخطوات 3 إلى 7 تتطلب الكرت.

## ما الجديد في v4
- أداة `open_screen` للنموذج (تنقل ونوافذ وخروج) خلف المتغير `AGENT_UI_TOOL=1`. الموجّه الحتمي (`orchestrator/app/screens.py`) يعمل دائماً بدونها؛ الأداة تغطي الصيغ التي لا يلتقطها الموجّه.
- بيانات تدريب جديدة: فئة `ui_navigation` (291 مثالاً) في `gpu-stack/data/train_v4.jsonl` و`val_v4.jsonl` (1065 تدريب + 146 تحقق).
- تقييم جديد `orchestrator/eval/evaluate_ui.py` على 28 عبارة خارج بيانات التدريب.

> **لا تفعّل `AGENT_UI_TOOL=1` مع محوّل v2.** مواصفات الأدوات تتغير بإضافة الأداة، وv2 لم يُدرَّب عليها. فعّلها مع v4 فقط بعد نجاح البوابة.

## 0. قبل البدء (على الجهاز الذي فيه الكود)
```bash
git pull
cd orchestrator && python -m pytest tests -q --ignore=tests/load_test.py   # يجب: كله ناجح
cd ../gpu-stack/training
python generate_dataset.py --suffix v4        # يكتب data/train_v4.jsonl و val_v4.jsonl (لا يمس v2)
python validate_dataset.py v4                 # يجب: فحص الجودة ناجح، تسرب البيانات = 0
```
انقل `gpu-stack/data/*_v4.jsonl` إلى الجهاز إن لم يكن الكود نفسه هناك.

## 1. فحص الجهاز
```bash
nvidia-smi                      # الذاكرة الحرة بعد إيقاف vLLM يجب ≥ 12000MB (TRAIN_NEED_MB)
cp -r gpu-stack/loras gpu-stack/loras.bak-$(date +%F)   # نسخة احتياطية لمحوّلي v1/v2
```

## 2. دمج الكتابة العامة (يحتاج general_pairs.jsonl الموجود على الجهاز)
```bash
cd gpu-stack
DATA_SUFFIX=v4 python training/build_mixed_dataset.py
# يكتب data/train_mixed_v4.jsonl و val_mixed_v4.jsonl
```

## 3. خط الأساس قبل التدريب (مع v2 الحالي)
شغّل المنظومة بمحوّل v2 كما هي، ثم:
```bash
cd orchestrator
EVAL_LIVE_VLLM=1 EVAL_TAG=v2 python eval/evaluate_golden.py          # التقييم الذهبي القديم (20 حالة)
EVAL_LIVE_VLLM=1 EVAL_TAG=v2 AGENT_UI_TOOL=0 python eval/evaluate_ui.py  # متوقع: دقة التنقل مرتبطة بالموجّه فقط
```

## 4. التدريب (يوقف vLLM مؤقتاً؛ جدولة خارج ساعات الدوام)
```bash
cd gpu-stack
TRAIN_FILE=data/train_mixed_v4.jsonl VAL_FILE=data/val_mixed_v4.jsonl \
ADAPTER_NAME=manarasy-qwen3-v4 LR=1e-4 EPOCHS=2 training/run_train.sh
```
السكربت يعيد تشغيل الاستدلال تلقائياً عند الانتهاء أو الخطأ. أثناء التدريب تعمل المنصة بالرسالة البديلة. سجّل زمن التدريب الفعلي هنا لاعتماده في الجدولة: `____`.

## 5. تحميل v4 بجانب v2 (دون إزالة v2)
في `gpu-stack/.env`:
```bash
LORA_MODULES="manarasy_v4=manarasy-qwen3-v4 manarasy=manarasy-qwen3-v3 manarasy_v2=manarasy-qwen3-v2 manarasy_v1=manarasy-qwen3-v1"
```
```bash
cd gpu-stack && ./up.sh restart
curl -s http://$TS_IP:8000/v1/models | grep -o '"id":"[^"]*"'   # يجب ظهور manarasy_v4
```

## 6. بوابة القبول لـ v4
```bash
cd orchestrator
export VLLM_MODEL_AGENT=manarasy_v4 AGENT_UI_TOOL=1 EVAL_LIVE_VLLM=1 EVAL_TAG=v4
python eval/evaluate_golden.py
python eval/evaluate_ui.py            # البوابة: تنقل ≥ 90% وتحويل خاطئ = 0 وخرق صلاحيات = 0
cd ../gpu-stack/training
python compare_eval.py --before ../data/eval_report_v2.json --after ../data/eval_report_v4.json
```
معيار القبول: لا تراجع في فئات الأمان (`missing_param`, `rbac_security`, `prompt_injection`, `scope_isolation`)، ونجاح `evaluate_ui.py`.
إن فشلت أي بوابة: لا تنشر v4 وراجع الأمثلة الفاشلة في `data/eval_ui_v4.json` (وأضفها لبيانات التدريب بعد مراجعتها).

## 7. النشر التدريجي (canary) والرجوع
المستقر يبقى v2 دون أداة open_screen؛ والمجموعة التجريبية تستخدم v4 مع الأداة. القرار ثابت لكل مستخدم، وفشل v4 في أي طلب يسقط فوراً إلى v2 في الطلب نفسه.
```bash
# في بيئة orchestrator (docker-compose يقرأها من البيئة أو .env في جذر المشروع)
VLLM_MODEL_AGENT=manarasy            # المستقر v2 (لا يتغير)
VLLM_MODEL_AGENT_CANARY=manarasy_v4
AGENT_CANARY_TENANTS=<مسجد-تجريبي>   # ابدأ بمسجد واحد
AGENT_CANARY_PERCENT=5               # ثم 25 ثم 50 ثم 100 بعد 24 ساعة سليمة لكل مرحلة
```
تحقق بعد كل رفع: `curl -s http://orchestrator:8080/health | grep agent_rollout` و`/metrics` (`agent_variant_total`، `agent_ui_action_total`).
التنبيهات الجاهزة: `ops/prometheus/agent_alerts.yml`.
**الرجوع الفوري:** `AGENT_CANARY_PERCENT=0` ثم أعد تشغيل orchestrator. v2 لم يتغير. للتثبيت النهائي بعد نجاح كل المراحل: اجعل `VLLM_MODEL_AGENT=manarasy_v4` و`AGENT_UI_TOOL=1` وأفرغ `VLLM_MODEL_AGENT_CANARY`.

## 8. دورة التحسين اللاحقة (من محادثات المسجد)
1. مدير المسجد يفعّل الموافقة ويراجع الردود من «الإعدادات» (👎 أولاً).
2. تصدير المعتمَد (على خادم Django):
   ```bash
   python manage.py export_agent_training --out /secure/path/flywheel.jsonl
   ```
   الأسماء مُرمَّزة `{{PERSON_n}}`. إن حددت مراجعة `expected_tool` فهي تُحوَّل لاستدعاء أداة.
3. راجع الملف يدوياً، ثم حوّله لصيغة التدريب (system + user + assistant) وأضفه إلى `train_mixed_v4.jsonl` وأعد `validate_dataset.py` قبل أي تدريب (يتحقق من أسماء الأدوات والمعاملات بمخططاتها الحقيقية).
4. لا تنقل إلى جهاز الـ GPU إلا النسخة المُنقّاة المعتمدة.

## 9. قيود معروفة
- `generate_dataset.py` يعتمد على `AGENT_UI_TOOL=1` داخلياً؛ بيانات v2 القديمة (`train.jsonl`) تبقى كما هي.
- التدريب يحتاج كرتاً شبه فارغ (يوقف vLLM)؛ لا تدرّب أثناء الدوام.
- زمن التدريب غير مقيس بعد، وما يظهر في الخطوة 4 هو أول قياس فعلي.

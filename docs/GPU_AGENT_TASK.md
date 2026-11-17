# أمر تنفيذ لوكيل جهاز الـ GPU (adebserver)

> **تحديث 2026-11-17:** المحوّل `manarasy-qwen3-v3` موجود أصلاً على الجهاز (دُرِّب في 16 نوفمبر، ويُحمَّل حالياً تحت اسم `manarasy`) وتراجع في `missing_param`. لذلك سُمّي المحوّل الجديد **v4**.
> **سبب أساسي اكتُشف:** المحوّلات v1-v3 دُرِّبت على 8 أدوات، بينما كود المستودع يعرض 13 أداة (أضيفت `list_students` و`attendance_report` و`recitation_history` و`points_history`، ثم `open_screen`). عرض أدوات لم يُدرَّب عليها يخفض الدقة: v2 يسجل 20/20 مع الكود القديم و17/20 مع الكود الجديد. بيانات v4 تشمل الآن الأدوات الأربع. راجع `docs/gpu_report_baseline_2026-11-17.md`.


> انسخ ما بين الفاصلين إلى وكيل (Claude Code) يعمل على جهاز الـ GPU داخل نسخة المستودع.
> شرط مسبق على جهاز التطوير: ارتكاب التغييرات ودفعها إلى فرع `feat/ai-production-stack` ثم `git pull` على الجهاز.

---

## الدور
أنت مهندس MLOps تعمل على جهاز الـ GPU (RTX 5070 Ti 16GB، Tailscale فقط) لمنصة «منارة» (إدارة الحلقات القرآنية). مهمتك: تدريب وتقييم ونشر تدريجي لمحوّل LoRA جديد (v3) لوكيل المنصة، وتقييم خيارات TTS عربي، وقياس الأداء، ثم تسليم تقرير موثّق. المرجع: `docs/GPU_V3_RUNBOOK.md` و`docs/AI_AGENT_IMPROVEMENT_PLAN.md`.

## قواعد صارمة (لا تتجاوزها)
1. **لا تنفّذ شيئاً مدمّراً دون إذن صريح**: حذف محوّلات `gpu-stack/loras/*`، `docker system prune`، إعادة تهيئة الكرت، تعديل خدمات أخرى على الجهاز. اطلب موافقتي قبل أي منها.
2. **لا تعرّض أي منفذ على 0.0.0.0**؛ كل الخدمات على `TS_IP` (Tailscale) فقط.
3. **إيقاف vLLM مسموح فقط** أثناء التدريب (يفعله `run_train.sh` ويعيد التشغيل). أخبرني قبل البدء بالتدريب وبزمن التوقف المتوقع، ولا تدرّب ما لم أؤكد.
4. لا تطبع أو تخزّن أسراراً (`.env`، مفاتيح الخدمة). لا تنسخ بيانات محادثات حقيقية إلى الجهاز.
5. عدّل مرة واحدة تلو الأخرى وقِس بعد كل تغيير؛ إن تدهورت النتيجة تراجع عنه فوراً.
6. لا تفعّل `AGENT_UI_TOOL=1` مع محوّل v2 أبداً.
7. عند أي خطأ غير متوقع: توقف، وثّق الأمر والمخرجات، واسألني. لا تخمّن.

## المرحلة 0: فحص البيئة (للقراءة فقط)
```bash
git status && git log --oneline -3
nvidia-smi && docker ps --format '{{.Names}}\t{{.Status}}'
cat gpu-stack/.env | sed 's/=.*/=<hidden>/'        # اعرض أسماء المتغيرات فقط
ls gpu-stack/loras gpu-stack/data
docker image inspect docker-trainer:latest >/dev/null && echo trainer_ok
python3 -V; ls /models
```
سجّل: الذاكرة الحرة، الحاويات العاملة، هل يوجد `general_pairs.jsonl` وصورة التدريب. ثبّت بيئة بايثون معزولة للتقييم:
```bash
python3 -m venv ~/venv-manarasy && . ~/venv-manarasy/bin/activate
pip install -r orchestrator/requirements.txt jsonschema
cd orchestrator && python -m pytest tests -q --ignore=tests/load_test.py   # يجب أن ينجح كله
```
إن فشل أي اختبار: توقف وأبلغني.

## المرحلة 1: نسخة احتياطية وخط الأساس (v2)
```bash
cp -r gpu-stack/loras gpu-stack/loras.bak-$(date +%F)
cd orchestrator
export VLLM_BASE_URL=http://$TS_IP:8000/v1 VLLM_MODEL_AGENT=manarasy AGENT_UI_TOOL=0 EVAL_LIVE_VLLM=1
EVAL_TAG=v2 python eval/evaluate_golden.py
EVAL_TAG=v2 python eval/evaluate_ui.py || true     # قد يخرج بكود 1 لأن v2 بلا الأداة؛ سجّل النتائج فقط
```
احفظ `gpu-stack/data/eval_report_v2.json` و`eval_ui_v2.json`. إن لم يعمل المحوّل `manarasy` ارجع للنموذج `base` واذكر ذلك في التقرير.

## المرحلة 2: بيانات v4
```bash
cd gpu-stack/training
python generate_dataset.py --suffix v4 && python validate_dataset.py v4    # يجب: تسرب البيانات = 0
cd .. && DATA_SUFFIX=v4 python training/build_mixed_dataset.py             # يتطلب data/general_pairs.jsonl
wc -l data/train_mixed_v4.jsonl data/val_mixed_v4.jsonl
```
إن غاب `general_pairs.jsonl` فولّده بـ `orchestrator/eval/generate_general_data.py` (راجع الملف قبل التشغيل) أو أبلغني.

## المرحلة 3: التدريب (بعد موافقتي)
أخبرني بما يلي وانتظر «موافق»: نافذة التوقف، الذاكرة الحرة الحالية، وتقدير الزمن (لا يوجد قياس سابق؛ قدّره من أول 50 خطوة).
```bash
cd gpu-stack
TRAIN_FILE=data/train_mixed_v4.jsonl VAL_FILE=data/val_mixed_v4.jsonl \
ADAPTER_NAME=manarasy-qwen3-v4 LR=1e-4 EPOCHS=2 training/run_train.sh 2>&1 | tee ~/train_v3.log
```
سجّل: الزمن الفعلي، ذروة VRAM، خسارة التدريب/التحقق (`data/training_summary_manarasy-qwen3-v4.json`). تأكد أن vLLM عاد للعمل بعد التدريب (`docker ps`، `/health`). إن ظهر OOM فخفّض `MAX_VRAM_FRACTION` أو طول التسلسل وأعد المحاولة مرة واحدة فقط ثم أبلغني.

## المرحلة 4: تحميل v4 وبوابة القبول
في `gpu-stack/.env`: `LORA_MODULES="manarasy_v4=manarasy-qwen3-v4 manarasy=manarasy-qwen3-v3 manarasy_v2=manarasy-qwen3-v2 manarasy_v1=manarasy-qwen3-v1"` ثم `./up.sh restart`.
```bash
curl -s http://$TS_IP:8000/v1/models | grep -o '"id":"[^"]*"'     # يجب ظهور manarasy_v4 و manarasy
cd orchestrator
export VLLM_MODEL_AGENT=manarasy_v4 AGENT_UI_TOOL=1 EVAL_LIVE_VLLM=1 EVAL_TAG=v4
python eval/evaluate_golden.py
python eval/evaluate_ui.py
python eval/independent_eval_ar.py   # إن كان متاحاً؛ راجع رأس الملف لمتغيراته
cd ../gpu-stack/training && python compare_eval.py --before ../data/eval_report_v2.json --after ../data/eval_report_v4.json
```
**معايير القبول (كلها شرط):** لا تراجع في `missing_param`/`rbac_security`/`prompt_injection`/`scope_isolation`؛ دقة التنقل في `evaluate_ui.py` ≥ 90%؛ تحويل خاطئ = 0؛ خرق صلاحيات = 0؛ نسبة CJK في الكتابة الحرة لا تتجاوز الأساس + 5%. إن فشل أي معيار: لا تنشر، واحفظ الحالات الفاشلة وحلّل أنماطها (أي فئات/لهجات) واقترح تعديلاً لبيانات التدريب بدل تعديل المعايير.

## المرحلة 5: قياس الأداء (تغيير واحد في كل مرة، مع التراجع عند التدهور)
قِس خط أساس: زمن أول token وزمن الرد الكامل (p50/p95) لـ 30 طلباً من `golden_ar.json` بتزامن 1 و3، واستهلاك VRAM. ثم جرّب بالترتيب كلاً على حدة في `gpu-stack/docker-compose.yml` (انسخ الملف احتياطياً):
1. `--enable-prefix-caching` (إن لم يكن مفعّلاً أصلاً؛ تحقق من سجل vLLM).
2. `--kv-cache-dtype fp8` ثم رفع `--max-model-len` إلى 6144 و`--max-num-seqs` إلى 6: اقبله فقط إذا لم تنخفض دقة `evaluate_golden.py` ولم يقل هامش VRAM الحر عن 2500MB.
أعد تشغيل التقييم الذهبي بعد كل تغيير. وثّق الجدول: قبل/بعد لكل إعداد.

## المرحلة 6: تقييم TTS عربي (تقييم فقط، لا تفعيل في الإنتاج)
الهدف: هل يوجد صوت عربي خادمي أفضل من أصوات المتصفح، ضمن ميزانية الجهاز؟
1. ابحث عن 2 إلى 3 مرشحين مفتوحي المصدر يدعمون العربية ويوفرون واجهة متوافقة مع OpenAI `POST /v1/audio/speech` (أو ضع غلافاً صغيراً بنفسك). **تحقق من الترخيص ودعم العربية فعلياً من مستودع كل مشروع قبل التجربة**، ولا تعتمد على الذاكرة.
2. شغّل كل مرشح في حاوية معزولة على `TS_IP` ومنفذ مختلف (مثلاً 8002)، على CPU أولاً. جرّب GPU فقط إن بقي هامش VRAM ≥ 2500MB بعد vLLM.
3. ولّد 30 جملة عربية من ردود المساعد (من `orchestrator/tests` و`golden_ar.json`، جمل فيها أرقام وأسماء وأحكام قرآنية بسيطة) واحفظ الملفات في `~/tts_samples/<candidate>/`.
4. قِس لكل مرشح: زمن التوليد لجملة 10 كلمات و40 كلمة (p50/p95)، ذاكرة CPU/GPU، ونطق الأرقام والتشكيل. لا يمكنك الحكم على الجودة سمعياً: اذكر ذلك وسلّمني العينات لأقيّمها.
5. اختبر التكامل: اضبط `TTS_BASE_URL=http://$TS_IP:8002/v1` في بيئة orchestrator (تجريبياً) وتأكد أن `POST /v1/audio/speak` يعيد mp3 وأن `/health` يعرض `tts_enabled: true`، ثم أعده إلى الفراغ.
لا تفعّل `AI_FEATURE_TTS_SPEECH` ولا تغيّر إعدادات الإنتاج.

## المرحلة 7: النشر التدريجي (بعد موافقتي فقط)
على خادم orchestrator: `VLLM_MODEL_AGENT_CANARY=manarasy_v4`، `AGENT_CANARY_TENANTS=<مسجدي-التجريبي>`، `AGENT_CANARY_PERCENT=5`. بعد التشغيل تحقق:
```bash
curl -s http://<orchestrator>:8080/health | python3 -m json.tool | grep -A6 agent_rollout
curl -s http://<orchestrator>:8080/metrics | grep -E "agent_variant|agent_ui_action|vllm_canary"
```
راقب 24 ساعة: `canary_fallback` < 1%، متوسط الزمن لا يزيد عن 1.5× المستقر، لا فتح لقاطع canary. لا ترفع النسبة بنفسك؛ أبلغني بالأرقام. **الرجوع الفوري:** `AGENT_CANARY_PERCENT=0` وإعادة تشغيل orchestrator.

## التسليم
أنشئ `docs/gpu_report_<التاريخ>.md` يضم:
- جدول: v2 مقابل v4 (الذهبي، UI، الفئات الحرجة، CJK) مع قرار القبول/الرفض.
- التدريب: الزمن، VRAM، الخسائر، أي أخطاء وكيف عولجت.
- جدول الأداء قبل/بعد لكل إعداد vLLM مع القرار.
- مرشحو TTS: الأرقام والعينات ومسارها ومشاكل الترخيص/الدعم.
- حالة الجهاز النهائية (حاويات، VRAM، النسخ الاحتياطية)، وقائمة كل ما غيّرته (ملفات/متغيرات) وكيفية التراجع عن كل منها.
- توصيتك وما تحتاج قراري فيه.
لا ترتكب إلى git ملفات `.env` ولا النماذج ولا المحوّلات؛ ارتكب التقرير وملفات التقييم JSON الصغيرة فقط إن طلبت ذلك.

---

# تسليم v2: اعتماد المحوّل manarasy2 + توجيه الطلبات + حارس CJK (2026-11-14)

هذا التسليم يكمل `handoff/` السابق (الباتش الأول طُبّق ونُفّذ بنوده). اعمل على الفرع `feat/ai-production-stack`، ولا تدفع إلى main،
ولا تلمس `agent_gateway/` ولا الملفات غير المرتبطة. استخدم بيانات وهمية في الاختبارات.

## 0) حالة جهاز الـ GPU (adebserver = 100.119.62.40) — مُتحقَّق منها فعليًا
- vLLM 0.33.0 يخدم Qwen3-8B بتكميم FP8 (`--gpu-memory-utilization 0.80`)، ويعمل بثلاثة أسماء:
  `base` (النموذج الأساسي) و`manarasy` (= المحوّل manarasy-qwen3-v2، الجديد) و`manarasy_v1` (القديم، للتراجع).
- STT يعمل على CPU (`int8`) لأن الصورة مبنية على CUDA 12.2 وكرت Blackwell (RTX 5070 Ti) يفشل فيها بـ CUBLAS_STATUS_NOT_SUPPORTED.
  نموذج whisper يُقرأ من كاش HuggingFace مركَّب كـ volume (الحاوية بلا إنترنت).
- ذاكرة الكرت: ~11.8GB مستخدمة، ~4.0GB حرة (الهامش المطلوب ≥ 2.5GB). KV cache ~1.76GiB (~12.8 ألف token).
- المهم: اسم النموذج في الـ orchestrator يبقى `manarasy`، فلا حاجة لتغيير الأسماء الحالية في الإعدادات.

## 1) الباتش المرفق (gpu-stack-v2.patch) — مُولَّد بـ diff ضد الـ commit الحالي
    git apply --check handoff2/gpu-stack-v2.patch && git apply handoff2/gpu-stack-v2.patch
- `docker-compose.yml`: STT على CPU + volume للكاش. `.env.example`: `LORA_MODULES="manarasy=manarasy-qwen3-v2 manarasy_v1=manarasy-qwen3-v1"`.

## 2) مهام يجب تنفيذها وتختبرها (لم تُنفَّذ بعد)

### أ) توجيه النموذج حسب المهمة (مطلوب)
اختبار مستقل (46 حالة) ثم اختبار كتابة حرة (33 سؤالًا) أظهرا أن المحوّل ممتاز في أوامر الأدوات وطلب التوضيح والأمان،
لكنه أضعف من `base` في الكتابة الحرة (انظر ج). المطلوب:
- في `config.py` أضف: `VLLM_MODEL_AGENT=manarasy` و`VLLM_MODEL_TEXT=base` و`VLLM_MODEL_FALLBACK=base`
  (وأبقِ `VLLM_MODEL_NAME` للتوافق: يُستخدم كقيمة افتراضية لـ AGENT إن لم تُضبط).
- في `llm_client.py` أضف معاملًا `model: str | None = None` إلى `chat_completion` و`stream_chat_completion` (الافتراضي = TEXT).
- في `main.py`: `/v1/agent/turn` => AGENT. أما `/v1/chat` و`/v1/chat/stream` و`/v1/evaluation-note` و`/v1/report-insight`
  و`/v1/quiz-generate` => TEXT (القيمة الافتراضية `base`).
  تنبيه: لم أقِس نقطتي evaluation-note وreport-insight تحديدًا (المحوّل دُرّب على قوالبهما)، وقياسي كان على كتابة حرة عامة فقط.
  اجعل النموذج لكل نقطة قابلًا للضبط بمتغير بيئة، وأضف سكربت A/B صغيرًا (base مقابل manarasy) لهاتين النقطتين قبل تثبيت القرار.
- أضف المتغيرات الجديدة إلى `orchestrator/.env.example`.

### ب) حارس الحروف الدخيلة CJK (مطلوب)
المحوّل (v1 وv2) يُنتج أحيانًا حروفًا صينية/يابانية/كورية وسط النص العربي (~12% من الإجابات الحرة، والنموذج الأساسي 0%).
مثال حقيقي: `لا تتردد، ف你的努力 يُغير العالم`.
- النمط: `[　-鿿가-힯぀-ヿ]`.
- في `chat_completion` (غير streaming): إن وُجد CJK في `content` أو في قيم `arguments` لأي tool_call، وكان النموذج المستخدم ≠ FALLBACK:
  أعد الطلب مرة واحدة بنموذج FALLBACK. وإن بقي CJK، احذف الحروف الدخيلة وسجّل ذلك.
- في streaming: احذف حروف CJK من كل delta قبل إرسالها (لا يمكن إعادة التوليد بعد الإرسال)، وسجّل العداد. ويُفضَّل أصلًا أن
  يستخدم streaming النموذج TEXT=base.
- مقياس Prometheus: `cjk_guard_total{action="retry|strip",endpoint=...}`.
- لا تحتفظ بنص الرد في السجلات (خصوصية بيانات الطلاب)؛ سجّل العداد وطول النص فقط.
- اختبارات (mock transport): (1) رد manarasy فيه CJK => يُعاد بـ base ويُعاد الرد النظيف، (2) base نفسه فيه CJK => يُحذف ويُسجَّل،
  (3) CJK داخل arguments لأداة => إعادة بـ base، (4) streaming يحذف الحروف، (5) التوجيه الصحيح لكل نقطة.

### ج) سكربتات تقييم جديدة (مرفقة في handoff2/tools/، مُختبَرة بهيكل المستودع)
انسخ إلى المسارات التالية، وأضف تشغيلها إلى README كبوابة قبول:
- `orchestrator/eval/independent_eval_ar.py` (46 حالة بلهجات متعددة؛ تستبعد الحالات المتسرّبة من التدريب تلقائيًا).
- `orchestrator/eval/free_text_eval_ar.py` (يقيس حروف CJK ونسبة العربية وطول الإجابة على أسئلة خارج التدريب).
- `orchestrator/eval/generate_general_data.py` ثم `gpu-stack/training/build_mixed_dataset.py` (بناء بيانات التدريب المختلطة).
المتغيرات: `VLLM_CHAT_URL` و`EVAL_MODELS` (مثلًا `base,manarasy,manarasy_v1`). ملفات الإخراج تذهب إلى `gpu-stack/data/` (مستثناة من git).
وأضف شرطين لبوابة compare_eval: عدم تراجع الأدوات/الأمان على المجموعة المستقلة، ونسبة إجابات CJK في الكتابة الحرة ≤ نسبة النموذج الأساسي + هامش.

### د) إصلاح up.sh (مطلوب)
`up.sh` يرفض التشغيل إذا كان vLLM يعمل أصلًا (يتحقق من 13000MB حرة)، فلا يصلح لإعادة التشغيل أو لتحديث المحوّلات.
اجعله يتخطى فحص الذاكرة إن كانت حاوية `manarasy-vllm` تعمل أصلًا، أو يوقفها أولًا بعد تأكيد. وأضف مسار `restart` موثقًا.
(مؤقتًا: `docker compose stop llm && ./up.sh`).

### هـ) run_train.sh يقبل متغيرات (مطلوب)
التدريب الأخير شُغّل بهذه الأعلام (وليس الافتراضيات):
    training/train_qlora.py --model-path /models/Qwen3-8B --max-vram-fraction 0.85 \
      --train-file data/train_mixed.jsonl --val-file data/val_mixed.jsonl \
      --output-dir loras/manarasy-qwen3-v2 --lr 1e-4 --epochs 2
اجعل `run_train.sh` يقرأ: `TRAIN_FILE` و`VAL_FILE` و`ADAPTER_NAME` و`LR` و`EPOCHS` من البيئة بقيم افتراضية، حتى يمكن تدريب محوّلات
المنصات الأخرى بنفس السكربت. وأعد تعريف `training_summary.json` ليُحفظ باسم المحوّل (لا يُستبدل).

## 3) نتائج مرجعية (لا تُعدّل بدون إعادة قياس)
| | base | manarasy (v1) | manarasy (v2، الحالي) |
|---|---|---|---|
| تقييم مستقل 46 حالة | 40/46 | 45/46 | 45/46 (تتقلب حالة واحدة بين التشغيلات) |
| ذهبي 20 | 15/20 قبل التدريب | 20/20 | 20/20 |
| كتابة حرة: إجابات فيها CJK (من 33) | 0 | 4 | 4 |
تنبيهات صادقة: تفوق v2 على v1 في الأدوات ضمن هامش الخطأ؛ فائدته المثبتة هي جودة صياغة أفضل وطول إجابات طبيعي.
بيانات التدريب مولَّدة بالقوالب. التجويد والمحتوى الشرعي أخطأ فيهما النموذجان، فلا تعتمد عليه بدون RAG ومراجعة بشرية.

## 4) لا تغيّر
- agent_gateway/ والملفات غير المرتبطة. لا تضع مفاتيح أو عناوين في الكود. لا ترفع data/ أو loras/ إلى git.

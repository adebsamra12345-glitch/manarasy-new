# تسليم إصلاحات gpu-stack (مختبَرة على جهاز الـ GPU، 2026-11-11)

نُفّذت دورة كاملة على adebserver (RTX 5070 Ti) وكشفت أن الفرع feat/ai-production-stack لا يعمل كما هو.
النتيجة بعد الإصلاح: pre_train 15/20 (75%) -> post_train 20/20 (100%)، بوابة compare_eval: APPROVED.

## 1) طبّق الباتش المرفق (مختبَر بـ patch --dry-run على commit 988213c)
    cd /root/manarasy && git apply handoff/gpu-stack-fixes.patch
- docker-compose.yml: vLLM 0.33.0 أزال bitsandbytes ("Unknown quantization method").
  البديل المُختبر: --quantization fp8 مع --gpu-memory-utilization 0.80.
  (0.60 فشل: Available KV cache memory = -1.33 GiB. 0.80 يعطي KV ~1.76GiB وconcurrency ~3.1 عند 4096 tokens).
- train_qlora.py: trl 0.23 + transformers 5.5 يتطلبان SFTConfig بدل TrainingArguments
  (الخطأ: KeyError 'push_to_hub_token').

## 2) تعديلات لم تُدمج في الباتش (لم تُختبر كملفات؛ نفّذتُها يدويًا بأوامر مكافئة)
- training/run_train.sh: يستدعي python3 على المضيف ولا يوجد فيه torch. التدريب نُفّذ داخل صورة docker-trainer:latest
  (torch 2.10+cu128، transformers 5.5، peft 0.18.1، trl 0.23.1، bitsandbytes 0.49.1) بهذا الأمر:
    docker run -d --gpus all --user $(id -u):$(id -g) -e HOME=/tmp -v $PWD:/work -v $MODELS_DIR:/models:ro \
      -w /work/gpu-stack --entrypoint python3 docker-trainer:latest \
      training/train_qlora.py --model-path /models/Qwen3-8B --max-vram-fraction 0.85
  عدّل run_train.sh ليشغّل هذا الأمر، وتحقق منه فعليًا.
- --max-vram-fraction: الافتراضي 0.44 يفشل بـ OOM داخل prepare_model_for_kbit_training (تحويل embeddings إلى fp32).
  نجح التدريب بـ 0.85 (Peak 9.5GB). اجعل الافتراضي 0.85 مع تعليق يوضح أن التدريب يحتاج كرتًا شبه فارغ.
- up.sh و.env.example: أرقام الذاكرة (NEED_MB=9100، "~6.4GB") قديمة. مع FP8 يحتاج vLLM ~12GB؛ حدّث NEED_MB (~13000)
  واحذف افتراض التعايش مع خدمات أخرى بقيمة 6.4GB، أو وثّق الخيار البديل (AWQ 4-bit) إن لزم التعايش.
- في up.sh: LORA_ARGS يمرّر محوّلًا واحدًا. المطلوب لاحقًا أكثر من محوّل (manarasy + منصة المعاهد + منصة مساعدة الطلاب)
  على نفس النموذج الأساسي عبر --lora-modules متعددة.
- data/ و loras/ مستثناة من git (صحيح)؛ لا تُرفع.

## 3) تحفظات جودة
- بيانات التدريب مولَّدة بالقوالب (809 تدريب/111 تحقق، eval_loss=0.017) والتقييم الذهبي 20 سؤالًا فقط.
  أضف مجموعة تقييم أكبر وأسئلة حقيقية قبل اعتماد الإنتاج.
- بعض الأمثلة أطول من 1024 tokens (الأطول ~1217 تقريبًا) فتُقصّ أثناء التدريب؛ راجع تقصير أمثلة report_insight أو ارفع --max-seq-len.

## 4) لا تغيّر
- agent_gateway/ والملفات غير المرتبطة. اعمل على الفرع feat/ai-production-stack وليس main.

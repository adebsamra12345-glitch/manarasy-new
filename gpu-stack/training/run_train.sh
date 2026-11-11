#!/usr/bin/env bash
# ==============================================================================
# سكربت التشغيل الآمن لتدريب QLoRA على عقدة الـ GPU (RTX 5070 Ti - 16GB)
# الخطوات:
#   1. يوقف حاوية vLLM مؤقتاً (التدريب يحتاج كرتاً شبه فارغ؛ vLLM FP8 يحجز ~12GB).
#   2. يتحقق من أن الذاكرة الحرة >= TRAIN_NEED_MB (الافتراضي 12,000MB: Peak التدريب ~9.5GB + هامش 2.5GB).
#   3. يشغّل تدريب QLoRA داخل صورة التدريب (docker-trainer:latest) لأن المضيف لا يحوي torch،
#      ويحفظ المحوّل في ./loras/manarasy-qwen3-v1.
#   4. يعيد تشغيل خدمات الاستدلال (up.sh) تلقائياً حتى في حال حدوث خطأ (trap).
#
# صورة التدريب المُختبرة: torch 2.10+cu128، transformers 5.5، peft 0.18.1، trl 0.23.1، bitsandbytes 0.49.1
# متغيرات اختيارية (في .env أو البيئة): TRAINER_IMAGE, MAX_VRAM_FRACTION, TRAIN_NEED_MB, BASE_MODEL_NAME
# ==============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STACK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$STACK_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

MODELS_DIR="${MODELS_DIR:-/models}"
BASE_MODEL_NAME="${BASE_MODEL_NAME:-Qwen3-8B}"       # اسم مجلد النموذج داخل MODELS_DIR
TRAINER_IMAGE="${TRAINER_IMAGE:-docker-trainer:latest}"
MAX_VRAM_FRACTION="${MAX_VRAM_FRACTION:-0.85}"       # 0.44 يفشل بـ OOM؛ 0.85 مُختبر (Peak ~9.5GB)
TRAIN_NEED_MB="${TRAIN_NEED_MB:-12000}"              # Peak التدريب (~9.5GB) + هامش آمن (2.5GB)

if ! docker image inspect "$TRAINER_IMAGE" >/dev/null 2>&1; then
  echo "❌ صورة التدريب '${TRAINER_IMAGE}' غير موجودة على هذا الجهاز. ابنِها أو اضبط TRAINER_IMAGE."
  exit 1
fi
if [ ! -d "${MODELS_DIR}/${BASE_MODEL_NAME}" ]; then
  echo "❌ مجلد النموذج الأساسي غير موجود: ${MODELS_DIR}/${BASE_MODEL_NAME}"
  exit 1
fi

restart_inference() {
  echo "🔄 إعادة تشغيل بيئة الاستدلال عبر up.sh..."
  "$STACK_DIR/up.sh" || echo "⚠️ تعذّر إعادة تشغيل up.sh تلقائياً، يرجى التحقق يدوياً."
}

echo "⏸️  الخطوة 1/4: إيقاف حاوية الاستدلال (vLLM) مؤقتاً لتحرير ذاكرة البطاقة..."
docker compose stop llm 2>/dev/null || true
sleep 5

free_mb=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits | head -1 | tr -d ' ')
used_mb=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1 | tr -d ' ')
echo "📊 الخطوة 2/4: فحص ذاكرة الـ GPU قبل التدريب: مستخدم=${used_mb}MB | حر=${free_mb}MB"

if [ "$free_mb" -lt "$TRAIN_NEED_MB" ]; then
  echo "❌ الذاكرة الحرة (${free_mb}MB) أقل من المطلوب للتدريب الآمن (${TRAIN_NEED_MB}MB)."
  restart_inference
  exit 2
fi

trap restart_inference EXIT

echo "🔥 الخطوة 3/4: بدء تدريب QLoRA 4-bit على ${MODELS_DIR}/${BASE_MODEL_NAME} داخل ${TRAINER_IMAGE}..."
# يعمل في الواجهة (بدون -d) حتى ينتظر السكربت نهاية التدريب ثم يعيد تشغيل الاستدلال عبر الـ trap.
# المسارات الافتراضية في train_qlora.py تُحلّ داخل الحاوية إلى /work/gpu-stack/{data,loras/manarasy-qwen3-v1}.
docker run --rm --gpus all \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$STACK_DIR:/work/gpu-stack" \
  -v "$MODELS_DIR:/models:ro" \
  -w /work/gpu-stack \
  --entrypoint python3 "$TRAINER_IMAGE" \
  training/train_qlora.py \
  --model-path "/models/${BASE_MODEL_NAME}" \
  --max-vram-fraction "$MAX_VRAM_FRACTION"

echo "✅ الخطوة 4/4: اكتمل التدريب وحُفظ المحوّل في $STACK_DIR/loras/manarasy-qwen3-v1"


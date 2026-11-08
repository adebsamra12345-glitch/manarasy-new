#!/usr/bin/env bash
# ==============================================================================
# سكربت التشغيل الآمن لتدريب QLoRA على عقدة الـ GPU (RTX 5070 Ti - 16GB)
# الخطوات:
#   1. يوقف حاوية vLLM مؤقتاً (لإخلاء الـ 6.4GB المخصصة للاستدلال).
#   2. يتحقق من أن الذاكرة الحرة >= 9,100 MB (6,600MB للتدريب + 2,500MB هامش آمن).
#   3. يشغّل تدريب QLoRA ويحفظ المحوّل في ./loras/manarasy-qwen3-v1.
#   4. يعيد تشغيل خدمات الاستدلال (up.sh) تلقائياً حتى في حال حدوث خطأ (trap).
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
BASE_MODEL_PATH="${BASE_MODEL_PATH:-${MODELS_DIR}/Qwen3-8B}"
TRAIN_NEED_MB="${TRAIN_NEED_MB:-9100}"

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

echo "🔥 الخطوة 3/4: بدء تدريب QLoRA 4-bit على النموذج ${BASE_MODEL_PATH}..."
python3 "$SCRIPT_DIR/train_qlora.py" \
  --model-path "$BASE_MODEL_PATH" \
  --train-file "$STACK_DIR/data/train.jsonl" \
  --val-file "$STACK_DIR/data/val.jsonl" \
  --output-dir "$STACK_DIR/loras/manarasy-qwen3-v1"

echo "✅ الخطوة 4/4: اكتمل التدريب وحُفظ المحوّل في $STACK_DIR/loras/manarasy-qwen3-v1"


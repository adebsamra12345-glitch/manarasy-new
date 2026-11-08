#!/usr/bin/env bash
# ==============================================================================
# سكربت تشغيل وفحص آمن لبيئة GPU الخاصة بمنصة منارة (RTX 5070 Ti - 16GB)
# الحساب المعتمد:
#   - إجمالي الكرت: 16,384 MiB (16.0 GB)
#   - خدمات أخرى عاملة مسبقاً: ~6,554 MiB (~6.4 GB)
#   - مخصص لـ vLLM (Qwen3-8B 4-bit @ 0.40 utilization): ~6,554 MiB (~6.4 GB)
#   - الهامش الآمن الإلزامي بعد التشغيل: >= 2,500 MiB (~2.5 GB)
#   - الحد الأدنى للذاكرة الحرة قبل إقلاع الحاويات: 9,100 MiB (6,554 + 2,500)
# ==============================================================================
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# التحقق من ضبط عنوان Tailscale ومنع التعريض على 0.0.0.0
TS_IP="${TS_IP:-$(tailscale ip -4 2>/dev/null | head -1 || true)}"
if [ -z "$TS_IP" ] || [ "$TS_IP" = "0.0.0.0" ]; then
  echo "❌ خطأ أمني: يجب ضبط TS_IP بعنوان Tailscale صالح (يمنع الربط على 0.0.0.0)."
  exit 1
fi
export TS_IP

NEED_MB="${NEED_MB:-9100}"        # vLLM (~6554MB) + هامش آمن (2500MB)
MIN_MARGIN_MB="${MIN_MARGIN_MB:-2500}"

used=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1 | tr -d ' ')
free=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits | head -1 | tr -d ' ')
total=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1 | tr -d ' ')

echo "📊 حالة الـ GPU قبل التشغيل: مستخدم=${used}MB | حر=${free}MB | إجمالي=${total}MB"

if [ "$free" -lt "$NEED_MB" ]; then
  echo "❌ الذاكرة الحرة (${free}MB) أقل من الحد المطلوب (${NEED_MB}MB)."
  echo "التطبيقات التي تستخدم الـ GPU حالياً:"
  nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv
  exit 2
fi

mkdir -p ./loras ./data

# فحص تلقائي لوجود محوّل QLoRA المدرّب (manarasy-qwen3-v1)
if [ -f "./loras/manarasy-qwen3-v1/adapter_config.json" ]; then
  export LORA_ARGS="--lora-modules manarasy=/loras/manarasy-qwen3-v1"
  echo "🧩 تم اكتشاف محوّل LoRA المدرّب (manarasy-qwen3-v1) — سيتم تحميله تلقائياً باسم 'manarasy'."
else
  export LORA_ARGS=""
  echo "ℹ️ لم يُعثر على محوّل LoRA بعد — سيتم تشغيل النموذج الأساسي (base)."
fi

echo "🚀 جاري تشغيل خدمات الاستدلال (Qwen3-8B) والصوت (faster-whisper) على العنوان ${TS_IP}..."
docker compose up -d --wait
sleep 15

nvidia-smi --query-gpu=memory.used,memory.free,memory.total --format=csv
used_after=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1 | tr -d ' ')
total_after=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1 | tr -d ' ')
margin=$((total_after - used_after))

echo "📈 حالة الـ GPU بعد التشغيل: مستخدم=${used_after}MB | الهامش الحر المتبقي=${margin}MB"
if [ "$margin" -ge "$MIN_MARGIN_MB" ]; then
  echo "✅ الهامش الآمن متوفر (${margin}MB >= ${MIN_MARGIN_MB}MB)"
else
  echo "⚠️ تحذير: الهامش الحر (${margin}MB) أقل من 2.5GB (${MIN_MARGIN_MB}MB)!"
  exit 3
fi


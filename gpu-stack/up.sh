#!/usr/bin/env bash
# ==============================================================================
# سكربت تشغيل وفحص آمن لبيئة GPU الخاصة بمنصة منارة (RTX 5070 Ti - 16GB)
# الحساب المعتمد:
#   - إجمالي الكرت: 16,384 MiB (16.0 GB)
#   - vLLM 0.33 أزال bitsandbytes؛ نستخدم FP8 مع gpu-memory-utilization=0.80 => ~12 GB لـ vLLM
#     (0.60 فشل: KV cache سالبة. 0.80 يعطي KV ~1.76GiB وتزامن ~3.1 عند 4096 tokens)
#   - الكرت يجب أن يكون شبه مخصص لهذه البيئة: لم يعد التعايش مع خدمات أخرى تحجز ~6.4GB ممكناً
#   - الحد الأدنى للذاكرة الحرة قبل إقلاع الحاويات: 13,000 MiB (NEED_MB)
#   - الهامش الحر المطلوب بعد التشغيل: >= 2,500 MiB (MIN_MARGIN_MB)
#   - إن لزم التعايش مع خدمات GPU أخرى: البديل نموذج مكمَّم مسبقاً AWQ 4-bit (غير مُختبر هنا)
#     مع تخفيض --gpu-memory-utilization في docker-compose.yml و NEED_MB تبعاً لذلك.
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

NEED_MB="${NEED_MB:-13000}"       # vLLM FP8 @ 0.80 (~12GB) + هامش إقلاع
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

# محوّلات LoRA المتعددة على نفس النموذج الأساسي (manarasy + منصة المعاهد + منصة مساعدة الطلاب ...).
# LORA_MODULES: أزواج "اسم=مجلد" مفصولة بمسافات؛ المجلد نسبي إلى ./loras ويُخدَّم المحوّل بالاسم المعطى.
# يُحمَّل فقط ما يوجد له adapter_config.json، والباقي يُتخطّى مع تنبيه.
LORA_MODULES="${LORA_MODULES:-manarasy=manarasy-qwen3-v1}"
lora_specs=""
for spec in $LORA_MODULES; do
  lora_name="${spec%%=*}"
  lora_dir="${spec#*=}"
  if [ "$lora_name" = "$spec" ] || [ -z "$lora_name" ] || [ -z "$lora_dir" ]; then
    echo "❌ صيغة غير صالحة في LORA_MODULES: '${spec}' (المطلوب: اسم=مجلد)."
    exit 1
  fi
  if [ -f "./loras/${lora_dir}/adapter_config.json" ]; then
    lora_specs="${lora_specs} ${lora_name}=/loras/${lora_dir}"
    echo "🧩 محوّل LoRA '${lora_name}' <- ./loras/${lora_dir}"
  else
    echo "ℹ️ تخطّي المحوّل '${lora_name}': لا يوجد ./loras/${lora_dir}/adapter_config.json"
  fi
done
if [ -n "$lora_specs" ]; then
  export LORA_ARGS="--lora-modules${lora_specs}"
else
  export LORA_ARGS=""
  echo "ℹ️ لم يُعثر على أي محوّل LoRA — سيتم تشغيل النموذج الأساسي (base) فقط."
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


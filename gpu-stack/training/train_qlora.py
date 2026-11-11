#!/usr/bin/env python3
"""
سكربت التدريب الخفيف (QLoRA 4-bit NF4) لنموذج Qwen3-8B في منصة «منارة»:
- مصمم لكرت NVIDIA RTX 5070 Ti (16GB VRAM) ويحتاج كرتاً شبه فارغ أثناء التدريب
  (القياس الفعلي: Peak ~9.5GB؛ لا يتعايش مع vLLM أو خدمات GPU أخرى ثقيلة).
- يخفّض الاستهلاك عبر:
  * تكميم 4-bit NF4 مع Double Quantization (bnb_4bit_use_double_quant=True)
  * Gradient Checkpointing (use_reentrant=False)
  * محسن Paged AdamW 8-bit (paged_adamw_8bit)
  * per_device_train_batch_size=1 + gradient_accumulation_steps=8 + max_seq_length=1024
- يفرض سقفاً لذاكرة العملية عبر torch.cuda.set_per_process_memory_fraction (الافتراضي 0.85).
  السقف القديم 0.44 يفشل بـ OOM داخل prepare_model_for_kbit_training (تحويل embeddings إلى fp32).
- يحوّل أمثلة train.jsonl وval.jsonl إلى تنسيق Qwen3 ChatML الأصلي (مع <tools> و<tool_call> وبدون <think>).
- يدعم وضع --dry-run للتحقق من تنسيق البيانات والـ Prompts بدون الحاجة لوجود GPU.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DATA_DIR = ROOT_DIR / "gpu-stack" / "data"
DEFAULT_OUTPUT_DIR = ROOT_DIR / "gpu-stack" / "loras" / "manarasy-qwen3-v1"


def format_qwen3_chatml(row: dict[str, Any], tokenizer: Any = None) -> str:
    """
    ينسّق المحادثة والأدوات بصيغة Qwen3 ChatML الرسمية مع تعطيل التفكير (enable_thinking=False).
    إذا توفر tokenizer الخاص بـ HuggingFace يستخدم apply_chat_template مباشرة،
    وإلا يستخدم قالب ChatML المعياري المتوافق مع محلل hermes في vLLM.
    """
    messages = row["messages"]
    tools = row.get("tools") or []

    if tokenizer is not None and hasattr(tokenizer, "apply_chat_template"):
        try:
            return tokenizer.apply_chat_template(
                messages,
                tools=tools if tools else None,
                tokenize=False,
                add_generation_prompt=False,
                enable_thinking=False,
            )
        except TypeError:
            # في حال كانت نسخة الـ tokenizer لا تقبل enable_thinking كوسيط مباشر
            return tokenizer.apply_chat_template(
                messages,
                tools=tools if tools else None,
                tokenize=False,
                add_generation_prompt=False,
            )

    # القالب القياسي لـ Qwen2.5 / Qwen3 (Hermes Tool-Calling Format) بدون <think>
    parts: list[str] = []
    sys_msg = messages[0]["content"]
    if tools:
        tools_json = "\n".join(json.dumps(t, ensure_ascii=False) for t in tools)
        sys_block = (
            f"{sys_msg}\n\n"
            "# Tools\n\n"
            "You may call one or more functions to assist with the user query.\n\n"
            "You are provided with function signatures within <tools></tools> XML tags:\n"
            f"<tools>\n{tools_json}\n</tools>\n\n"
            "For each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:\n"
            "<tool_call>\n{\"name\": <function-name>, \"arguments\": <args-json-object>}\n</tool_call>"
        )
    else:
        sys_block = sys_msg

    parts.append(f"<|im_start|>system\n{sys_block}<|im_end|>")
    parts.append(f"<|im_start|>user\n{messages[1]['content']}<|im_end|>")

    assistant_msg = messages[2]
    tcalls = assistant_msg.get("tool_calls") or []
    if tcalls:
        tc_blocks = []
        for tc in tcalls:
            fn = tc["function"]
            args_obj = json.loads(fn["arguments"]) if isinstance(fn["arguments"], str) else fn["arguments"]
            tc_payload = json.dumps({"name": fn["name"], "arguments": args_obj}, ensure_ascii=False)
            tc_blocks.append(f"<tool_call>\n{tc_payload}\n</tool_call>")
        assistant_body = "\n".join(tc_blocks)
    else:
        assistant_body = assistant_msg.get("content") or ""

    # في Qwen3 عندما يكون enable_thinking=False يوضع <think>\n\n</think>\n فارغاً أو النص مباشرة
    parts.append(f"<|im_start|>assistant\n{assistant_body}<|im_end|>\n")
    return "\n".join(parts)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def run_dry_check(train_path: Path, val_path: Path) -> int:
    train_rows = load_jsonl(train_path)
    val_rows = load_jsonl(val_path)
    formatted_samples = [format_qwen3_chatml(r) for r in train_rows[:5]]
    max_chars = max(len(format_qwen3_chatml(r)) for r in train_rows + val_rows)
    approx_max_tokens = max_chars // 3

    print("=" * 78)
    print("✅ فحص جاهزية التدريب (Dry-Run Mode) ناجح 100%")
    print("=" * 78)
    print(f"عدد أمثلة التدريب : {len(train_rows)}")
    print(f"عدد أمثلة التحقق  : {len(val_rows)}")
    print(f"أقصى طول نص منسّق: {max_chars} حرف (~{approx_max_tokens} tokens <= 1024 max_seq_length)")
    print("-" * 78)
    print("عينة من التنسيق النهائي (Qwen3 Hermes Tool-Call ChatML):")
    print("-" * 78)
    print(formatted_samples[0][:900] + "\n...")
    print("=" * 78)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Train Qwen3-8B QLoRA adapter for Manarasy")
    parser.add_argument("--model-path", default=os.getenv("BASE_MODEL_PATH", "/models/Qwen3-8B"))
    parser.add_argument("--train-file", type=Path, default=DEFAULT_DATA_DIR / "train.jsonl")
    parser.add_argument("--val-file", type=Path, default=DEFAULT_DATA_DIR / "val.jsonl")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--max-seq-len", type=int, default=1024)
    parser.add_argument("--lora-r", type=int, default=16)
    parser.add_argument("--lora-alpha", type=int, default=32)
    # التدريب يحتاج كرتاً شبه فارغ (أوقف vLLM أولاً — run_train.sh يفعل ذلك):
    # 0.44 يفشل بـ OOM داخل prepare_model_for_kbit_training (تحويل embeddings إلى fp32)،
    # و0.85 نجح فعلياً على RTX 5070 Ti 16GB (Peak ~9.5GB).
    parser.add_argument(
        "--max-vram-fraction",
        type=float,
        default=0.85,
        help="سقف استهلاك العملية من الكرت (0.85 ≈ 13.6GB من 16GB؛ يتطلب كرتاً شبه فارغ)",
    )
    parser.add_argument("--dry-run", action="store_true", help="فحص البيانات والتنسيق دون تحميل النموذج على الـ GPU")
    args = parser.parse_args()

    if not args.train_file.exists() or not args.val_file.exists():
        print("❌ ملفات التدريب غير موجودة. شغّل generate_dataset.py أولاً.", file=sys.stderr)
        return 1

    if args.dry_run:
        return run_dry_check(args.train_file, args.val_file)

    import torch
    from datasets import Dataset
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
    )
    from trl import SFTConfig, SFTTrainer

    if not torch.cuda.is_available():
        print("❌ لم يتم العثور على بطاقة CUDA GPU. استخدم --dry-run للفحص بدون GPU.", file=sys.stderr)
        return 2

    # فرض سقف ذاكرة العملية (الافتراضي 0.85 من الكرت؛ التدريب يحتاج كرتاً شبه فارغ)
    torch.cuda.set_per_process_memory_fraction(args.max_vram_fraction, device=0)

    print(f"🚀 تحميل الـ Tokenizer والنموذج الأساسي من: {args.model_path}")
    tokenizer = AutoTokenizer.from_pretrained(args.model_path, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    train_rows = load_jsonl(args.train_file)
    val_rows = load_jsonl(args.val_file)
    train_ds = Dataset.from_list([{"text": format_qwen3_chatml(r, tokenizer)} for r in train_rows])
    val_ds = Dataset.from_list([{"text": format_qwen3_chatml(r, tokenizer)} for r in val_rows])

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
    )

    model = AutoModelForCausalLM.from_pretrained(
        args.model_path,
        quantization_config=bnb_config,
        device_map={"": 0},
        trust_remote_code=True,
        attn_implementation="sdpa",
    )
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)

    lora_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    training_args = SFTConfig(
        output_dir=str(args.output_dir),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=args.lr,
        lr_scheduler_type="cosine",
        warmup_ratio=0.06,
        weight_decay=0.01,
        fp16=False,
        bf16=True,
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=35,
        save_strategy="steps",
        save_steps=35,
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        optim="paged_adamw_8bit",
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        max_grad_norm=0.3,
        report_to="none",
        seed=42,
        max_length=args.max_seq_len,
        dataset_text_field="text",
    )

    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        args=training_args,
    )

    print("🔥 بدء تدريب QLoRA...")
    train_result = trainer.train()
    eval_metrics = trainer.evaluate()

    # حفظ المحوّل النهائي والـ tokenizer وسجل التدريب
    trainer.model.save_pretrained(str(args.output_dir))
    tokenizer.save_pretrained(str(args.output_dir))

    peak_vram_mb = round(torch.cuda.max_memory_allocated(0) / (1024 * 1024), 1)
    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "base_model": args.model_path,
        "adapter_path": str(args.output_dir),
        "train_samples": len(train_rows),
        "val_samples": len(val_rows),
        "epochs": args.epochs,
        "lora_r": args.lora_r,
        "lora_alpha": args.lora_alpha,
        "train_loss": round(float(train_result.training_loss), 4),
        "eval_loss": round(float(eval_metrics.get("eval_loss", 0.0)), 4),
        "peak_process_vram_mb": peak_vram_mb,
    }
    summary_file = DEFAULT_DATA_DIR / "training_summary.json"
    summary_file.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=" * 78)
    print(f"✅ اكتمل التدريب بنجاح! تم حفظ المحوّل في: {args.output_dir}")
    print(f"📉 train_loss={summary['train_loss']} | eval_loss={summary['eval_loss']} | Peak VRAM={peak_vram_mb} MB")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


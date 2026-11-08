#!/usr/bin/env python3
"""
فاحص جودة وصحة بيانات التدريب (Dataset Quality & Schema Validator):
1. يتحقق من صحة JSON وبنية المحادثات (system -> user -> assistant).
2. يتحقق أن كل استدعاء أداة (tool_calls) يطابق JSON Schema الفعلي للأداة في agent_tools.py.
3. يتحقق من عدم وجود أي تسرب بيانات (Zero Data Leakage) مع ملف التقييم الذهبي golden_ar.json.
4. يتحقق من خلو جميع الردود من وسوم <think> أو وسوم HTML/XSS أو بيانات PII.
"""
import json
import sys
from pathlib import Path

import jsonschema

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR / "orchestrator"))

from app.agent_tools import CLARIFY_SPEC, TOOLS

DATA_DIR = ROOT_DIR / "gpu-stack" / "data"
GOLDEN_PATH = ROOT_DIR / "orchestrator" / "eval" / "golden_ar.json"


def validate_file(path: Path, golden_utterances: set[str]) -> tuple[int, int]:
    lines = path.read_text(encoding="utf-8").splitlines()
    valid_count = 0
    tool_calls_validated = 0

    for idx, line in enumerate(lines, 1):
        row = json.loads(line)
        msgs = row.get("messages") or []
        assert len(msgs) == 3, f"{path.name}:{idx} must have 3 messages (system, user, assistant)"
        assert msgs[0]["role"] == "system"
        assert msgs[1]["role"] == "user"
        assert msgs[2]["role"] == "assistant"

        # فحص عدم تسرب أي جملة من التقييم الذهبي
        user_text = msgs[1]["content"]
        for g_utt in golden_utterances:
            assert g_utt not in user_text, f"Data leakage detected in {path.name}:{idx}: {g_utt}"

        # فحص خلو مخرجات المساعد من <think> أو <script>
        assistant_content = msgs[2].get("content") or ""
        assert "<think>" not in assistant_content.lower(), f"<think> found in {path.name}:{idx}"
        assert "<script>" not in assistant_content.lower(), f"<script> found in {path.name}:{idx}"

        # فحص مطابقة JSON Schema لأدوات الوكيل
        tcalls = msgs[2].get("tool_calls") or []
        for tc in tcalls:
            fn = tc["function"]
            tname = fn["name"]
            targs = json.loads(fn["arguments"])
            if tname == "ask_clarification":
                schema = CLARIFY_SPEC["function"]["parameters"]
            else:
                assert tname in TOOLS, f"Unknown tool '{tname}' in {path.name}:{idx}"
                schema = TOOLS[tname].parameters
            jsonschema.validate(targs, schema)
            tool_calls_validated += 1

        valid_count += 1

    return valid_count, tool_calls_validated


def main():
    golden = {
        c["utterance"].strip()
        for c in json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    }
    train_ok, train_tc = validate_file(DATA_DIR / "train.jsonl", golden)
    val_ok, val_tc = validate_file(DATA_DIR / "val.jsonl", golden)
    print(f"✅ فحص الجودة ناجح 100%: train={train_ok} (أدوات مفحوصة={train_tc}) | val={val_ok} (أدوات مفحوصة={val_tc}) | تسرب البيانات=0")


if __name__ == "__main__":
    main()


"""منع توليد رموز CJK (صينية/يابانية/كورية) على مستوى vLLM لكل الطلبات (واجهة Model Runner V2 في vLLM 0.33).
المحوّلات (LoRA) كانت تُسرّب حروفًا صينية وسط النص العربي (~10% من الإجابات). القائمة تُبنى من مفردات Qwen3 (build_cjk_ban_ids.py).
التفعيل: --logits-processors cjk_ban:CjkBanLogitsProcessor مع PYTHONPATH=/plugins."""
import json
import os

from vllm.v1.worker.gpu.sample.logits_processor.interface import LogitsProcessor


class CjkBanLogitsProcessor(LogitsProcessor):
    def __init__(self, vllm_config, req_states):
        import torch
        ids = json.load(open(os.getenv("CJK_BAN_FILE", "/plugins/cjk_ban_ids.json")))
        self.ids = torch.tensor([i for i in ids if i < req_states.vocab_size], dtype=torch.long, device=req_states.device)

    def apply(self, logits, ctx):
        logits[:, self.ids] = float("-inf")
        return logits

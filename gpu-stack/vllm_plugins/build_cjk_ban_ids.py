"""يبني cjk_ban_ids.json من tokenizer النموذج. التشغيل داخل docker-trainer: python3 build_cjk_ban_ids.py /models/Qwen3-8B out.json"""
import json, re, sys
from transformers import AutoTokenizer
t = AutoTokenizer.from_pretrained(sys.argv[1])
CJK = re.compile(r"[　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]")
ids = [i for i in range(len(t)) if CJK.search(t.decode([i]))]
json.dump(ids, open(sys.argv[2], "w")); print(len(ids))

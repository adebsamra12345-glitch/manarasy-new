import json, re, httpx, concurrent.futures as cf
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent          # orchestrator/
DATA = ROOT.parent / "gpu-stack" / "data"              # gpu-stack/data/ (مستثناة من git)
URL = os.getenv("VLLM_CHAT_URL", "http://100.119.62.40:8000/v1/chat/completions")
MODELS = os.getenv("EVAL_MODELS", "base,manarasy,manarasy_v1").split(",")
held=json.load(open(DATA/"heldout_general.json",encoding="utf-8"))
extra=["اكتب لي رسالة قصيرة وراقية لولي أمر طالب تأخر عن الحلقة ثلاثة أيام","لخّص في ثلاث نقاط فوائد حفظ القرآن للأطفال","اكتب نصيحة قصيرة لمعلم الحلقة لتحفيز طالب خجول"]
prompts=extra+held
CJK=re.compile(r"[\u3000-\u9fff\uac00-\ud7af\u3040-\u30ff]")
LAT=re.compile(r"[A-Za-z]")
AR=re.compile(r"[\u0600-\u06FF]")
cl=httpx.Client(timeout=180)
def ask(a):
    m,p=a
    r=cl.post(URL,json={"model":m,"messages":[{"role":"system","content":"أنت مساعد عربي مفيد ودقيق."},{"role":"user","content":p}],"temperature":0,"max_tokens":450}).json()["choices"][0]
    return r["message"]["content"], r["finish_reason"]
res={}
for m in MODELS:
    with cf.ThreadPoolExecutor(4) as ex: res[m]=list(ex.map(ask,[(m,p) for p in prompts]))
print(f"{'model':10} {'with CJK':>9} {'CJK chars':>10} {'latin/100ch':>12} {'avg len':>8} {'arabic ratio':>13}")
for m,rs in res.items():
    cj=sum(bool(CJK.search(t)) for t,_ in rs); cjc=sum(len(CJK.findall(t)) for t,_ in rs)
    lat=sum(len(LAT.findall(t)) for t,_ in rs)/max(1,sum(len(t) for t,_ in rs))*100
    ar=sum(len(AR.findall(t)) for t,_ in rs)/max(1,sum(len(re.findall(r"\S",t)) for t,_ in rs))
    print(f"{m:10} {cj:>6}/{len(rs)} {cjc:>10} {lat:>12.2f} {sum(len(t) for t,_ in rs)/len(rs):>8.0f} {ar:>13.2f}")
for i in (0,1,2):
    print("\n#####",prompts[i])
    for m in res: print(f"--- {m}\n{res[m][i][0][:520]}")
json.dump({m:[t for t,_ in rs] for m,rs in res.items()},open(DATA/"free_outputs.json","w"),ensure_ascii=False)

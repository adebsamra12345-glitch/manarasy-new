import json, random, re, concurrent.futures as cf, httpx
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent          # orchestrator/
DATA = ROOT.parent / "gpu-stack" / "data"              # gpu-stack/data/ (مستثناة من git)
URL = os.getenv("VLLM_CHAT_URL", "http://100.119.62.40:8000/v1/chat/completions")
MODELS = os.getenv("EVAL_MODELS", "base,manarasy,manarasy_v1").split(",")
OUT = str(DATA) + "/"
random.seed(7)
CJK = re.compile(r"[\u3000-\u9fff\uac00-\ud7af\u3040-\u30ff]")
TOPICS = [
 "كتابة رسائل رسمية ولبقة لأولياء أمور الطلاب", "صياغة تقارير موجزة عن أداء مجموعة طلاب", "نصائح لمعلم جديد في إدارة الصف",
 "تحفيز الطلاب الضعفاء وبناء ثقتهم بأنفسهم", "تنظيم الوقت والمراجعة اليومية للطلاب", "كتابة إعلانات وتعميمات لمركز تعليمي",
 "رسائل شكر وتقدير للمعلمين والمتطوعين", "رسائل اعتذار وتوضيح لأولياء الأمور", "دعوات لحضور اجتماعات أو حفلات تكريم",
 "شرح مفاهيم علمية بسيطة للأطفال", "قواعد اللغة العربية والإملاء للمرحلة الابتدائية", "مسائل حسابية بسيطة وشرحها",
 "نصائح دراسية وطرق الحفظ الفعّالة", "كتابة بريد إلكتروني مهني قصير", "تلخيص فقرات قصيرة في نقاط",
 "التعامل مع الطالب كثير الحركة أو قليل التركيز", "أنشطة وألعاب تعليمية للأطفال داخل الصف", "إدارة مركز تعليمي صغير وتنظيم الجداول",
 "التواصل الفعّال بين المعلم وولي الأمر", "صياغة أهداف أسبوعية وخطط متابعة للطلاب", "أسئلة عامة عن الصحة والنوم والغذاء للطلاب",
 "إعادة صياغة جمل لتصبح أكثر لباقة", "ترجمة جمل بسيطة بين العربية والإنجليزية", "نصائح في الحوار والاستماع وآداب المجلس",
 "كتابة شهادات شكر وعبارات تكريم للطلاب المتميزين", "تنظيم الاختبارات الشفوية والتقويم العادل", "التعامل مع الغياب المتكرر للطلاب",
]
cl = httpx.Client(timeout=180)
def chat(msgs, temp, mx):
    r = cl.post(URL, json={"model":"base","messages":msgs,"temperature":temp,"max_tokens":mx}).json()
    c = r["choices"][0]; return c["message"]["content"], c["finish_reason"]
def gen_prompts(t):
    out=[]
    for _ in range(2):
        txt,_ = chat([{"role":"user","content":f"اكتب 12 سؤالاً أو طلباً متنوعاً بالعربية الفصحى المبسطة يطرحه معلم أو مشرف تعليمي في موضوع: {t}.\nاكتب كل واحد في سطر منفصل دون ترقيم أو شرح إضافي."}],0.9,600)
        for l in txt.splitlines():
            l=re.sub(r"^[\s\-\*\d\.\)]+","",l).strip()
            if 15<=len(l)<=220 and not CJK.search(l): out.append(l)
    return out
with cf.ThreadPoolExecutor(4) as ex: allp=[p for ps in ex.map(gen_prompts,TOPICS) for p in ps]
prompts=sorted(set(allp)); random.shuffle(prompts)
print("unique prompts:",len(prompts))
held=prompts[:30]; pool=prompts[30:]
def answer(p):
    a,fr = chat([{"role":"system","content":"أنت مساعد عربي مفيد ودقيق."},{"role":"user","content":p}],0.3,450)
    return p,a,fr
with cf.ThreadPoolExecutor(4) as ex: res=list(ex.map(answer,pool))
good=[(p,a) for p,a,fr in res if fr=="stop" and 60<=len(a)<=1800 and not CJK.search(a)]
print("answers kept:",len(good),"of",len(res))
json.dump(held,open(OUT+"heldout_general.json","w"),ensure_ascii=False,indent=1)
with open(OUT+"general_pairs.jsonl","w",encoding="utf-8") as f:
    for p,a in good: f.write(json.dumps({"p":p,"a":a},ensure_ascii=False)+"\n")

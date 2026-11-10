# -*- coding: utf-8 -*-
"""
تدريب وكيل منارة السريع (بدون GPU، استنتاج بالميلي ثانية):
  1) مصنّف النية: TF-IDF حروف n-gram + LinearSVC  (على النية الأساسية بلا دور)
  2) مصنّف الصفحة للتنقل
  3) استخراج المتغيرات: معجم + قواعد
  4) الصلاحيات: حتمية من الكتالوج (لا يتعلمها النموذج)
التشغيل: python ai_agent/train_agent.py
المخرجات: ai_agent/model/manara_agent.joblib  + تقرير التقييم على test
"""
import json, os, re, time, joblib, collections, sys
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import make_pipeline, make_union
from sklearn.svm import LinearSVC
HERE_ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE_, "..", "backend"))
from tenant_modules.agent.action_catalog import *
from tenant_modules.agent.runtime import *

HERE_ = os.path.dirname(os.path.abspath(__file__)); HERE = os.path.dirname(os.path.abspath(__file__)); D = HERE + "/data"; M = os.path.join(HERE, "..", "backend", "tenant_modules", "agent")


def load(split):
    return [json.loads(l) for l in open(f"{D}/{split}.jsonl", encoding="utf-8")]


def base_label(s):
    if s["intent"] == "permission_denied":
        return s["slots"].get("blocked_intent", "navigate")
    return s["intent"]


def make_clf():
    feats = make_union(TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True, min_df=2),
                       TfidfVectorizer(analyzer="word", ngram_range=(1, 2), sublinear_tf=True))
    return make_pipeline(feats, LinearSVC(C=1.0, class_weight="balanced"))


def main():
    os.makedirs(M, exist_ok=True)
    tr, va, te = load("train"), load("val"), load("test")
    X = lambda rows: [norm(r["text"]) for r in rows]
    intent_clf = make_clf().fit(X(tr), [base_label(r) for r in tr])
    nav = [r for r in tr if base_label(r) == "navigate"]
    page_clf = make_clf().fit(X(nav), [r["slots"]["page"] for r in nav])
    agent = Agent(intent_clf, page_clf)
    joblib.dump(dict(intent_clf=intent_clf, page_clf=page_clf), M + "/manara_agent.joblib", compress=3)

    for name, rows in (("val", va), ("test", te)):
        ok_int = ok_act = ok_slot = ok_slot_n = 0; t0 = time.perf_counter()
        per = collections.defaultdict(lambda: [0, 0]); slot_err = collections.Counter(); bad = []
        for r in rows:
            p = agent.predict(r["text"], r["role"])
            e_int = r["intent"]; i_ok = p["intent"] == e_int
            ok_int += i_ok; per[e_int][0] += 1; per[e_int][1] += i_ok
            a_ok = i_ok and p.get("action", {}) == r["action"] or (i_ok and p["action"].get("type") == r["action"].get("type")
                                                                   and p["action"].get("route") == r["action"].get("route")
                                                                   and p["action"].get("endpoint") == r["action"].get("endpoint")
                                                                   and p["action"].get("handler") == r["action"].get("handler"))
            ok_act += a_ok
            if i_ok and r["intent"] not in ("permission_denied",):
                ok_slot_n += 1; exp = dict(r["slots"]); got = p["slots"]; good = True
                for k, v in exp.items():
                    if k == "student": g = got.get(k, "") ; gv = (norm(g).split() or [""])[0] == norm(v).split()[0]
                    else: gv = got.get(k) == v
                    if not gv: good = False; slot_err[k] += 1
                ok_slot += good
                if not good and len(bad) < 8: bad.append((r["text"], exp, got))
            elif not i_ok and len(bad) < 8: bad.append((r["text"], r["intent"], p["intent"]))
        dt = (time.perf_counter() - t0) / len(rows) * 1000
        print(f"\n== {name}: n={len(rows)} intent_acc={ok_int/len(rows):.4f} action_acc={ok_act/len(rows):.4f} "
              f"slot_exact={ok_slot/max(1,ok_slot_n):.4f} latency={dt:.2f}ms/req")
        if name == "test":
            worst = sorted(per.items(), key=lambda kv: kv[1][1] / kv[1][0])[:6]
            print("weakest intents:", [(k, f"{v[1]}/{v[0]}") for k, v in worst])
            print("slot errors:", dict(slot_err))
            for b in bad: print("  ✗", b)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

# -*- coding: utf-8 -*-
"""
مولّد بيانات تدريب وكيل منارة (صوتي/كتابي).
التشغيل:  python ai_agent/build_dataset.py [--per-intent 400] [--seed 42]
المخرجات في ai_agent/data/:
  train.jsonl / val.jsonl / test.jsonl   -> تصنيف النية + المتغيرات (للنماذج الصغيرة السريعة)
  finetune_chat.jsonl                    -> نفس train بصيغة messages لضبط LLM
  catalog.json                           -> كتالوج الإجراءات للتنفيذ في الواجهة
  stats.json                             -> إحصاءات
"""
import argparse, json, random, re, hashlib, collections, os
import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from tenant_modules.agent.action_catalog import *

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data")

ROLE_AR = {"TENANT_ADMIN": "مدير المسجد", "CENTER_MANAGER": "مدير المركز", "TEACHER": "معلم", "STUDENT": "طالب"}
NUM_WORDS = {1: "واحد", 2: "اثنين", 3: "ثلاثة", 4: "أربعة", 5: "خمسة", 6: "ستة", 7: "سبعة", 8: "ثمانية",
             9: "تسعة", 10: "عشرة", 15: "خمسة عشر", 20: "عشرين", 25: "خمسة وعشرين", 50: "خمسين"}
AR_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")

VOICE_PREFIX = ["", "", "", "يا منارة ", "منارة ", "لو سمحت ", "طيب ", "اممم ", "يعني ", "من فضلك "]
TEXT_PREFIX = ["", "", "", "", "رجاءً ", "لو سمحت "]
SUFFIX = ["", "", "", " لو سمحت", " الآن", " بسرعة", " من فضلك", " يا منارة"]


# ---------------- أدوات التشويش ----------------
def strip_tashkeel(s): return re.sub(r"[ً-ْٰ]", "", s)

def asr_noise(s, rng):
    """يحاكي أخطاء التعرف على الكلام العربي: همزات، تاء مربوطة، ياء/ألف مقصورة، حروف مدمجة."""
    s = strip_tashkeel(s)
    if rng.random() < .5: s = re.sub("[أإآ]", "ا", s)
    if rng.random() < .3: s = s.replace("ة", "ه")
    if rng.random() < .25: s = re.sub("ى", "ي", s)
    if rng.random() < .15: s = s.replace("ظ", "ض")
    if rng.random() < .15: s = s.replace("ذ", "ز")
    if rng.random() < .12:
        w = s.split()
        if len(w) > 2:
            i = rng.randrange(len(w)); w.insert(i, w[i])  # تكرار كلمة (تلعثم)
        s = " ".join(w)
    return s

def text_noise(s, rng):
    s = strip_tashkeel(s)
    if rng.random() < .3: s = re.sub("[أإآ]", "ا", s)
    if rng.random() < .15: s = s.replace("ة", "ه")
    if rng.random() < .1 and len(s) > 6:  # خطأ كتابة بحذف حرف
        i = rng.randrange(1, len(s) - 1)
        if s[i] != " ": s = s[:i] + s[i + 1:]
    return s


def num(n, rng):
    r = rng.random()
    if n in NUM_WORDS and r < .35: return NUM_WORDS[n]
    if r < .55: return str(n).translate(AR_DIGITS)
    return str(n)


def pick_student(rng):
    f = rng.choice(FIRST_NAMES); l = rng.choice(LAST_NAMES)
    return (f + " " + l).strip()


def pick_student_form(name, rng):
    """قد ينطق المستخدم الاسم الأول فقط."""
    return name.split()[0] if rng.random() < .45 else name


# ---------------- تعبئة القوالب ----------------
def fill(template, ctx):
    return re.sub(r"\{(\w+)\}", lambda m: str(ctx.get(m.group(1), m.group(0))), template)


def build_intent_sample(intent, spec, role, channel, rng):
    ctx, slots = {}, {}
    wanted = set(s.rstrip("?") for s in spec["slots"])
    tpl = rng.choice(spec["templates"])
    used = set(re.findall(r"\{(\w+)\}", tpl))

    student = pick_student(rng)
    if "student" in used:
        ctx["student"] = pick_student_form(student, rng); slots["student"] = student
    if "halaqa" in used:
        h = rng.choice(HALAQA_NAMES); ctx["halaqa"] = h; slots["halaqa"] = h
    if "status" in used:
        k = rng.choice(list(ATTENDANCE)); ctx["status"] = rng.choice(ATTENDANCE[k]); slots["status"] = k
    if "grade" in used:
        k = rng.choice(list(GRADES)); ctx["grade"] = rng.choice(GRADES[k]); slots["grade"] = k
    if "page" in used:
        p = rng.randint(1, 604); ctx["page"] = num(p, rng) if p <= 50 else str(p); slots["page"] = p
    if "points" in used:
        n = rng.choice([1, 2, 3, 5, 10, 15, 20, 25, 50]); ctx["points"] = num(n, rng); slots["points"] = n
    if "rtype" in used:
        k = rng.choice(list(RECITATION_TYPES)); ctx["rtype"] = rng.choice(RECITATION_TYPES[k]); slots["recitation_type"] = k
    if "surah" in used:
        no, nm, cnt = rng.choice(SURAHS); a1 = rng.randint(1, max(1, cnt - 1)); a2 = rng.randint(a1 + 1, cnt) if cnt > a1 else a1
        ctx.update(surah=nm, a_from=num(a1, rng), a_to=num(a2, rng))
        slots.update(surah=nm, surah_no=no, ayah_from=a1, ayah_to=a2)
    if "item" in used:
        it = rng.choice(REWARD_ITEMS); ctx["item"] = it; slots["reward"] = it
    if "role_ar" in used:
        r = rng.choice([x for x in ROLES if x != role]); ctx["role_ar"] = ROLE_AR[r]; slots["role"] = r

    text = fill(tpl, ctx)
    pre = rng.choice(VOICE_PREFIX if channel == "voice" else TEXT_PREFIX)
    text = pre + text + rng.choice(SUFFIX)
    text = asr_noise(text, rng) if channel == "voice" else text_noise(text, rng)
    if channel == "text" and rng.random() < .25: text += rng.choice(["", "؟", "."])

    action = dict(spec["action"])
    if "route" in action: action["route"] = action["route"].replace("{prefix}", ROLE_PREFIX[role])
    return dict(text=text.strip(), role=role, channel=channel, intent=intent, slots=slots,
                action=action, requires_confirmation=spec["confirm"])


def build_nav_sample(page, roles, names, role, channel, rng):
    verb = rng.choice(NAV_VERBS); name = rng.choice(names)
    text = rng.choice(VOICE_PREFIX if channel == "voice" else TEXT_PREFIX) + f"{verb} {name}" + rng.choice(SUFFIX)
    text = asr_noise(text, rng) if channel == "voice" else text_noise(text, rng)
    if rng.random() < .15: text = name  # اسم الصفحة فقط
    if role in roles:
        route = f"{ROLE_PREFIX[role]}/{page}"
        return dict(text=text.strip(), role=role, channel=channel, intent="navigate", slots=dict(page=page),
                    action=dict(type="navigate", route=route), requires_confirmation=False)
    return dict(text=text.strip(), role=role, channel=channel, intent="permission_denied", slots=dict(page=page),
                action=dict(type="reply", message=f"عذراً، صفحة «{names[0]}» غير متاحة لصلاحياتك كـ{ROLE_AR[role]}."),
                requires_confirmation=False)


def build_denied(intent, spec, role, channel, rng):
    s = build_intent_sample(intent, spec, role, channel, rng)
    s.update(intent="permission_denied", action=dict(type="reply", message="عذراً، هذا الأمر غير متاح لصلاحياتك."),
             requires_confirmation=False); s["slots"] = dict(blocked_intent=intent)
    return s


def build_misc(role, channel, rng):
    if rng.random() < .5:
        t = rng.choice(OUT_OF_SCOPE)
        return dict(text=asr_noise(t, rng) if channel == "voice" else t, role=role, channel=channel, intent="out_of_scope",
                    slots={}, action=dict(type="reply", message="أنا مساعد منارة وأنفّذ أوامر المنصة فقط."), requires_confirmation=False)
    t, q = rng.choice(AMBIGUOUS)
    return dict(text=asr_noise(t, rng) if channel == "voice" else t, role=role, channel=channel, intent="clarify",
                slots={}, action=dict(type="reply", message=q), requires_confirmation=False)


# ---------------- التشغيل ----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-intent", type=int, default=400); ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args(); rng = random.Random(a.seed)
    os.makedirs(OUT, exist_ok=True)
    samples = []

    for intent, spec in INTENTS.items():
        for _ in range(a.per_intent):
            ch = "voice" if rng.random() < .55 else "text"
            samples.append(build_intent_sample(intent, spec, rng.choice(spec["roles"]), ch, rng))
        for _ in range(a.per_intent // 10):  # أدوار غير مصرّح لها
            bad = [r for r in ROLES if r not in spec["roles"]]
            if bad: samples.append(build_denied(intent, spec, rng.choice(bad), rng.choice(["voice", "text"]), rng))

    for page, (roles, names) in PAGES.items():
        for _ in range(a.per_intent):
            role = rng.choice(roles if rng.random() < .88 else ROLES)
            samples.append(build_nav_sample(page, roles, names, role, "voice" if rng.random() < .55 else "text", rng))

    for _ in range(a.per_intent * 2):
        samples.append(build_misc(rng.choice(ROLES), rng.choice(["voice", "text"]), rng))

    # إزالة التكرار
    seen, uniq = set(), []
    for s in samples:
        k = (s["role"], s["text"], s["intent"], json.dumps(s["slots"], ensure_ascii=False, sort_keys=True))
        if k not in seen: seen.add(k); uniq.append(s)
    samples = uniq
    for s in samples:
        s["id"] = hashlib.md5(json.dumps(s, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]

    # تقسيم حتمي بحسب نص الجملة (لا يتسرّب نفس النص بين المجموعات)
    def bucket(s):
        h = int(hashlib.md5(s["text"].encode()).hexdigest(), 16) % 100
        return "train" if h < 80 else "val" if h < 90 else "test"
    splits = collections.defaultdict(list)
    for s in samples: splits[bucket(s)].append(s)
    for name, rows in splits.items():
        rng.shuffle(rows)
        with open(f"{OUT}/{name}.jsonl", "w", encoding="utf-8") as f:
            for r in rows: f.write(json.dumps(r, ensure_ascii=False) + "\n")

    SYSTEM = ("أنت وكيل منارة. حوّل أمر المستخدم (صوتي أو كتابي) إلى JSON واحد: "
              "{intent, slots, action, requires_confirmation}. التزم بصلاحيات الدور. لا تشرح.")
    with open(f"{OUT}/finetune_chat.jsonl", "w", encoding="utf-8") as f:
        for r in splits["train"]:
            out = dict(intent=r["intent"], slots=r["slots"], action=r["action"], requires_confirmation=r["requires_confirmation"])
            f.write(json.dumps({"messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": f"[الدور: {r['role']}] [{r['channel']}] {r['text']}"},
                {"role": "assistant", "content": json.dumps(out, ensure_ascii=False)}]}, ensure_ascii=False) + "\n")

    json.dump({"intents": {k: dict(roles=v["roles"], action=v["action"], slots=v["slots"], requires_confirmation=v["confirm"])
                           for k, v in INTENTS.items()},
               "pages": {k: dict(roles=v[0]) for k, v in PAGES.items()}, "role_prefix": ROLE_PREFIX},
              open(f"{OUT}/catalog.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    stats = dict(total=len(samples), splits={k: len(v) for k, v in splits.items()},
                 intents=dict(collections.Counter(s["intent"] for s in samples)),
                 channels=dict(collections.Counter(s["channel"] for s in samples)),
                 roles=dict(collections.Counter(s["role"] for s in samples)))
    json.dump(stats, open(f"{OUT}/stats.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

# بيانات تدريب وكيل منارة

أمر صوتي/كتابي ← (نية + متغيرات + إجراء) في خطوة واحدة، بحسب دور المستخدم.

```bash
python ai_agent/build_dataset.py --per-intent 400   # توليد
python ai_agent/validate_dataset.py                 # تحقق
```

- `backend/tenant_modules/agent/action_catalog.py`: مصدر الحقيقة (النوايا، المرادفات، الأسماء، القيم). أضف نية جديدة هنا ثم أعد التوليد.
- `data/train|val|test.jsonl`: تصنيف + slots (نموذج صغير سريع).
- `data/finetune_chat.jsonl`: نفس train بصيغة messages لضبط LLM يُخرج JSON.
- `data/catalog.json`: الإجراءات التي ينفّذها الواجهة (navigate / api / ui).

## للسرعة القصوى
1. الصوت: Web Speech API (`ar-SA`) في المتصفح، بلا رفع صوت للخادم.
2. مسار سريع: قواعد/نموذج صغير للنوايا الشائعة (<50ms)، والـ LLM فقط عند ضعف الثقة.
3. `requires_confirmation=true` للحذف والاستبدال والموافقة الجماعية والخروج.
4. الصلاحيات تُفحَص في الخادم أيضاً، لا في النموذج وحده.

ملاحظة: البيانات اصطناعية (قوالب + تشويش ASR). قبل الإنتاج أضف أوامر حقيقية من المعلمين والمدراء وأسماء الطلاب/الحلقات الفعلية.

## الربط بالمنصة
- الخادم: `backend/tenant_modules/agent` (POST `/api/agent/command/`)، النموذج `manara_agent.joblib` بجانبه. أعد التدريب بـ `python ai_agent/train_agent.py` وسيُحفظ هناك.
- الواجهة: `frontend/src/component/agent/AgentCommandButton.jsx` داخل MainLayout.

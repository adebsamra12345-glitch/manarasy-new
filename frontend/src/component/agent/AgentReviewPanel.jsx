import React, { useCallback, useState } from 'react';
import { CheckCircle, XCircle, ListMagnifyingGlass } from '@phosphor-icons/react';
import { getAgentReviewQueue, reviewAgentMessage } from '../../services/api/agentService';

/**
 * مراجعة ردود المساعد (مدير المسجد): الأسوأ أولاً (👎 ثم الأعطال).
 * المعتمَد فقط (بعد استبدال أسماء الأشخاص) يدخل في تحسين النموذج؛ الرد المصحَّح اختياري.
 */
const AgentReviewPanel = () => {
    const [items, setItems] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [fixes, setFixes] = useState({});

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setItems(await getAgentReviewQueue());
        } catch (err) {
            setError(err.response?.data?.message || 'تعذر تحميل قائمة المراجعة');
        } finally {
            setLoading(false);
        }
    }, []);

    const decide = async (id, status) => {
        try {
            await reviewAgentMessage(id, status, status === 'approved' ? fixes[id] || '' : '');
            setItems((prev) => prev.filter((i) => i.id !== id));
        } catch (err) {
            setError(err.response?.data?.message || 'تعذر حفظ المراجعة');
        }
    };

    return (
        <div className="settings-card" style={{ marginTop: '1.5rem' }}>
            <div className="settings-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ListMagnifyingGlass size={20} weight="fill" /> مراجعة ردود المساعد
                </label>
                <p style={{ margin: '4px 0 12px', lineHeight: 1.7 }}>
                    تظهر هنا فقط المحادثات التي بدأت بعد موافقة المسجد. اعتمد الرد الصحيح، أو صحّحه ثم اعتمده، أو ارفضه.
                </p>
                {items === null && (
                    <button type="button" className="settings-btn primary" onClick={load} disabled={loading}>
                        {loading ? 'جارٍ التحميل...' : 'عرض الردود المنتظرة'}
                    </button>
                )}
            </div>
            {error && <div className="settings-feedback error" role="alert">{error}</div>}
            {items && items.length === 0 && <p>لا توجد ردود منتظرة للمراجعة.</p>}
            {items && items.map((it) => (
                <div key={it.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
                    <div><strong>المستخدم:</strong> {it.user_text}</div>
                    <div><strong>المساعد:</strong> {it.assistant_text}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                        {it.rating_score < 0 ? '👎 تقييم سلبي' : it.rating_score > 0 ? '👍 تقييم إيجابي' : 'بلا تقييم'}
                        {it.outcome ? ` • ${it.outcome}` : ''}
                    </div>
                    <textarea
                        className="settings-input"
                        rows={2}
                        placeholder="الرد الصحيح (اختياري، يُستخدم بدل رد المساعد عند الاعتماد)"
                        value={fixes[it.id] || ''}
                        onChange={(e) => setFixes((f) => ({ ...f, [it.id]: e.target.value }))}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="settings-btn primary" onClick={() => decide(it.id, 'approved')}>
                            <CheckCircle size={18} /> اعتماد
                        </button>
                        <button type="button" className="settings-btn" onClick={() => decide(it.id, 'rejected')}>
                            <XCircle size={18} /> رفض
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AgentReviewPanel;

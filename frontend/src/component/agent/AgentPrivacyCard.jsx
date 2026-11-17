import React, { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { getAgentSettings, setAgentTrainingConsent } from '../../services/api/agentService';

/**
 * بطاقة خصوصية المساعد الذكي (مدير المسجد): موافقة استخدام المحادثات لتحسين المساعد.
 * تُحفظ المحادثات 180 يوماً بعد إخفاء البيانات الشخصية؛ الموافقة شرط للتصدير للتدريب.
 */
const AgentPrivacyCard = () => {
    const [consent, setConsent] = useState(null);
    const [days, setDays] = useState(180);
    const [saving, setSaving] = useState(false);
    const [note, setNote] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getAgentSettings()
            .then((d) => {
                if (cancelled) return;
                setConsent(Boolean(d.training_consent));
                setDays(d.retention_days || 180);
            })
            .catch(() => !cancelled && setNote({ type: 'error', text: 'تعذر تحميل إعدادات خصوصية المساعد' }));
        return () => { cancelled = true; };
    }, []);

    const toggle = async (e) => {
        const next = e.target.checked;
        setSaving(true);
        setNote(null);
        try {
            const d = await setAgentTrainingConsent(next);
            setConsent(Boolean(d.training_consent));
            setNote({ type: 'success', text: next ? 'تم تفعيل الموافقة' : 'تم إيقاف الموافقة' });
        } catch (err) {
            setNote({ type: 'error', text: err.response?.data?.message || 'تعذر حفظ الإعداد' });
        } finally {
            setSaving(false);
        }
    };

    if (consent === null && !note) return null;

    return (
        <div className="settings-card" style={{ marginTop: '1.5rem' }}>
            <div className="settings-field">
                <label htmlFor="agent-consent" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={20} weight="fill" /> خصوصية المساعد الذكي
                </label>
                <p style={{ margin: '4px 0 12px', lineHeight: 1.7 }}>
                    تُحفظ محادثات المعلمين مع المساعد لمدة {days} يوماً بعد إخفاء الأرقام والبريد والهويات، ثم تُحذف تلقائياً.
                    عند الموافقة تُستخدم الأدوار التي يراجعها فريق المنصة، بعد استبدال أسماء الأشخاص برموز، لتحسين دقة المساعد.
                    لا تُستخدم أي محادثة بدأت قبل الموافقة.
                </p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                        id="agent-consent"
                        type="checkbox"
                        checked={Boolean(consent)}
                        disabled={saving || consent === null}
                        onChange={toggle}
                    />
                    أوافق على استخدام محادثات مسجدي لتحسين المساعد
                </label>
            </div>
            {note && (
                <div className={`settings-feedback ${note.type}`} role={note.type === 'error' ? 'alert' : 'status'}>
                    {note.type === 'success' ? <CheckCircle size={20} weight="fill" /> : <WarningCircle size={20} weight="fill" />}
                    {note.text}
                </div>
            )}
        </div>
    );
};

export default AgentPrivacyCard;

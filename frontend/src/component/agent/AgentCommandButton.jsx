import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Microphone, PaperPlaneRight, X, Sparkle } from '@phosphor-icons/react';
import { useAuthContext } from '../../context/AuthContext';
import { sendAgentCommand } from '../../services/api/agentService';
import './agentCommand.css';

const PREFIX = { tenant_admin: '/admin', center_manager: '/center-manager', teacher: '/teacher', student: '/student' };

// أوامر الكتابة (حضور، تسميع، نقاط…) لا تُنفَّذ تلقائياً: نفتح الصفحة المناسبة لإكمالها بأمان
const FALLBACK_PAGE = {
    mark_attendance: 'attendance', mark_all_present: 'attendance', start_session: 'attendance',
    evaluate_recitation: 'recitation', evaluate_recitation_range: 'recitation',
    grant_bonus_points: 'rewards', show_points_transactions: 'rewards', show_reward_claims: 'rewards',
    create_competition: 'rewards', redeem_reward: 'dashboard', show_my_points: 'dashboard',
    mark_notifications_read: 'notifications', start_competition: 'competitions',
    add_student: 'students', search_student: 'students', delete_student_request: 'students',
    approve_requests: 'students', show_requests: 'students', generate_certificate: 'reports',
    show_analytics: 'reports', change_password: 'profile', switch_role: 'profile', open_ai_assistant: 'dashboard',
};

const AgentCommandButton = () => {
    const { role, logout } = useAuthContext();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [listening, setListening] = useState(false);
    const [msg, setMsg] = useState(null);
    const [pending, setPending] = useState(null);
    const [choices, setChoices] = useState(null);
    const recRef = useRef(null);
    const prefix = PREFIX[(role || '').toLowerCase()];
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

    const execute = useCallback((res) => {
        if (res.intent === 'logout') { logout(); return; }
        let route = res.action?.type === 'navigate' ? res.action.route : null;
        if (!route && prefix && FALLBACK_PAGE[res.intent]) {
            route = `${prefix}/${FALLBACK_PAGE[res.intent]}`;
            setMsg({ kind: 'info', text: 'فهمت الأمر وفتحت الصفحة المناسبة لإكماله.' });
        } else if (route) {
            setMsg({ kind: 'ok', text: 'تم.' });
        }
        if (route) { navigate(route); setText(''); setTimeout(() => setOpen(false), 700); }
    }, [navigate, prefix, logout]);

    const run = useCallback(async (value, channel = 'text') => {
        const q = (value || '').trim();
        if (!q) return;
        setBusy(true); setMsg(null); setChoices(null); setPending(null);
        try {
            const res = await sendAgentCommand(q, channel);
            if (res.needs_choice) { setChoices({ res, list: res.candidates }); setMsg({ kind: 'info', text: res.action.message }); }
            else if (res.action?.type === 'reply') setMsg({ kind: res.intent === 'permission_denied' ? 'err' : 'info', text: res.action.message });
            else if (res.requires_confirmation) { setPending(res); setMsg({ kind: 'info', text: 'هذا إجراء حساس، هل تؤكد التنفيذ؟' }); }
            else execute(res);
        } catch {
            setMsg({ kind: 'err', text: 'تعذّر الاتصال بالمساعد.' });
        } finally { setBusy(false); }
    }, [execute]);

    const toggleMic = () => {
        if (!SR) { setMsg({ kind: 'err', text: 'متصفحك لا يدعم الإدخال الصوتي، اكتب الأمر.' }); return; }
        if (listening) { recRef.current?.stop(); return; }
        const rec = new SR();
        rec.lang = 'ar-SA'; rec.interimResults = true; rec.maxAlternatives = 1;
        rec.onresult = (ev) => {
            const t = Array.from(ev.results).map((r) => r[0].transcript).join(' ');
            setText(t);
            if (ev.results[ev.results.length - 1].isFinal) run(t, 'voice');
        };
        rec.onerror = () => { setListening(false); setMsg({ kind: 'err', text: 'لم أسمعك جيداً، حاول مجدداً.' }); };
        rec.onend = () => setListening(false);
        recRef.current = rec; setMsg(null); setListening(true); rec.start();
    };

    useEffect(() => () => recRef.current?.abort?.(), []);
    if (!prefix) return null;

    return (
        <>
            <button className="agent-fab" onClick={() => setOpen((o) => !o)} aria-label="مساعد منارة">
                {open ? <X size={24} weight="bold" /> : <Sparkle size={24} weight="fill" />}
            </button>
            {open && (
                <div className="agent-panel" dir="rtl" role="dialog" aria-label="أوامر منارة">
                    <div className="agent-title">مساعد منارة</div>
                    <form className="agent-row" onSubmit={(e) => { e.preventDefault(); run(text); }}>
                        <button type="button" className={`agent-mic ${listening ? 'on' : ''}`} onClick={toggleMic} aria-label="تحدّث">
                            <Microphone size={20} weight="fill" />
                        </button>
                        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={listening ? 'أستمع إليك…' : 'اكتب أو قل أمرك: افتح التسميع'} autoFocus />
                        <button type="submit" className="agent-send" disabled={busy || !text.trim()} aria-label="إرسال"><PaperPlaneRight size={18} weight="fill" /></button>
                    </form>
                    {msg && <div className={`agent-msg ${msg.kind}`}>{msg.text}</div>}
                    {choices && choices.list.map((c) => (
                        <button key={c.id} className="agent-choice" onClick={() => { const r = choices.res; setChoices(null); if (c.route) { setMsg({ kind: 'ok', text: 'تم.' }); navigate(c.route); setText(''); setTimeout(() => setOpen(false), 700); } else execute(r); }}>
                            {c.name}{c.halaqa ? ` — ${c.halaqa}` : ''}
                        </button>
                    ))}
                    {pending && (
                        <div className="agent-confirm">
                            <button onClick={() => { const p = pending; setPending(null); execute(p); }}>نعم، نفّذ</button>
                            <button className="ghost" onClick={() => { setPending(null); setMsg(null); }}>إلغاء</button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default AgentCommandButton;

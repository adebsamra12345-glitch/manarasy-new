import { useEffect, useState } from 'react';
import { Check, Copy, Warning } from '@phosphor-icons/react';
import { createMosque, getPlatformPlans } from '../../services/platformService';
import { extractApiError } from '../../services/api/registrationService';
import { useNotification } from '../../context/NotificationContext';
import PlatformModal from './PlatformModal';

const EMPTY = {
    mosque_name: '', subdomain: '', contact_phone: '', contact_email: '',
    admin_username: 'manager', admin_full_name: '', admin_password: '', plan_id: '',
};

/** إضافة مسجد وتعيين مسؤوله مباشرة من الأدمن العام — دون مسار الدفع */
const AddMosqueModal = ({ onClose, onCreated }) => {
    const { addNotification } = useNotification();
    const [form, setForm] = useState(EMPTY);
    const [plans, setPlans] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        getPlatformPlans().then((r) => setPlans(r.data || [])).catch(() => setPlans([]));
    }, []);

    const set = (name) => (e) => {
        const value = name === 'subdomain' ? e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') : e.target.value;
        setForm((f) => ({ ...f, [name]: value }));
        setError('');
    };

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const payload = {
                ...form,
                plan_id: form.plan_id ? Number(form.plan_id) : null,
                admin_password: form.admin_password || '',     // فارغة ⇒ يولّد الخادم كلمة مرور قوية
            };
            const res = await createMosque(payload);
            setResult(res.data);
            onCreated();
        } catch (err) {
            setError(extractApiError(err, 'تعذّر إنشاء المسجد'));
        } finally {
            setBusy(false);
        }
    };

    const copyCreds = async () => {
        const text = `الرابط: ${result.subdomain}.manarasy.com\nاسم المستخدم: ${result.admin_username}\nكلمة المرور: ${result.generated_password || '(التي أدخلتها)'}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            addNotification('تم نسخ بيانات الدخول', 'success');
        } catch {
            addNotification('تعذّر النسخ، انسخ يدوياً', 'error');
        }
    };

    if (result) {
        return (
            <PlatformModal title="تم إنشاء المسجد" onClose={onClose}
                footer={<button type="button" className="pl-btn primary" onClick={onClose}>إغلاق</button>}>
                <div className="pl-alert ok">{result.request_status === 'PROVISIONING' ? 'بدأ تجهيز المسجد في الخلفية.' : 'تم تجهيز المسجد وتعيين مسؤوله.'}</div>
                <div className="pl-creds" dir="ltr">
                    <div><span>URL</span><b>{result.subdomain}.manarasy.com</b></div>
                    <div><span>Username</span><b>{result.admin_username}</b></div>
                    <div><span>Password</span><b>{result.generated_password || '(as entered)'}</b></div>
                </div>
                {result.generated_password && (
                    <p className="pl-muted sm"><Warning size={14} /> كلمة المرور تظهر هنا مرة واحدة فقط ولا تُحفظ نصياً. انسخها الآن وسلّمها للمسؤول.</p>
                )}
                <button type="button" className="pl-btn ghost" onClick={copyCreds}>
                    {copied ? <Check size={16} /> : <Copy size={16} />} نسخ بيانات الدخول
                </button>
            </PlatformModal>
        );
    }

    return (
        <PlatformModal title="إضافة مسجد جديد" onClose={onClose} busy={busy} wide>
            <form onSubmit={submit} className="pl-form-grid" noValidate>
                <label className="pl-field"><span>اسم المسجد *</span>
                    <input required value={form.mosque_name} onChange={set('mosque_name')} maxLength={150} /></label>
                <label className="pl-field"><span>النطاق الفرعي *</span>
                    <input required dir="ltr" value={form.subdomain} onChange={set('subdomain')} maxLength={30} placeholder="alhuda" /></label>
                <label className="pl-field"><span>هاتف التواصل *</span>
                    <input required dir="ltr" value={form.contact_phone} onChange={set('contact_phone')} maxLength={20} /></label>
                <label className="pl-field"><span>البريد الإلكتروني</span>
                    <input type="email" dir="ltr" value={form.contact_email} onChange={set('contact_email')} /></label>

                <fieldset className="pl-fieldset full">
                    <legend>مسؤول المسجد (Tenant Admin)</legend>
                    <div className="pl-form-grid">
                        <label className="pl-field"><span>اسم المستخدم</span>
                            <input dir="ltr" value={form.admin_username} onChange={set('admin_username')} maxLength={30} /></label>
                        <label className="pl-field"><span>الاسم الكامل</span>
                            <input value={form.admin_full_name} onChange={set('admin_full_name')} maxLength={150} /></label>
                        <label className="pl-field full"><span>كلمة المرور (اتركها فارغة لتوليد كلمة قوية تلقائياً)</span>
                            <input type="password" dir="ltr" autoComplete="new-password" value={form.admin_password} onChange={set('admin_password')} /></label>
                    </div>
                </fieldset>

                <label className="pl-field full"><span>خطة الاشتراك (اختياري — بدون دفع)</span>
                    <select value={form.plan_id} onChange={set('plan_id')}>
                        <option value="">بدون اشتراك</option>
                        {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — ${p.price_usd}</option>)}
                    </select></label>

                {error && <div className="pl-alert error full" role="alert"><Warning size={16} /> {error}</div>}

                <div className="pl-actions full">
                    <button type="button" className="pl-btn ghost" onClick={onClose} disabled={busy}>إلغاء</button>
                    <button className="pl-btn primary" disabled={busy || !form.mosque_name || !form.subdomain || !form.contact_phone}>
                        {busy ? 'جارٍ إنشاء قاعدة البيانات…' : 'إنشاء المسجد'}
                    </button>
                </div>
            </form>
        </PlatformModal>
    );
};

export default AddMosqueModal;

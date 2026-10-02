import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UploadSimple, Trash, FloppyDisk, Lock, Image as ImageIcon, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { getTenantSettings, updateTenantSettings } from '../../../services/api/tenantService';
import './adminSettings.css';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_NAME_LENGTH = 150;

const AdminSettings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text }

    const [saved, setSaved] = useState({ name: '', subdomain: '', logo_url: null });
    const [name, setName] = useState('');
    const [logoFile, setLogoFile] = useState(null);
    const [removeLogo, setRemoveLogo] = useState(false);
    const fileInputRef = useRef(null);

    const applySaved = (data) => {
        setSaved(data);
        setName(data.name);
        setLogoFile(null);
        setRemoveLogo(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    useEffect(() => {
        let cancelled = false;
        getTenantSettings()
            .then((res) => { if (!cancelled) applySaved(res.data); })
            .catch((err) => {
                if (!cancelled) setLoadError(err.response?.data?.message || 'تعذر تحميل إعدادات المسجد');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    // معاينة الملف المختار قبل الحفظ
    const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile]);
    useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!ALLOWED_TYPES.includes(file.type)) {
            setFeedback({ type: 'error', text: 'نوع الملف غير مدعوم. الأنواع المسموحة: PNG, JPG, WEBP' });
            e.target.value = '';
            return;
        }
        if (file.size > MAX_LOGO_BYTES) {
            setFeedback({ type: 'error', text: 'حجم الشعار يجب ألا يتجاوز 2 ميجابايت' });
            e.target.value = '';
            return;
        }
        setFeedback(null);
        setRemoveLogo(false);
        setLogoFile(file);
    };

    const handleRemoveLogo = () => {
        setLogoFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (saved.logo_url) setRemoveLogo(true);
    };

    const currentLogo = removeLogo ? null : (logoPreview || saved.logo_url);
    const trimmedName = name.trim();
    const dirty = trimmedName !== saved.name || !!logoFile || removeLogo;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!trimmedName) {
            setFeedback({ type: 'error', text: 'اسم المسجد مطلوب' });
            return;
        }
        setSaving(true);
        setFeedback(null);
        try {
            const formData = new FormData();
            formData.append('name', trimmedName);
            if (logoFile) formData.append('logo', logoFile);
            else if (removeLogo) formData.append('remove_logo', 'true');

            const res = await updateTenantSettings(formData);
            applySaved(res.data);
            // مزامنة الاسم المخزن محلياً ليظهر فوراً في بقية الواجهات
            localStorage.setItem('tenant_name', res.data.name);
            setFeedback({ type: 'success', text: res.message || 'تم حفظ إعدادات المسجد بنجاح' });
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'تعذر حفظ الإعدادات، يرجى المحاولة لاحقاً' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="settings-page"><p className="settings-muted">جارٍ تحميل الإعدادات...</p></div>;
    }
    if (loadError) {
        return (
            <div className="settings-page">
                <div className="settings-feedback error" role="alert"><WarningCircle size={20} />{loadError}</div>
            </div>
        );
    }

    return (
        <div className="settings-page">
            <div className="page-title">
                <h2>الإعدادات</h2>
            </div>

            <form className="settings-card" onSubmit={handleSubmit}>
                <div className="settings-field">
                    <label htmlFor="mosque-name">اسم المسجد</label>
                    <input
                        id="mosque-name"
                        type="text"
                        className="settings-input"
                        value={name}
                        maxLength={MAX_NAME_LENGTH}
                        onChange={(e) => { setName(e.target.value); setFeedback(null); }}
                        placeholder="اسم المسجد"
                    />
                </div>

                <div className="settings-field">
                    <label htmlFor="mosque-subdomain">النطاق الفرعي</label>
                    <div className="settings-readonly-wrap">
                        <Lock size={18} />
                        <input
                            id="mosque-subdomain"
                            type="text"
                            className="settings-input readonly"
                            value={saved.subdomain}
                            readOnly
                            disabled
                            dir="ltr"
                        />
                    </div>
                    <span className="settings-hint">للعرض فقط ولا يمكن تعديله.</span>
                </div>

                <div className="settings-field">
                    <label>شعار المسجد</label>
                    <div className="settings-logo-row">
                        <div className="settings-logo-preview">
                            {currentLogo
                                ? <img src={currentLogo} alt="شعار المسجد" />
                                : <ImageIcon size={36} />}
                        </div>
                        <div className="settings-logo-actions">
                            <input
                                ref={fileInputRef}
                                id="mosque-logo"
                                type="file"
                                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                                onChange={handleFileChange}
                                hidden
                            />
                            <button type="button" className="settings-btn secondary" onClick={() => fileInputRef.current?.click()}>
                                <UploadSimple size={18} />
                                {currentLogo ? 'استبدال الشعار' : 'رفع شعار'}
                            </button>
                            {currentLogo && (
                                <button type="button" className="settings-btn danger" onClick={handleRemoveLogo}>
                                    <Trash size={18} />
                                    حذف الشعار
                                </button>
                            )}
                            <span className="settings-hint">PNG أو JPG أو WEBP، بحجم أقصاه 2 ميجابايت.</span>
                        </div>
                    </div>
                </div>

                {feedback && (
                    <div className={`settings-feedback ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
                        {feedback.type === 'success' ? <CheckCircle size={20} weight="fill" /> : <WarningCircle size={20} weight="fill" />}
                        {feedback.text}
                    </div>
                )}

                <div className="settings-footer">
                    <button type="submit" className="settings-btn primary" disabled={saving || !dirty}>
                        <FloppyDisk size={18} />
                        {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AdminSettings;

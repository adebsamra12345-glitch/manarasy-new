import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Mosque, ListChecks, CreditCard, CheckCircle,
    Eye, EyeSlash, CaretRight, CaretLeft, Sparkle,
    Check, Star, Robot, Warning, Hourglass, ArrowsClockwise,
} from '@phosphor-icons/react';
import {
    createRegistration, extractApiError, getPlans, getRegistrationStatus, uploadReceipt,
} from '../../../services/api/registrationService';
import { validateReceiptFile } from '../../../utils/receiptValidation';
import ShamCashPayment from './ShamCashPayment';

const STEPS = [
    { id: 1, label: 'معلومات المسجد', icon: Mosque },
    { id: 2, label: 'خطة الاشتراك', icon: ListChecks },
    { id: 3, label: 'الدفع (شام كاش)', icon: CreditCard },
    { id: 4, label: 'قيد المراجعة', icon: CheckCircle },
];

// حفظ مرجع الطلب مؤقتاً (للجلسة فقط) كي لا يُنشأ طلب مكرر إذا فشل رفع الإشعار أو أُعيد تحميل الصفحة
const PENDING_KEY = 'manara_pending_registration';
const readPending = () => {
    try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch { return null; }
};
const writePending = (value) => {
    try {
        if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
        else sessionStorage.removeItem(PENDING_KEY);
    } catch { /* التخزين غير متاح — نتجاهل */ }
};

const STATUS_TEXT = {
    PENDING_PAYMENT: 'بانتظار إشعار الدفع',
    PENDING_APPROVAL: 'قيد المراجعة من فريق المنصة',
    PROVISIONING: 'جارٍ تجهيز قاعدة بيانات مسجدك',
    APPROVED: 'تمت الموافقة — مسجدك جاهز',
    REJECTED: 'تم رفض الطلب',
    PROVISIONING_FAILED: 'تعذّر تجهيز المسجد، سيتواصل معك الفريق',
};

const Register = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [resultData, setResultData] = useState(null);

    // Step 1: Mosque info
    const [mosqueForm, setMosqueForm] = useState({
        name: '',
        subdomain: '',
        contact_phone: '',
        contact_email: '',
        admin_password: '',
        confirm_password: '',
    });
    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);

    // Step 2: Plan selection
    const [selectedPlanId, setSelectedPlanId] = useState(null);

    // Step 3: Sham Cash receipt
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptRef, setReceiptRef] = useState('');
    const [uploadProgress, setUploadProgress] = useState(null);

    // مرجع الطلب بعد إنشائه (id + upload_token)
    const registrationRef = useRef(readPending());
    const [refreshing, setRefreshing] = useState(false);

    const selectedPlan = plans.find(p => p.id === selectedPlanId);

    const fetchPlans = useCallback(async () => {
        try {
            const data = await getPlans();
            if (data.status === 'success') {
                setPlans(data.data);
                if (data.data.length > 0) setSelectedPlanId(prev => prev ?? data.data[0].id);
            }
        } catch {
            setError('تعذّر تحميل خطط الاشتراك، حدّث الصفحة وحاول مجدداً');
        } finally {
            setLoadingPlans(false);
        }
    }, []);

    useEffect(() => { fetchPlans(); }, [fetchPlans]);

    // استعادة صفحة "قيد المراجعة" بعد إعادة تحميل الصفحة
    useEffect(() => {
        const saved = registrationRef.current;
        if (saved?.submitted) {
            setResultData({ mosque_name: saved.mosque_name, subdomain: saved.subdomain, plan: saved.plan, status: saved.status });
            setStep(4);
        } else if (saved?.id) {
            // طلب أُنشئ لكن لم يكتمل رفع الإشعار: نكمل من خطوة الدفع دون إنشاء طلب جديد
            setSelectedPlanId(saved.plan_id ?? null);
            setStep(3);
            setError('لديك طلب سابق لم يكتمل رفع إشعار الدفع له. ارفع الإشعار لإكمال الطلب.');
        }
    }, []);

    const handleMosqueChange = (e) => {
        const { name, value } = e.target;
        // نطاق فرعي صالح DNS: أحرف إنجليزية صغيرة وأرقام وشرطة فقط
        const cleaned = name === 'subdomain' ? value.toLowerCase().replace(/[^a-z0-9-]/g, '') : value;
        setMosqueForm(prev => ({ ...prev, [name]: cleaned }));
        setError('');
    };

    const validateStep1 = () => {
        const f = mosqueForm;
        if (!f.name.trim()) return 'اسم المسجد مطلوب';
        if (!f.subdomain.trim()) return 'النطاق الفرعي مطلوب';
        if (!/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(f.subdomain)) {
            return 'النطاق الفرعي: 3–30 حرفاً إنجليزياً صغيراً أو أرقاماً أو شرطة، ويبدأ بحرف';
        }
        if (!f.contact_phone.trim()) return 'رقم هاتف التواصل مطلوب';
        if (!/^\+?[0-9][0-9 ()-]{6,18}[0-9]$/.test(f.contact_phone.trim())) return 'رقم الهاتف غير صالح';
        if (!f.admin_password) return 'كلمة المرور مطلوبة';
        if (f.admin_password.length < 8) return 'كلمة المرور يجب أن لا تقل عن 8 أحرف';
        if (f.admin_password !== f.confirm_password) return 'كلمتا المرور غير متطابقتين';
        return '';
    };

    const handleNext = async () => {
        setError('');
        if (step === 1) {
            const err = validateStep1();
            if (err) { setError(err); return; }
        }
        if (step === 2 && !selectedPlanId) { setError('يرجى اختيار خطة اشتراك'); return; }
        if (step === 3) { await handleSubmit(); return; }
        setStep(s => s + 1);
    };

    const handleSubmit = async () => {
        setError('');
        const fileErr = await validateReceiptFile(receiptFile);
        if (fileErr) { setError(fileErr); return; }

        setSubmitting(true);
        setUploadProgress(null);
        try {
            // 1) إنشاء الطلب مرة واحدة فقط (إن نجح سابقاً وفشل الرفع نعيد استخدام المرجع)
            let ref = registrationRef.current;
            if (!ref?.id) {
                const res = await createRegistration({
                    mosque_name: mosqueForm.name.trim(),
                    subdomain: mosqueForm.subdomain,
                    contact_phone: mosqueForm.contact_phone.trim(),
                    contact_email: mosqueForm.contact_email.trim(),
                    admin_password: mosqueForm.admin_password,
                    plan_id: selectedPlanId,
                });
                ref = {
                    id: res.data.id, token: res.data.upload_token,
                    mosque_name: mosqueForm.name.trim(), subdomain: res.data.subdomain, plan: selectedPlan?.name,
                    plan_id: selectedPlanId,
                };
                registrationRef.current = ref;
                writePending(ref);
            }

            // 2) رفع الإشعار
            const up = await uploadReceipt(ref.id, ref.token, receiptFile, receiptRef.trim(), setUploadProgress);
            ref = { ...ref, submitted: true, status: up.data?.status || 'PENDING_APPROVAL' };
            registrationRef.current = ref;
            writePending(ref);

            setResultData({ mosque_name: ref.mosque_name, subdomain: ref.subdomain, plan: ref.plan, status: ref.status });
            setStep(4);
        } catch (err) {
            setError(extractApiError(err));
        } finally {
            setSubmitting(false);
            setUploadProgress(null);
        }
    };

    const refreshStatus = async () => {
        const ref = registrationRef.current;
        if (!ref?.id) return;
        setRefreshing(true);
        try {
            const res = await getRegistrationStatus(ref.id, ref.token);
            const next = { ...ref, status: res.data.status, rejection_reason: res.data.rejection_reason };
            registrationRef.current = next;
            writePending(next);
            setResultData(prev => ({ ...prev, status: res.data.status, rejection_reason: res.data.rejection_reason }));
        } catch (err) {
            setError(extractApiError(err));
        } finally {
            setRefreshing(false);
        }
    };

    const startOver = () => {
        writePending(null);
        registrationRef.current = null;
        setResultData(null);
        setReceiptFile(null);
        setReceiptRef('');
        setStep(1);
    };

    return (
        <div className="register-page">
            {/* Brand header */}
            <div className="register-top-bar">
                <div className="register-brand">
                    <span className="register-brand-icon">✦</span>
                    <span className="register-brand-name">مَنَارَة</span>
                </div>
                <button className="register-login-link" onClick={() => navigate('/login')}>
                    لديك حساب؟ سجل الدخول
                </button>
            </div>

            <div className="register-content">
                {/* Progress Stepper */}
                {step < 4 && (
                    <div className="register-stepper">
                        {STEPS.slice(0, 3).map((s, idx) => {
                            const Icon = s.icon;
                            const isActive = step === s.id;
                            const isDone = step > s.id;
                            return (
                                <React.Fragment key={s.id}>
                                    <div className={`stepper-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                                        <div className="stepper-circle">
                                            {isDone ? <Check size={18} weight="bold" /> : <Icon size={20} />}
                                        </div>
                                        <span className="stepper-label">{s.label}</span>
                                    </div>
                                    {idx < 2 && <div className={`stepper-line ${isDone ? 'done' : ''}`}></div>}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}

                {/* Step 1: Mosque Info */}
                {step === 1 && (
                    <div className="register-card">
                        <div className="register-card-header">
                            <Mosque size={28} weight="duotone" className="register-card-icon" />
                            <h2>معلومات المسجد</h2>
                            <p>أدخل بيانات مسجدك الأساسية للبدء في إعداد الحساب</p>
                        </div>

                        <div className="register-form-grid">
                            <div className="register-field">
                                <label>اسم المسجد <span className="req">*</span></label>
                                <input
                                    type="text"
                                    name="name"
                                    value={mosqueForm.name}
                                    onChange={handleMosqueChange}
                                    placeholder="مثال: مسجد الهدى"
                                    className="register-input"
                                />
                            </div>
                            <div className="register-field">
                                <label>النطاق الفرعي (Subdomain) <span className="req">*</span></label>
                                <div className="register-subdomain-wrapper">
                                    <input
                                        type="text"
                                        name="subdomain"
                                        value={mosqueForm.subdomain}
                                        onChange={handleMosqueChange}
                                        placeholder="alhuda"
                                        className="register-input subdomain-input"
                                        dir="ltr"
                                    />
                                    <span className="subdomain-suffix">.manarasy.com</span>
                                </div>
                                {mosqueForm.subdomain && (
                                    <span className="register-hint">سيكون رابط المسجد: {mosqueForm.subdomain}.manarasy.com</span>
                                )}
                            </div>
                            <div className="register-field">
                                <label>رقم التواصل <span className="req">*</span></label>
                                <input
                                    type="tel"
                                    name="contact_phone"
                                    value={mosqueForm.contact_phone}
                                    onChange={handleMosqueChange}
                                    placeholder="+963 912 345 678"
                                    className="register-input"
                                    dir="ltr"
                                />
                            </div>
                            <div className="register-field">
                                <label>البريد الإلكتروني (اختياري)</label>
                                <input
                                    type="email"
                                    name="contact_email"
                                    value={mosqueForm.contact_email}
                                    onChange={handleMosqueChange}
                                    placeholder="info@mosque.com"
                                    className="register-input"
                                    dir="ltr"
                                />
                            </div>
                            <div className="register-field">
                                <label>كلمة مرور حساب المدير <span className="req">*</span></label>
                                <div className="register-pass-wrapper">
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        name="admin_password"
                                        value={mosqueForm.admin_password}
                                        onChange={handleMosqueChange}
                                        placeholder="8 أحرف على الأقل"
                                        className="register-input"
                                    />
                                    <button type="button" className="register-eye-btn" onClick={() => setShowPass(!showPass)}>
                                        {showPass ? <EyeSlash size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="register-field">
                                <label>تأكيد كلمة المرور <span className="req">*</span></label>
                                <div className="register-pass-wrapper">
                                    <input
                                        type={showConfirmPass ? 'text' : 'password'}
                                        name="confirm_password"
                                        value={mosqueForm.confirm_password}
                                        onChange={handleMosqueChange}
                                        placeholder="أعد إدخال كلمة المرور"
                                        className="register-input"
                                    />
                                    <button type="button" className="register-eye-btn" onClick={() => setShowConfirmPass(!showConfirmPass)}>
                                        {showConfirmPass ? <EyeSlash size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Plan Selection */}
                {step === 2 && (
                    <div className="register-card">
                        <div className="register-card-header">
                            <ListChecks size={28} weight="duotone" className="register-card-icon" />
                            <h2>اختر خطة الاشتراك</h2>
                            <p>اختر الخطة المناسبة لاحتياجات مسجدك</p>
                        </div>

                        {loadingPlans ? (
                            <div className="plans-loading">
                                <div className="plan-card-skeleton"></div>
                                <div className="plan-card-skeleton"></div>
                            </div>
                        ) : (
                            <div className="plans-grid">
                                {plans.map(plan => (
                                    <div
                                        key={plan.id}
                                        className={`plan-card ${selectedPlanId === plan.id ? 'selected' : ''} ${plan.has_ai_features ? 'plan-ai' : ''}`}
                                        onClick={() => setSelectedPlanId(plan.id)}
                                    >
                                        {plan.has_ai_features && (
                                            <div className="plan-popular-badge">الأكثر شمولاً</div>
                                        )}
                                        <div className="plan-card-icon">
                                            {plan.has_ai_features ? <Robot size={32} weight="duotone" /> : <Star size={32} weight="duotone" />}
                                        </div>
                                        <h3 className="plan-name">{plan.name}</h3>
                                        <div className="plan-price">
                                            <span className="plan-amount">${plan.price_usd}</span>
                                            <span className="plan-period">/ {plan.billing_cycle === 'MONTHLY' ? 'شهر' : 'سنة'}</span>
                                        </div>
                                        <ul className="plan-features">
                                            <li><Check size={16} weight="bold" /> إدارة الحلقات القرآنية</li>
                                            <li><Check size={16} weight="bold" /> تسجيل الحضور والجلسات</li>
                                            <li><Check size={16} weight="bold" /> إدارة الطلاب وأولياء الأمور</li>
                                            <li><Check size={16} weight="bold" /> التقارير والشهادات</li>
                                            {plan.has_ai_features && (
                                                <li className="feature-ai"><Sparkle size={16} weight="fill" /> مساعد منارة الذكي بالكامل</li>
                                            )}
                                        </ul>
                                        <div className={`plan-select-indicator ${selectedPlanId === plan.id ? 'checked' : ''}`}>
                                            {selectedPlanId === plan.id && <Check size={16} weight="bold" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Payment — Sham Cash (manual) */}
                {step === 3 && (
                    <div className="register-card">
                        <div className="register-card-header">
                            <CreditCard size={28} weight="duotone" className="register-card-icon" />
                            <h2>إتمام الدفع</h2>
                            <p>حوّل المبلغ عبر شام كاش وارفع إشعار التحويل</p>
                        </div>

                        <ShamCashPayment
                            amount={selectedPlan?.price_usd}
                            planName={selectedPlan?.name}
                            file={receiptFile}
                            onFileChange={setReceiptFile}
                            reference={receiptRef}
                            onReferenceChange={setReceiptRef}
                            uploadProgress={uploadProgress}
                            disabled={submitting}
                        />
                    </div>
                )}

                {/* Step 4: Under review */}
                {step === 4 && (
                    <div className="register-success">
                        <div className="success-icon-circle">
                            {resultData?.status === 'APPROVED'
                                ? <CheckCircle size={64} weight="fill" />
                                : <Hourglass size={64} weight="fill" />}
                        </div>

                        {resultData?.status === 'APPROVED' ? (
                            <>
                                <h2>تمت الموافقة، مسجدك جاهز! 🎉</h2>
                                <p>سجّل الدخول باسم المستخدم <b dir="ltr">manager</b> وكلمة المرور التي اخترتها عند التسجيل</p>
                            </>
                        ) : resultData?.status === 'REJECTED' ? (
                            <>
                                <h2>لم يتم قبول الطلب</h2>
                                <p>{resultData?.rejection_reason || 'يرجى مراجعة بيانات الدفع والتواصل معنا'}</p>
                            </>
                        ) : (
                            <>
                                <h2>تم استلام طلبك وإشعار الدفع</h2>
                                <p>سيراجع فريق المنصة الإشعار وتُفعَّل خدمتك بعد الموافقة. يمكنك إغلاق الصفحة وتفقّد الحالة لاحقاً.</p>
                            </>
                        )}

                        <div className="success-credentials">
                            <h3>تفاصيل الطلب</h3>
                            <div className="cred-row">
                                <span className="cred-label">المسجد</span>
                                <span className="cred-value">{resultData?.mosque_name}</span>
                            </div>
                            <div className="cred-row">
                                <span className="cred-label">رابط المسجد</span>
                                <span className="cred-value" dir="ltr">{resultData?.subdomain}.manarasy.com</span>
                            </div>
                            <div className="cred-row">
                                <span className="cred-label">خطة الاشتراك</span>
                                <span className="cred-value">{resultData?.plan}</span>
                            </div>
                            <div className="cred-row">
                                <span className="cred-label">حالة الطلب</span>
                                <span className="cred-value">{STATUS_TEXT[resultData?.status] || resultData?.status}</span>
                            </div>
                        </div>

                        {resultData?.status === 'APPROVED' ? (
                            <button className="register-btn-primary" onClick={() => { writePending(null); navigate('/login'); }}>
                                الانتقال لتسجيل الدخول
                                <CaretLeft size={18} />
                            </button>
                        ) : resultData?.status === 'REJECTED' ? (
                            <button className="register-btn-primary" onClick={startOver}>
                                تقديم طلب جديد
                            </button>
                        ) : (
                            <button className="register-btn-primary" onClick={refreshStatus} disabled={refreshing}>
                                {refreshing ? <span className="login-spinner"></span> : <><ArrowsClockwise size={18} /> تحديث الحالة</>}
                            </button>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="register-error" role="alert">
                        <Warning size={18} />
                        {error}
                    </div>
                )}

                {/* Navigation Buttons */}
                {step < 4 && (
                    <div className="register-nav">
                        {step > 1 && (
                            <button className="register-btn-back" disabled={submitting} onClick={() => { setStep(s => s - 1); setError(''); }}>
                                <CaretRight size={18} />
                                رجوع
                            </button>
                        )}
                        <button
                            className="register-btn-primary"
                            onClick={handleNext}
                            disabled={submitting || (step === 2 && loadingPlans)}
                        >
                            {submitting ? (
                                <span className="login-spinner"></span>
                            ) : step === 3 ? (
                                <>إرسال الطلب</>
                            ) : (
                                <>التالي <CaretLeft size={18} /></>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Register;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Mosque, ListChecks, CreditCard, CheckCircle,
    Eye, EyeSlash, CaretRight, CaretLeft, Sparkle,
    Check, Star, Robot, Warning
} from '@phosphor-icons/react';
import { getPlans, registerTenant } from '../../../services/api/tenantService';
import { createSubscription, createPayment } from '../../../services/api/paymentService';

const STEPS = [
    { id: 1, label: 'معلومات المسجد', icon: Mosque },
    { id: 2, label: 'خطة الاشتراك', icon: ListChecks },
    { id: 3, label: 'الدفع', icon: CreditCard },
    { id: 4, label: 'التأكيد', icon: CheckCircle },
];

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
        db_name: '',
    });
    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);

    // Step 2: Plan selection
    const [selectedPlanId, setSelectedPlanId] = useState(null);

    // Step 3: Payment
    const [paymentMethod, setPaymentMethod] = useState('CARD');
    const [cardForm, setCardForm] = useState({
        cardNumber: '',
        expiry: '',
        cvv: '',
        cardName: '',
    });
    const [shamCashPhone, setShamCashPhone] = useState('');

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const data = await getPlans();
            if (data.status === 'success') {
                setPlans(data.data);
                if (data.data.length > 0) setSelectedPlanId(data.data[0].id);
            }
        } catch {
            // Use fallback plans if API not available
            setPlans([
                { id: 1, name: 'الخطة الأساسية', code: 'M_BASIC_30', billing_cycle: 'MONTHLY', price_usd: '30.00', has_ai_features: false },
                { id: 2, name: 'خطة الذكاء الاصطناعي', code: 'M_AI_50', billing_cycle: 'MONTHLY', price_usd: '50.00', has_ai_features: true },
            ]);
            setSelectedPlanId(1);
        } finally {
            setLoadingPlans(false);
        }
    };

    // Auto-generate db_name from subdomain
    const handleMosqueChange = (e) => {
        const { name, value } = e.target;
        const cleaned = name === 'subdomain' ? value.toLowerCase().replace(/[^a-z0-9_]/g, '') : value;
        setMosqueForm(prev => ({
            ...prev,
            [name]: cleaned,
            ...(name === 'subdomain' ? { db_name: `db_${cleaned}` } : {}),
        }));
        setError('');
    };

    const validateStep1 = () => {
        if (!mosqueForm.name.trim()) return 'اسم المسجد مطلوب';
        if (!mosqueForm.subdomain.trim()) return 'النطاق الفرعي مطلوب';
        if (mosqueForm.subdomain.length < 3) return 'النطاق الفرعي يجب أن يكون 3 أحرف على الأقل';
        if (!mosqueForm.contact_phone.trim()) return 'رقم هاتف التواصل مطلوب';
        if (!mosqueForm.admin_password) return 'كلمة المرور مطلوبة';
        if (mosqueForm.admin_password.length < 6) return 'كلمة المرور يجب أن لا تقل عن 6 أحرف';
        if (mosqueForm.admin_password !== mosqueForm.confirm_password) return 'كلمتا المرور غير متطابقتين';
        return '';
    };

    const validateStep3 = () => {
        if (paymentMethod === 'CARD') {
            if (!cardForm.cardName.trim()) return 'اسم حامل البطاقة مطلوب';
            if (cardForm.cardNumber.replace(/\s/g, '').length < 16) return 'رقم البطاقة غير صحيح';
            if (!cardForm.expiry) return 'تاريخ الانتهاء مطلوب';
            if (cardForm.cvv.length < 3) return 'رمز CVV غير صحيح';
        }
        if (paymentMethod === 'SHAM_CASH') {
            if (!shamCashPhone.trim()) return 'رقم هاتف شام كاش مطلوب';
        }
        return '';
    };

    const handleNext = async () => {
        setError('');
        if (step === 1) {
            const err = validateStep1();
            if (err) { setError(err); return; }
        }
        if (step === 2) {
            if (!selectedPlanId) { setError('يرجى اختيار خطة اشتراك'); return; }
        }
        if (step === 3) {
            const err = validateStep3();
            if (err) { setError(err); return; }
            await handleSubmit();
            return;
        }
        setStep(s => s + 1);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError('');
        try {
            // 1. Create the tenant
            const tenantPayload = {
                name: mosqueForm.name,
                subdomain: mosqueForm.subdomain,
                db_name: mosqueForm.db_name || `db_${mosqueForm.subdomain}`,
                contact_phone: mosqueForm.contact_phone,
                contact_email: mosqueForm.contact_email,
                admin_password: mosqueForm.admin_password,
            };
            const tenantRes = await registerTenant(tenantPayload);
            if (tenantRes.status !== 'success') throw new Error(tenantRes.message);

            const tenantId = tenantRes.data.id;
            const selectedPlan = plans.find(p => p.id === selectedPlanId);

            // 2. Create subscription
            const now = new Date();
            const ends = new Date(now);
            ends.setMonth(ends.getMonth() + (selectedPlan?.billing_cycle === 'ANNUAL' ? 12 : 1));

            const subRes = await createSubscription({
                tenant_id: tenantId,
                plan_id: selectedPlanId,
                starts_at: now.toISOString(),
                ends_at: ends.toISOString(),
                status: 'PENDING',
            });
            if (subRes.status !== 'success') throw new Error(subRes.message);

            // 3. Record payment
            await createPayment({
                subscription_id: subRes.data.id,
                amount: selectedPlan?.price_usd || '30.00',
                currency: 'USD',
                payment_method: paymentMethod === 'SHAM_CASH' ? 'SHAM_CASH' : 'CARD',
                status: 'PENDING',
                transaction_id: `TXN-${Date.now()}`,
            });

            setResultData({
                mosque_name: mosqueForm.name,
                subdomain: mosqueForm.subdomain,
                username: 'manager',
                plan: selectedPlan?.name,
            });
            setStep(4);
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'حدث خطأ غير متوقع';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const formatCardNumber = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        return parts.length ? parts.join(' ') : value;
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
                                        placeholder="6 أحرف على الأقل"
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

                {/* Step 3: Payment */}
                {step === 3 && (
                    <div className="register-card">
                        <div className="register-card-header">
                            <CreditCard size={28} weight="duotone" className="register-card-icon" />
                            <h2>إتمام الدفع</h2>
                            <p>اختر طريقة الدفع المناسبة وأكمل الاشتراك</p>
                        </div>

                        {/* Order Summary */}
                        <div className="payment-summary">
                            <div className="payment-summary-row">
                                <span>الخطة المختارة</span>
                                <strong>{plans.find(p => p.id === selectedPlanId)?.name}</strong>
                            </div>
                            <div className="payment-summary-row total">
                                <span>الإجمالي</span>
                                <strong className="payment-total">${plans.find(p => p.id === selectedPlanId)?.price_usd} / شهر</strong>
                            </div>
                        </div>

                        {/* Payment Method Toggle */}
                        <div className="payment-methods">
                            <button
                                className={`payment-method-btn ${paymentMethod === 'CARD' ? 'active' : ''}`}
                                onClick={() => setPaymentMethod('CARD')}
                            >
                                <CreditCard size={20} />
                                بطاقة ائتمان
                            </button>
                            <button
                                className={`payment-method-btn ${paymentMethod === 'SHAM_CASH' ? 'active' : ''}`}
                                onClick={() => setPaymentMethod('SHAM_CASH')}
                            >
                                <span className="shamcash-badge">SC</span>
                                شام كاش
                            </button>
                        </div>

                        {/* Card Form */}
                        {paymentMethod === 'CARD' && (
                            <div className="card-form">
                                {/* Card Preview */}
                                <div className="credit-card-preview">
                                    <div className="card-chip"></div>
                                    <div className="card-number-display">
                                        {cardForm.cardNumber || '•••• •••• •••• ••••'}
                                    </div>
                                    <div className="card-bottom">
                                        <div>
                                            <div className="card-label">اسم الحامل</div>
                                            <div className="card-holder">{cardForm.cardName || 'الاسم الكامل'}</div>
                                        </div>
                                        <div>
                                            <div className="card-label">تاريخ الانتهاء</div>
                                            <div className="card-expiry">{cardForm.expiry || 'MM/YY'}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="register-form-grid">
                                    <div className="register-field full-width">
                                        <label>اسم حامل البطاقة <span className="req">*</span></label>
                                        <input
                                            type="text"
                                            value={cardForm.cardName}
                                            onChange={(e) => setCardForm(p => ({ ...p, cardName: e.target.value }))}
                                            placeholder="الاسم كما هو على البطاقة"
                                            className="register-input"
                                        />
                                    </div>
                                    <div className="register-field full-width">
                                        <label>رقم البطاقة <span className="req">*</span></label>
                                        <input
                                            type="text"
                                            value={cardForm.cardNumber}
                                            onChange={(e) => setCardForm(p => ({ ...p, cardNumber: formatCardNumber(e.target.value) }))}
                                            placeholder="0000 0000 0000 0000"
                                            maxLength={19}
                                            className="register-input"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div className="register-field">
                                        <label>تاريخ الانتهاء <span className="req">*</span></label>
                                        <input
                                            type="text"
                                            value={cardForm.expiry}
                                            onChange={(e) => {
                                                let v = e.target.value.replace(/\D/g, '');
                                                if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
                                                setCardForm(p => ({ ...p, expiry: v }));
                                            }}
                                            placeholder="MM/YY"
                                            maxLength={5}
                                            className="register-input"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div className="register-field">
                                        <label>رمز CVV <span className="req">*</span></label>
                                        <input
                                            type="text"
                                            value={cardForm.cvv}
                                            onChange={(e) => setCardForm(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                                            placeholder="•••"
                                            maxLength={4}
                                            className="register-input"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Sham Cash Form */}
                        {paymentMethod === 'SHAM_CASH' && (
                            <div className="shamcash-form">
                                <div className="shamcash-logo-area">
                                    <div className="shamcash-logo">SC</div>
                                    <div>
                                        <strong>شام كاش</strong>
                                        <p>بوابة الدفع الإلكترونية السورية</p>
                                    </div>
                                </div>
                                <div className="register-field">
                                    <label>رقم هاتف شام كاش <span className="req">*</span></label>
                                    <input
                                        type="tel"
                                        value={shamCashPhone}
                                        onChange={(e) => setShamCashPhone(e.target.value)}
                                        placeholder="+963 9XX XXX XXX"
                                        className="register-input"
                                        dir="ltr"
                                    />
                                </div>
                                <div className="shamcash-note">
                                    <Warning size={18} />
                                    <span>ستصلك رسالة تأكيد على هاتفك لإتمام عملية الدفع عبر تطبيق شام كاش</span>
                                </div>
                            </div>
                        )}

                        <div className="payment-security-note">
                            🔒 جميع بيانات الدفع مشفرة وآمنة
                        </div>
                    </div>
                )}

                {/* Step 4: Success */}
                {step === 4 && (
                    <div className="register-success">
                        <div className="success-icon-circle">
                            <CheckCircle size={64} weight="fill" />
                        </div>
                        <h2>تم إنشاء حساب مسجدك بنجاح! 🎉</h2>
                        <p>يمكنك الآن تسجيل الدخول وبدء إدارة حلقاتك القرآنية</p>

                        <div className="success-credentials">
                            <h3>بيانات الدخول</h3>
                            <div className="cred-row">
                                <span className="cred-label">رابط المسجد</span>
                                <span className="cred-value" dir="ltr">{resultData?.subdomain}.manarasy.com</span>
                            </div>
                            <div className="cred-row">
                                <span className="cred-label">اسم المستخدم</span>
                                <span className="cred-value" dir="ltr">manager</span>
                            </div>
                            <div className="cred-row">
                                <span className="cred-label">النطاق الفرعي</span>
                                <span className="cred-value" dir="ltr">{resultData?.subdomain}</span>
                            </div>
                            <div className="cred-row">
                                <span className="cred-label">خطة الاشتراك</span>
                                <span className="cred-value">{resultData?.plan}</span>
                            </div>
                        </div>

                        <button className="register-btn-primary" onClick={() => navigate('/login')}>
                            الانتقال لتسجيل الدخول
                            <CaretLeft size={18} />
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="register-error">
                        <Warning size={18} />
                        {error}
                    </div>
                )}

                {/* Navigation Buttons */}
                {step < 4 && (
                    <div className="register-nav">
                        {step > 1 && (
                            <button className="register-btn-back" onClick={() => { setStep(s => s - 1); setError(''); }}>
                                <CaretRight size={18} />
                                رجوع
                            </button>
                        )}
                        <button
                            className="register-btn-primary"
                            onClick={handleNext}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <span className="login-spinner"></span>
                            ) : step === 3 ? (
                                <>إتمام الدفع والتسجيل</>
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



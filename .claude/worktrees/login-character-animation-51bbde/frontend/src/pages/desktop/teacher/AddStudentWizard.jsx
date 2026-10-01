import React, { useState, useEffect } from 'react';
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react';
import { getProjects, submitStudentRegistrationRequest, getHalaqat } from '../../../services/api/tenantService';
import { useAuthContext } from '../../../context/AuthContext';

const AddStudentWizard = ({ isOpen, onClose, onComplete, studentToEdit }) => {
    const { user } = useAuthContext();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [initialDataStr, setInitialDataStr] = useState('');

    const [projects, setProjects] = useState([]);
    const [halaqat, setHalaqat] = useState([]);

    const [formData, setFormData] = useState({
        full_name: '',
        gender: 'M',
        birth_date: '',
        national_id: '',
        registration_number: '',
        is_orphan: false,
        has_special_needs: false,
        special_needs_notes: '',
        parent_phone: '',
        parent_name: '',
        current_residence: '',
        mother_phone: '',
        mother_name: '',
        income_level: '',
        general_notes: '',
        halaqa_id: '',
        project_id: '',
        stage_id: '',
        part_id: '',
        reached_page: 1
    });

    useEffect(() => {
        if (isOpen) {
            getProjects().then(res => {
                if(res.status === 'success') setProjects(res.data);
            });
            getHalaqat().then(res => {
                if(res.status === 'success') setHalaqat(res.data);
            });
            // Reset state
            setStep(1);
            let initialObj = {
                full_name: studentToEdit?.full_name || '',
                gender: studentToEdit?.gender || 'M',
                birth_date: studentToEdit?.birth_date || '',
                national_id: studentToEdit?.national_id || '',
                registration_number: studentToEdit?.registration_number || '',
                is_orphan: studentToEdit?.is_orphan || false,
                has_special_needs: studentToEdit?.has_special_needs || false,
                special_needs_notes: studentToEdit?.special_needs_notes || '',
                parent_phone: studentToEdit?.parent?.phone || '',
                parent_name: studentToEdit?.parent?.full_name || '',
                current_residence: studentToEdit?.current_residence || '',
                mother_phone: studentToEdit?.mother_phone || '',
                mother_name: studentToEdit?.mother_name || '',
                income_level: studentToEdit?.income_level || '',
                general_notes: studentToEdit?.general_notes || '',
                halaqa_id: studentToEdit?.halaqa_id || '',
                project_id: studentToEdit?.project_id || '', // Note: project_id isn't directly on student model, it's on enrollment, but we can assume teacher might change it or we just leave it blank if not available easily.
                stage_id: studentToEdit?.stage_id || '',
                part_id: studentToEdit?.part_id || '',
                reached_page: studentToEdit?.reached_page || 1
            };
            setFormData(initialObj);
            setInitialDataStr(JSON.stringify(initialObj));
        }
    }, [isOpen, studentToEdit]);

    const handleNext = () => {
        if (step < 3) setStep(step + 1);
    };

    const handlePrev = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const payload = {
                ...formData,
                user_profile_id: user?.id,
            };
            
            if (studentToEdit) {
                payload.request_type = 'UPDATE';
                payload.student_id = studentToEdit.id;
            } else {
                payload.request_type = 'NEW';
            }

            const response = await submitStudentRegistrationRequest(payload);
            if (response.status === 'success') {
                alert(studentToEdit ? 'تم إرسال طلب تعديل بيانات الطالب بنجاح بانتظار موافقة الإدارة.' : 'تم إرسال طلب تسجيل الطالب بنجاح بانتظار موافقة الإدارة.');
                if (onComplete) onComplete();
                onClose();
            } else {
                alert(response.message || 'حدث خطأ');
            }
        } catch (error) {
            alert('حدث خطأ أثناء الإرسال');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const selectedProject = projects.find(p => p.id === formData.project_id);
    const selectedStage = selectedProject?.stages.find(s => s.id === formData.stage_id);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            direction: 'rtl'
        }}>
            <div style={{
                background: '#fff', borderRadius: '16px', width: '90%', maxWidth: '800px',
                maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column'
            }}>
                {/* Header Profile Info */}
                <div style={{
                    padding: '1.5rem', borderBottom: '1px solid #eee', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '60px', height: '60px', borderRadius: '50%', background: '#e3f2fd',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #2196f3'
                        }}>
                            {/* Avatar placeholder */}
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2196f3" strokeWidth="1.5">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <div>
                            <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {formData.full_name || 'اسم الطالب'}
                            </h3>
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                رقم صفحة الوصول : <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 'bold' }}>{formData.reached_page}</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={onClose} style={{ background: '#fff', border: '1px solid #ddd', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>إلغاء</button>
                        {step < 3 ? (
                            <button onClick={handleNext} style={{ background: '#558b2f', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>التالي</button>
                        ) : (
                            <button 
                                onClick={handleSubmit} 
                                disabled={loading || JSON.stringify(formData) === initialDataStr} 
                                style={{ 
                                    background: (loading || JSON.stringify(formData) === initialDataStr) ? '#ccc' : '#558b2f', 
                                    color: '#fff', 
                                    border: 'none', 
                                    padding: '0.5rem 1.5rem', 
                                    borderRadius: '8px', 
                                    cursor: (loading || JSON.stringify(formData) === initialDataStr) ? 'not-allowed' : 'pointer' 
                                }}
                            >
                                {loading ? 'جاري الإرسال...' : 'إرسال الطلب'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Form Content */}
                <div style={{ padding: '2rem', flex: 1 }}>
                    {/* Step Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', color: '#558b2f', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        {step === 1 && 'المعلومات الشخصية والدراسية'}
                        {step === 2 && 'بيانات الاتصال وولي الأمر'}
                        {step === 3 && 'البيانات التعليمية'}
                    </div>

                    {step === 1 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>الاسم الكامل <span style={{color: 'red'}}>*</span></label>
                                <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>تاريخ الميلاد</label>
                                <input type="date" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>الجنس</label>
                                <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                                    <option value="M">ذكر</option>
                                    <option value="F">أنثى</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>رقم القيد</label>
                                <input type="text" value={formData.registration_number} onChange={e => setFormData({...formData, registration_number: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>رقم الوثيقة <span style={{color: 'red'}}>*</span></label>
                                <input type="text" value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>هل الطالب يتيم ؟</label>
                                <select value={formData.is_orphan} onChange={e => setFormData({...formData, is_orphan: e.target.value === 'true'})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                                    <option value={false}>لا</option>
                                    <option value={true}>نعم</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>هل الطالب من ذوي الاحتياجات الخاصة <span style={{color: 'red'}}>*</span></label>
                                <select value={formData.has_special_needs} onChange={e => setFormData({...formData, has_special_needs: e.target.value === 'true'})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                                    <option value={false}>لا</option>
                                    <option value={true}>نعم</option>
                                </select>
                            </div>
                            {formData.has_special_needs && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>يرجى شرح حالة الطالب</label>
                                    <input type="text" value={formData.special_needs_notes} onChange={e => setFormData({...formData, special_needs_notes: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>رقم هاتف الأب</label>
                                <input type="text" value={formData.parent_phone} onChange={e => setFormData({...formData, parent_phone: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>اسم الأب <span style={{color: 'red'}}>*</span></label>
                                <input type="text" value={formData.parent_name} onChange={e => setFormData({...formData, parent_name: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>رقم هاتف الأم <span style={{color: 'red'}}>*</span></label>
                                <input type="text" value={formData.mother_phone} onChange={e => setFormData({...formData, mother_phone: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>اسم الأم والكنية <span style={{color: 'red'}}>*</span></label>
                                <input type="text" value={formData.mother_name} onChange={e => setFormData({...formData, mother_name: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>العنوان أو السكن</label>
                                <input type="text" value={formData.current_residence} onChange={e => setFormData({...formData, current_residence: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>مستوى دخل الطالب <span style={{color: 'red'}}>*</span></label>
                                <select value={formData.income_level} onChange={e => setFormData({...formData, income_level: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                                    <option value="">اختر المستوى</option>
                                    <option value="ممتاز">ممتاز</option>
                                    <option value="جيد جدا">جيد جدا</option>
                                    <option value="جيد">جيد</option>
                                    <option value="متوسط">متوسط</option>
                                    <option value="ضعيف">ضعيف</option>
                                </select>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>ملاحظات <span style={{color: 'red'}}>*</span></label>
                                <input type="text" value={formData.general_notes} onChange={e => setFormData({...formData, general_notes: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>الحلقة المراد التسجيل فيها <span style={{color: 'red'}}>*</span></label>
                                <select value={formData.halaqa_id} onChange={e => setFormData({...formData, halaqa_id: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                                    <option value="">اختر الحلقة</option>
                                    {halaqat.map(h => (
                                        <option key={h.id} value={h.id}>{h.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>المشروع</label>
                                <select value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value, stage_id: '', part_id: ''})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                                    <option value="">اختر المشروع</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>مرحلة المشروع</label>
                                <select value={formData.stage_id} onChange={e => setFormData({...formData, stage_id: e.target.value, part_id: ''})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                                    <option value="">اختر المرحلة</option>
                                    {selectedProject?.stages?.map(s => (
                                        <option key={s.id} value={s.id}>{s.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>جزء المشروع</label>
                                <select value={formData.part_id} onChange={e => setFormData({...formData, part_id: e.target.value})} style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                                    <option value="">اختر الجزء</option>
                                    {selectedStage?.parts?.map(p => (
                                        <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>رقم صفحة الوصول</label>
                                <input type="number" value={formData.reached_page} onChange={e => setFormData({...formData, reached_page: e.target.value})} min="1" style={{ width: '100%', padding: '0.8rem', border: '1px solid #ddd', borderRadius: '8px' }} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Navigation */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                    <CaretRight size={20} color={step > 1 ? "#558b2f" : "#ccc"} weight="bold" style={{ cursor: step > 1 ? 'pointer' : 'default' }} onClick={handlePrev} />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: i === step ? '#8bc34a' : '#e0e0e0' }} />
                        ))}
                    </div>
                    <CaretLeft size={20} color={step < 3 ? "#558b2f" : "#ccc"} weight="bold" style={{ cursor: step < 3 ? 'pointer' : 'default' }} onClick={handleNext} />
                </div>
            </div>
        </div>
    );
};

export default AddStudentWizard;

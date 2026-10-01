import React, { useState, useEffect } from 'react';
import { CalendarBlank, WarningCircle, Check, X, CaretRight, CaretLeft, Clock } from '@phosphor-icons/react';
import { getAvailableSessionDates } from '../services/api/tenantService';

const AlternativeDatePickerModal = ({
    isOpen,
    onClose,
    onSelectDate,
    halaqaId,
    conflictingDate = '',
    title = 'اختيار تاريخ بديل للجلسة',
    message = '',
    excludeSessionId = ''
}) => {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
    const [availableDates, setAvailableDates] = useState([]);
    const [bookedDates, setBookedDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen || !halaqaId) return;

        // If conflictingDate has a month, use that month initially if not in the future
        if (conflictingDate && conflictingDate.length >= 7) {
            const confMonth = conflictingDate.slice(0, 7);
            setSelectedMonth(confMonth > currentMonthStr ? currentMonthStr : confMonth);
        }

        setSelectedDate('');
    }, [isOpen, halaqaId, conflictingDate, currentMonthStr]);

    useEffect(() => {
        if (!isOpen || !halaqaId) return;

        const fetchDates = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await getAvailableSessionDates(halaqaId, selectedMonth, excludeSessionId);
                if (res.status === 'success' && res.data) {
                    const filteredAvailable = (res.data.available_dates || []).filter(d => d.date <= todayISO);
                    setAvailableDates(filteredAvailable);
                    setBookedDates(res.data.booked_dates || []);
                } else {
                    setError('تعذر جلب التواريخ المتاحة');
                }
            } catch (err) {
                console.error(err);
                setError('حدث خطأ أثناء تحميل التواريخ الشاغرة');
            } finally {
                setLoading(false);
            }
        };

        fetchDates();
    }, [isOpen, halaqaId, selectedMonth, excludeSessionId, todayISO]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!selectedDate) return;
        if (selectedDate > todayISO) {
            setError('لا يمكن إنشاء جلسة بتاريخ مستقبلي. يرجى اختيار تاريخ اليوم أو أي تاريخ سابق.');
            return;
        }
        onSelectDate(selectedDate);
    };

    const handlePrevMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const prev = new Date(y, m - 2, 1);
        setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
        setSelectedDate('');
    };

    const handleNextMonth = () => {
        if (selectedMonth >= currentMonthStr) return;
        const [y, m] = selectedMonth.split('-').map(Number);
        const next = new Date(y, m, 1);
        const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        if (nextStr <= currentMonthStr) {
            setSelectedMonth(nextStr);
            setSelectedDate('');
        }
    };

    // Format Arabic month label
    const [curYear, curMonth] = selectedMonth.split('-').map(Number);
    const monthDateObj = new Date(curYear, curMonth - 1, 1);
    const monthLabel = monthDateObj.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            direction: 'rtl'
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '560px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                animation: 'fadeIn 0.2s ease-out'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#fafbfc'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            backgroundColor: '#fff3e0',
                            color: '#e65100',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <CalendarBlank size={20} weight="bold" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#133315', fontWeight: 'bold' }}>
                                {title}
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>
                                منع تكرار الجلسات في نفس اليوم
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#888',
                            padding: '0.4rem',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
                    {/* Conflict Alert Banner */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        backgroundColor: '#fff8e1',
                        border: '1px solid #ffe082',
                        borderRadius: '10px',
                        padding: '0.85rem 1rem',
                        marginBottom: '1.25rem',
                        color: '#795548',
                        fontSize: '0.88rem',
                        lineHeight: 1.5
                    }}>
                        <WarningCircle size={20} color="#f57c00" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                            {message || (
                                conflictingDate ? (
                                    <>
                                        يوجد بالفعل جلسة مسجلة بتاريخ <strong style={{ color: '#d84315' }}>{conflictingDate}</strong> لهذه الحلقة.
                                        يرجى اختيار أحد التواريخ الشاغرة التالية:
                                    </>
                                ) : (
                                    'التاريخ المحدد محجوز مسبقاً بجلسة أخرى. يرجى اختيار تاريخ متاح أدناه:'
                                )
                            )}
                        </div>
                    </div>

                    {/* Month Navigator */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1rem',
                        padding: '0.5rem 0.75rem',
                        backgroundColor: '#f1f8e9',
                        borderRadius: '10px'
                    }}>
                        <button
                            type="button"
                            disabled={selectedMonth >= currentMonthStr}
                            onClick={handleNextMonth}
                            style={{
                                background: selectedMonth >= currentMonthStr ? '#f5f5f5' : '#fff',
                                border: '1px solid #c5e1a5',
                                borderRadius: '6px',
                                padding: '0.35rem 0.6rem',
                                cursor: selectedMonth >= currentMonthStr ? 'not-allowed' : 'pointer',
                                opacity: selectedMonth >= currentMonthStr ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                fontSize: '0.8rem',
                                color: '#33691e',
                                fontWeight: 'bold'
                            }}
                        >
                            <span>الشهر التالي</span>
                            <CaretLeft size={14} />
                        </button>

                        <span style={{ fontWeight: 'bold', color: '#133315', fontSize: '0.95rem' }}>
                            {monthLabel}
                        </span>

                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            style={{
                                background: '#fff',
                                border: '1px solid #c5e1a5',
                                borderRadius: '6px',
                                padding: '0.35rem 0.6rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                fontSize: '0.8rem',
                                color: '#33691e',
                                fontWeight: 'bold'
                            }}
                        >
                            <CaretRight size={14} />
                            <span>الشهر السابق</span>
                        </button>
                    </div>

                    {/* Dates Content */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#558b2f', fontWeight: 'bold' }}>
                            جاري تحميل التواريخ المتاحة...
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#c62828', fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    ) : availableDates.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#888', fontSize: '0.9rem' }}>
                            لا توجد تواريخ شاغرة متاحة في هذا الشهر. يرجى الانتقال إلى شهر آخر.
                        </div>
                    ) : (
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#555', marginBottom: '0.6rem' }}>
                                التواريخ المتاحة ({availableDates.length} يوم متاح):
                            </div>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))',
                                gap: '0.5rem',
                                maxHeight: '250px',
                                overflowY: 'auto',
                                padding: '0.25rem'
                            }}>
                                {availableDates.map(item => {
                                    const isSelected = selectedDate === item.date;
                                    return (
                                        <button
                                            key={item.date}
                                            type="button"
                                            onClick={() => setSelectedDate(item.date)}
                                            style={{
                                                padding: '0.6rem 0.4rem',
                                                borderRadius: '8px',
                                                border: isSelected ? '2px solid #558b2f' : '1px solid #e0e0e0',
                                                backgroundColor: isSelected ? '#e8f5e9' : '#fff',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '0.2rem',
                                                transition: 'all 0.15s ease',
                                                boxShadow: isSelected ? '0 2px 6px rgba(85,139,47,0.2)' : 'none'
                                            }}
                                        >
                                            <span style={{ fontSize: '0.78rem', color: isSelected ? '#2e7d32' : '#777' }}>
                                                {item.day_name}
                                            </span>
                                            <span style={{
                                                fontSize: '1rem',
                                                fontWeight: 'bold',
                                                color: isSelected ? '#1b5e20' : '#222'
                                            }}>
                                                {item.date.slice(8, 10)}
                                            </span>
                                            {item.is_today && (
                                                <span style={{
                                                    fontSize: '0.65rem',
                                                    backgroundColor: '#c8e6c9',
                                                    color: '#1b5e20',
                                                    padding: '1px 5px',
                                                    borderRadius: '4px',
                                                    fontWeight: 'bold'
                                                }}>
                                                    اليوم
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {selectedDate && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '0.75rem 1rem',
                            backgroundColor: '#f1f8e9',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <span style={{ fontSize: '0.85rem', color: '#33691e', fontWeight: 'bold' }}>
                                التاريخ المختار: {selectedDate}
                            </span>
                            <Check size={18} color="#2e7d32" weight="bold" />
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    backgroundColor: '#fafbfc'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            backgroundColor: '#fff',
                            color: '#555',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            cursor: 'pointer'
                        }}
                    >
                        إلغاء
                    </button>
                    <button
                        type="button"
                        disabled={!selectedDate}
                        onClick={handleConfirm}
                        style={{
                            padding: '0.6rem 1.4rem',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: selectedDate ? '#558b2f' : '#b0bec5',
                            color: '#fff',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            cursor: selectedDate ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: selectedDate ? '0 2px 6px rgba(85,139,47,0.3)' : 'none'
                        }}
                    >
                        <Check size={16} weight="bold" />
                        تأكيد واستمرار
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AlternativeDatePickerModal;

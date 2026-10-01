import React, { useState } from 'react';
import { CaretUp, CaretDown } from '@phosphor-icons/react';

/**
 * Determines color based on color_code or evaluation grade string.
 */
const getItemColor = (item) => {
    if (item.color_code) return item.color_code;
    const grade = String(item.grade || '').trim();
    
    // Check percentage numbers if present
    const match = grade.match(/(\d+)%/);
    if (match) {
        const val = parseInt(match[1], 10);
        if (val >= 90) return '#2e7d32'; // Green
        if (val >= 80) return '#1976d2'; // Blue
        if (val >= 70) return '#ed6c02'; // Orange
        return '#d32f2f'; // Red
    }

    if (grade.includes('100') || grade.includes('95') || grade.includes('90') || grade === 'ممتاز') return '#2e7d32';
    if (grade.includes('88') || grade.includes('85') || grade.includes('80') || grade === 'جيد جداً') return '#1976d2';
    if (grade.includes('75') || grade.includes('70') || grade === 'جيد') return '#ed6c02';
    if (grade.includes('إعادة') || grade === 'ضعيف' || item.requires_repeat) return '#d32f2f';
    
    return '#558b2f';
};

const PageEvaluationsList = ({ evaluations = [] }) => {
    const [startIndex, setStartIndex] = useState(0);
    const pageSize = 3;

    if (!evaluations || evaluations.length === 0) {
        return (
            <div style={{ color: '#999', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.2rem' }}>
                لا توجد تقييمات
            </div>
        );
    }

    const visibleItems = evaluations.slice(startIndex, startIndex + pageSize);
    const canPrev = startIndex > 0;
    const canNext = startIndex + pageSize < evaluations.length;

    const handlePrev = (e) => {
        e.stopPropagation();
        if (canPrev) {
            setStartIndex(prev => Math.max(0, prev - pageSize));
        }
    };

    const handleNext = (e) => {
        e.stopPropagation();
        if (canNext) {
            setStartIndex(prev => Math.min(evaluations.length - pageSize, prev + pageSize));
        }
    };

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '100%',
            gap: '4px'
        }}>
            {/* List of 3 items max */}
            <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: 0, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '2px',
                width: '100%',
                alignItems: 'center'
            }}>
                {visibleItems.map((item, idx) => {
                    const color = getItemColor(item);
                    const gradeStr = String(item.grade || '');
                    const formattedGrade = gradeStr.endsWith('%') || isNaN(gradeStr) 
                        ? gradeStr 
                        : `${gradeStr}%`;
                    return (
                        <li 
                            key={item.id || idx} 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontSize: '0.82rem',
                                fontWeight: '600',
                                color: '#2c3e50',
                                whiteSpace: 'nowrap',
                                lineHeight: '1.2'
                            }}
                        >
                            <span style={{ 
                                color: color, 
                                fontSize: '0.95rem', 
                                lineHeight: 1, 
                                display: 'inline-block' 
                            }}>
                                ●
                            </span>
                            <span>Page {item.page_number} ({formattedGrade})</span>
                        </li>
                    );
                })}
            </ul>

            {/* Navigation Arrows */}
            {evaluations.length > pageSize && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                    <button
                        type="button"
                        onClick={handlePrev}
                        disabled={!canPrev}
                        title="الصفحات السابقة"
                        aria-label="Previous Pages"
                        style={{
                            border: 'none',
                            background: canPrev ? '#e8f5e9' : '#f0f0f0',
                            color: canPrev ? '#2e7d32' : '#bbb',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: canPrev ? 'pointer' : 'not-allowed',
                            padding: 0,
                            transition: 'all 0.2s ease',
                            boxShadow: canPrev ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        <CaretUp size={11} weight="bold" />
                    </button>
                    <button
                        type="button"
                        onClick={handleNext}
                        disabled={!canNext}
                        title="الصفحات التالية"
                        aria-label="Next Pages"
                        style={{
                            border: 'none',
                            background: canNext ? '#e8f5e9' : '#f0f0f0',
                            color: canNext ? '#2e7d32' : '#bbb',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: canNext ? 'pointer' : 'not-allowed',
                            padding: 0,
                            transition: 'all 0.2s ease',
                            boxShadow: canNext ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                        }}
                    >
                        <CaretDown size={11} weight="bold" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default PageEvaluationsList;

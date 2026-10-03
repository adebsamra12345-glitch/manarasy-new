import React from 'react';
import StudentFollowUpSection from './StudentFollowUpSection';
import './studentParentPortal.css';

/**
 * StudentReportCard
 * كشف المتابعة والدرجات وسجل التقييمات التاريخي المتكامل
 */
const StudentReportCard = () => {
    return (
        <div className="portal-container" style={{ paddingTop: 20 }}>
            <StudentFollowUpSection />
        </div>
    );
};

export default StudentReportCard;

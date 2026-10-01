import React from 'react';
import useDeviceType from '../../../hooks/useDeviceType';
import MobileRecitationGrade from '../../mobile/teacher/MobileRecitationGrade';

import { Navigate } from 'react-router-dom';

/**
 * DesktopRecitationEvaluation
 * رصد الحفظ والمراجعة الصغرى والسبر (يدعم الموبايل وديسكتوب)
 */
const DesktopRecitationEvaluation = () => {
    const { isMobile } = useDeviceType();

    if (isMobile) {
        return <Navigate to="/teacher/dashboard" replace />;
    }

    return <MobileRecitationGrade />;
};

export default DesktopRecitationEvaluation;

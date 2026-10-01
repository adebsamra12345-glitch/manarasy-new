import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * useDeviceType — تحديد نوع الجهاز (Desktop أو Mobile)
 */
export const useDeviceType = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);

    return { isMobile, isDesktop: !isMobile };
};

export default useDeviceType;

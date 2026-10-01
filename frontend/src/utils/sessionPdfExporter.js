import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getTeacherSessionDetail } from '../services/api/tenantService';

const ATTENDANCE_MAP = {
    'PRESENT': 'حاضر',
    'EXCUSED': 'غياب بعذر',
    'ABSENT': 'غياب بدون عذر',
    'LATE': 'متأخر',
};

const BEHAVIOR_MAP = {
    10: 'ممتاز',
    8: 'جيد جداً',
    6: 'جيد',
    4: 'مقبول',
    2: 'ضعيف',
    'EXCELLENT': 'ممتاز',
    'VERY_GOOD': 'جيد جداً',
    'GOOD': 'جيد',
    'ACCEPTABLE': 'مقبول',
    'WEAK': 'ضعيف',
    'LEFT_WITHOUT_EXCUSE': 'مغادرة دون عذر'
};

/**
 * Export a session report as a detailed PDF document.
 * 
 * @param {string} sessionId - The UUID/ID of the session to export.
 * @param {Object} [sessionBasicInfo] - Optional pre-loaded session metadata.
 */
export const exportSessionPdf = async (sessionId, sessionBasicInfo = null) => {
    try {
        let data;
        if (sessionId) {
            const res = await getTeacherSessionDetail(sessionId);
            if (res && (res.status === 'success' || res.session_id)) {
                data = res;
            } else {
                throw new Error(res?.message || 'فشل في جلب بيانات الجلسة من الخادم');
            }
        } else if (sessionBasicInfo) {
            data = sessionBasicInfo;
        } else {
            throw new Error('معرف الجلسة غير مدخل');
        }

        const sessionDate = data.session_date || sessionBasicInfo?.session_date || new Date().toISOString().split('T')[0];
        const rawId = data.session_id || sessionId || '1234';
        const formattedId = String(rawId).split('-')[0];

        const mosqueName = data.mosque_name || sessionBasicInfo?.mosque_name || 'جامع التنعيم';
        const teacherName = data.teacher_name || sessionBasicInfo?.teacher_name || 'أ. المعلم';
        const halaqaName = data.halaqa_name || sessionBasicInfo?.halaqa_name || sessionBasicInfo?.title || 'حلقة القرآن الكريم';
        
        let startTime = 'غير محدد';
        if (data.start_time) {
            try {
                startTime = new Date(data.start_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
            } catch (e) {
                startTime = String(data.start_time);
            }
        } else if (sessionBasicInfo?.start_time) {
            startTime = sessionBasicInfo.start_time;
        }

        let endTime = '';
        if (data.end_time) {
            try {
                endTime = new Date(data.end_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
            } catch (e) {
                endTime = String(data.end_time);
            }
        } else if (sessionBasicInfo?.end_time) {
            endTime = sessionBasicInfo.end_time;
        }

        const sessionTime = endTime ? `${startTime} - ${endTime}` : startTime;
        const students = data.attendance || [];

        // Build HTML container for rendering
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '800px';
        container.style.padding = '32px';
        container.style.boxSizing = 'border-box';
        container.style.direction = 'rtl';
        container.style.fontFamily = 'Cairo, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        container.style.backgroundColor = '#ffffff';
        container.style.color = '#133315';

        // Format student rows
        const studentsHtml = students.map((st, idx) => {
            const attText = ATTENDANCE_MAP[st.status] || st.status || 'حاضر';
            let attBg = '#e8f5e9';
            let attColor = '#2e7d32';
            if (st.status === 'ABSENT') {
                attBg = '#ffebee';
                attColor = '#c62828';
            } else if (st.status === 'EXCUSED') {
                attBg = '#fff3e0';
                attColor = '#e65100';
            } else if (st.status === 'LATE') {
                attBg = '#fff8e1';
                attColor = '#f57f17';
            }

            const behaviorText = BEHAVIOR_MAP[st.behavior_score] || BEHAVIOR_MAP[st.behavior] || st.behavior || 'ممتاز';

            // Non-numbered bullet list: • Page {PageNumber} ({Evaluation})
            let evalsHtml = '<span style="color: #999;">-</span>';
            if (st.evaluations && st.evaluations.length > 0) {
                evalsHtml = st.evaluations.map(ev => {
                    const gradeVal = ev.grade || 'ممتاز';
                    return `<div style="margin-bottom: 3px; white-space: nowrap;">• Page ${ev.page_number} (${gradeVal})</div>`;
                }).join('');
            }

            const notesText = st.notes ? st.notes : '<span style="color: #aaa;">-</span>';

            return `
                <tr style="border-bottom: 1px solid #e0e0e0; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f9fbf8'}; font-size: 13px;">
                    <td style="padding: 12px 14px; font-weight: bold; color: #133315; text-align: right;">${st.student_name}</td>
                    <td style="padding: 12px 14px; text-align: center;">
                        <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; background-color: ${attBg}; color: ${attColor}; font-weight: bold; font-size: 12px;">
                            ${attText}
                        </span>
                    </td>
                    <td style="padding: 12px 14px; text-align: center; color: #333;">${behaviorText}</td>
                    <td style="padding: 12px 14px; text-align: right; color: #2e7d32; font-family: monospace, system-ui; direction: ltr;">${evalsHtml}</td>
                    <td style="padding: 12px 14px; text-align: right; color: #555;">${notesText}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div style="border: 2px solid #558b2f; border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                <!-- PDF Header -->
                <div style="background: linear-gradient(135deg, #133315 0%, #2e7d32 100%); color: #ffffff; padding: 28px 24px; text-align: center; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <div style="text-align: right;">
                            <div style="font-size: 14px; opacity: 0.9; font-weight: 500;">${mosqueName}</div>
                            <div style="font-size: 18px; font-weight: bold; margin-top: 4px; color: #81b255;">${halaqaName}</div>
                        </div>
                        <div style="text-align: center;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">تقرير الجلسة القرآنية</h1>
                            <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">Session Report</div>
                        </div>
                        <div style="text-align: left; font-size: 13px; opacity: 0.9;">
                            <div>رقم الجلسة: #${formattedId}</div>
                        </div>
                    </div>
                    
                    <div style="height: 1px; background-color: rgba(255,255,255,0.25); margin: 14px 0;"></div>
                    
                    <div style="display: flex; justify-content: space-around; font-size: 14px; font-weight: 600; background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px;">
                        <div>📅 التاريخ: ${sessionDate}</div>
                        <div>⏰ الوقت: ${sessionTime}</div>
                        <div>👨‍🏫 المعلم: ${teacherName}</div>
                    </div>
                </div>

                <!-- Session Notes Section -->
                ${data.notes ? `
                    <div style="padding: 14px 24px; background-color: #f1f8e9; border-bottom: 1px solid #ded; font-size: 13px; color: #1b5e20; text-align: right;">
                        <strong>📝 ملاحظات العامة للجلسة:</strong> ${data.notes}
                    </div>
                ` : ''}

                <!-- Students Evaluation Table -->
                <div style="padding: 20px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #133315; color: #ffffff; font-size: 13px; text-align: right;">
                                <th style="padding: 12px 14px; border-top-right-radius: 8px; width: 25%;">اسم الطالب</th>
                                <th style="padding: 12px 14px; text-align: center; width: 15%;">الحضور</th>
                                <th style="padding: 12px 14px; text-align: center; width: 15%;">السلوك</th>
                                <th style="padding: 12px 14px; text-align: right; width: 25%;">التقييمات</th>
                                <th style="padding: 12px 14px; border-top-left-radius: 8px; width: 20%;">ملاحظات المعلم</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${studentsHtml || '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #888; font-size: 14px;">لا يوجد سجل طلاب لهذه الجلسة</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <!-- Footer Banner -->
                <div style="padding: 16px 24px; background-color: #f9fdf9; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #666;">
                    <span>🏛️ منصة منارة لتسيير الحلقات القرآنية</span>
                    <span>تم التصدير تلقائياً بتاريخ: ${new Date().toLocaleDateString('ar-SA')}</span>
                </div>
            </div>
        `;

        document.body.appendChild(container);

        // Convert DOM node to canvas using html2canvas
        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        document.body.removeChild(container);

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        const fileName = `Session_Report_${sessionDate}_${formattedId}.pdf`;
        pdf.save(fileName);
        return true;
    } catch (err) {
        console.error('PDF Export Error:', err);
        throw err;
    }
};

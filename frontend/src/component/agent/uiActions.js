/**
 * قواعد تنفيذ إجراءات الواجهة (ui_actions) القادمة من وكيل منارة.
 * لا تُنفَّذ إجراءات إلا من هذه القائمة البيضاء، حتى لو صدرت من الخادم.
 */

export const ROLE_PREFIX = {
    tenant_admin: '/admin',
    center_manager: '/center-manager',
    teacher: '/teacher',
    student: '/student',
};

export const ALLOWED_MODALS = new Set(['change_password']);

const SAFE_ROUTE_RE = /^\/[a-z0-9\-_/]*(\?[a-z0-9\-_=&.]*)?$/i;

/** مسار داخلي يبدأ ببادئة دور المستخدم الحالي فقط (يمنع الروابط الخارجية و«..» وأدوار أخرى). */
export const isAllowedRoute = (route, prefix) => {
    if (typeof route !== 'string' || !prefix) return false;
    if (route.includes('..') || route.includes('//')) return false;
    if (!SAFE_ROUTE_RE.test(route)) return false;
    return route === prefix || route.startsWith(`${prefix}/`) || route.startsWith(`${prefix}?`);
};

/**
 * ينفّذ إجراءً واحداً. handlers: { navigate, logout, openModal, showText, showChoices, showConfirm, sendMessage }
 * يرجع true إذا نُفّذ، وfalse إذا رُفض لأسباب أمنية أو لنوع مجهول.
 */
export const runUiAction = (action, { prefix, handlers }) => {
    if (!action || typeof action !== 'object') return false;
    switch (action.type) {
        case 'navigate':
            if (!isAllowedRoute(action.route, prefix)) return false;
            handlers.navigate(action.route);
            return true;
        case 'open_modal':
            if (!ALLOWED_MODALS.has(action.modal)) return false;
            handlers.openModal(action.modal);
            return true;
        case 'reply':
            handlers.showText(String(action.text || ''));
            return true;
        case 'send_message':
            handlers.sendMessage(String(action.text || ''));
            return true;
        case 'choices':
            handlers.showChoices(Array.isArray(action.options) ? action.options : []);
            return true;
        case 'confirm_ui':
            handlers.showConfirm({
                text: String(action.text || 'هل تؤكد؟'),
                onConfirm: Array.isArray(action.on_confirm) ? action.on_confirm : [],
            });
            return true;
        case 'logout':
            handlers.logout();
            return true;
        default:
            return false;
    }
};

// ─── فهم «نعم/لا» الصوتي لتأكيد إجراء معلّق (يطابق منطق الخادم: النفي يغلب) ─────────
const normalizeAr = (t) =>
    String(t || '')
        .replace(/[ً-ْـ]/g, '')
        .replace(/[إأآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[^؀-ۿa-z0-9\s]/gi, ' ')
        .trim()
        .toLowerCase();

const YES_WORDS = new Set(['نعم', 'ايوه', 'ايوا', 'اي', 'ايه', 'اجل', 'تمام', 'اكد', 'اكيد', 'موافق', 'صح', 'طيب', 'يلا', 'ماشي', 'حاضر', 'اوكي', 'yes', 'ok']);
const NO_WORDS = new Set(['لا', 'كلا', 'الغ', 'الغي', 'الغاء', 'وقف', 'no']);

/** يرجع 'yes' | 'no' | null. يُطبَّق فقط على ردود قصيرة (حتى 3 كلمات) حتى لا يُلتقط كلام آخر. */
export const parseYesNo = (utterance) => {
    const words = normalizeAr(utterance).split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 3) return null;
    if (words.some((w) => NO_WORDS.has(w))) return 'no';
    if (words.some((w) => YES_WORDS.has(w))) return 'yes';
    return null;
};

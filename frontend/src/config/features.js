/**
 * Feature flags — تفعيل/تعطيل الميزات من مكان واحد عبر متغيرات البيئة.
 * GOOGLE_LOGIN: تسجيل الدخول بواسطة جوجل (معطّل مؤقتاً).
 * AI_*: أعلام ميزات الذكاء الاصطناعي (كل ميزة لها علم مستقل).
 */
const parseBool = (val, defaultVal = true) => {
    if (val === undefined || val === null || val === '') return defaultVal;
    return !['false', '0', 'no', 'off'].includes(String(val).toLowerCase().trim());
};

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

export const FEATURES = {
    GOOGLE_LOGIN: false,
    AI_MASTER_ENABLED: parseBool(env.VITE_FEATURE_AI_MASTER, true),
    AI_ASSISTANT_CHAT: parseBool(env.VITE_FEATURE_AI_CHAT, true),
    AI_VOICE_TEXT_AGENT: parseBool(env.VITE_FEATURE_AI_AGENT, true),
    AI_EVALUATION_NOTES: parseBool(env.VITE_FEATURE_AI_EVAL_NOTES, true),
    AI_REPORT_INSIGHTS: parseBool(env.VITE_FEATURE_AI_REPORT_INSIGHTS, true),
    AI_QUIZ_GENERATOR: parseBool(env.VITE_FEATURE_AI_QUIZ, true),
    AI_STT_TRANSCRIPTION: parseBool(env.VITE_FEATURE_AI_STT, true),
};

export const isAiFeatureEnabled = (featureKey) => {
    if (!FEATURES.AI_MASTER_ENABLED) return false;
    return Boolean(FEATURES[featureKey]);
};

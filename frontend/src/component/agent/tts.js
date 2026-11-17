/**
 * قراءة ردود المساعد صوتياً عبر Web Speech Synthesis في المتصفح (بلا GPU ولا خادم).
 * جودة الصوت العربي تعتمد على أصوات الجهاز/المتصفح؛ إن لم يوجد صوت عربي لا نقرأ (نعرض تنبيهاً مرة واحدة).
 */

const MAX_CHUNK = 180;

/** ينظّف النص للنطق: روابط، رموز Markdown، إيموجي، مسافات زائدة. */
export const prepareSpeechText = (text) =>
    String(text || '')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[*_`#>~|]/g, ' ')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
        .replace(/[«»]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/** يقسّم النص إلى مقاطع قصيرة عند علامات الوقف (يتفادى انقطاع النطق الطويل في كروم). */
export const splitChunks = (text, max = MAX_CHUNK) => {
    const clean = prepareSpeechText(text);
    if (!clean) return [];
    const sentences = clean.split(/(?<=[.!?؟،,؛:])\s+/);
    const chunks = [];
    let cur = '';
    for (const sent of sentences) {
        if ((cur + ' ' + sent).trim().length <= max) {
            cur = (cur + ' ' + sent).trim();
        } else {
            if (cur) chunks.push(cur);
            // جملة أطول من الحد: نقسمها على المسافات
            let piece = '';
            for (const word of sent.split(' ')) {
                if ((piece + ' ' + word).trim().length > max) {
                    chunks.push(piece);
                    piece = word;
                } else {
                    piece = (piece + ' ' + word).trim();
                }
            }
            cur = piece;
        }
    }
    if (cur) chunks.push(cur);
    return chunks;
};

export const isTtsSupported = () =>
    typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

const pickArabicVoice = () => {
    const voices = window.speechSynthesis.getVoices() || [];
    const ar = voices.filter((v) => (v.lang || '').toLowerCase().startsWith('ar'));
    return ar.find((v) => v.lang.toLowerCase() === 'ar-sa') || ar[0] || null;
};

/** الأصوات تُحمَّل بشكل غير متزامن: ننتظر حدث voiceschanged لمدة قصيرة. */
const loadVoices = () =>
    new Promise((resolve) => {
        if (window.speechSynthesis.getVoices().length) return resolve();
        const done = () => {
            window.speechSynthesis.removeEventListener?.('voiceschanged', done);
            resolve();
        };
        window.speechSynthesis.addEventListener?.('voiceschanged', done);
        setTimeout(done, 1200);
    });

let currentAudio = null;
let currentUrl = null;

const stopAudio = () => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
    }
};

/** يوقف أي نطق جارٍ فوراً (barge-in): صوت الخادم وصوت المتصفح. */
export const cancelSpeech = () => {
    stopAudio();
    if (isTtsSupported()) window.speechSynthesis.cancel();
};

/** يشغّل صوتاً جاهزاً من الخادم (Blob). يرجع 'spoken' أو 'failed' (فيُستعمل صوت المتصفح). */
export const speakServer = async (blob, { onStart, onEnd } = {}) => {
    if (typeof window === 'undefined' || typeof window.Audio !== 'function') return 'failed';
    cancelSpeech();
    const url = URL.createObjectURL(blob);
    const audio = new window.Audio(url);
    currentAudio = audio;
    currentUrl = url;
    const done = () => {
        if (currentAudio === audio) stopAudio();
        onEnd?.();
    };
    audio.onplay = () => onStart?.();
    audio.onended = done;
    audio.onerror = done;
    try {
        await audio.play();
        return 'spoken';
    } catch {
        done();
        return 'failed';
    }
};

/**
 * ينطق النص. يرجع: 'spoken' | 'no_voice' | 'unsupported' | 'empty'.
 * callbacks: onStart, onEnd (عند اكتمال كل المقاطع أو إلغائها).
 */
export const speak = async (text, { onStart, onEnd } = {}) => {
    if (!isTtsSupported()) return 'unsupported';
    const chunks = splitChunks(text);
    if (!chunks.length) return 'empty';

    await loadVoices();
    const voice = pickArabicVoice();
    if (!voice) return 'no_voice';

    cancelSpeech();
    chunks.forEach((chunk, i) => {
        const u = new window.SpeechSynthesisUtterance(chunk);
        u.voice = voice;
        u.lang = voice.lang || 'ar-SA';
        u.rate = 1;
        if (i === 0) u.onstart = () => onStart?.();
        if (i === chunks.length - 1) {
            u.onend = () => onEnd?.();
            u.onerror = () => onEnd?.();
        } else {
            u.onerror = () => onEnd?.();
        }
        window.speechSynthesis.speak(u);
    });
    return 'spoken';
};

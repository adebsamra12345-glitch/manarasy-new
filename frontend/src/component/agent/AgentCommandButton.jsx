import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Microphone, PaperPlaneRight, X, Sparkle, WarningCircle, CircleNotch } from '@phosphor-icons/react';
import { useAuthContext } from '../../context/AuthContext';
import { sendAgentMessage, confirmAgentAction, transcribeAudioCommand } from '../../services/api/agentService';
import ChangePasswordModal from '../common/ChangePasswordModal';
import { ROLE_PREFIX, runUiAction } from './uiActions';
import './agentCommand.css';

/**
 * 1. فحص السياق الآمن (HTTPS أو Localhost) المطلوب لتمكين واجهات الصوت البرمجية
 */
const isSecureEnvironment = () => {
    if (typeof window === 'undefined') return false;
    const isLocal = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '::1';
    return Boolean(window.isSecureContext || isLocal || window.location.protocol === 'https:');
};

/**
 * 2. استخراج أصناف التعرف الصوتي المدعومة في المتصفح
 */
const getSpeechRecognitionClass = () => {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

/**
 * 3. تحديد الصيغة الصوتية المدعومة لـ MediaRecorder
 */
const getSupportedAudioMimeType = () => {
    if (typeof window === 'undefined' || !window.MediaRecorder) return 'audio/webm';
    const candidateTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
        'audio/wav',
    ];
    for (const type of candidateTypes) {
        if (window.MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return '';
};

const AgentCommandButton = () => {
    const { role, logout } = useAuthContext();
    const navigate = useNavigate();

    // حالات الواجهة
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [listening, setListening] = useState(false);
    const [recordMode, setRecordMode] = useState('idle'); // 'idle' | 'web-speech' | 'media-recorder'
    const [msg, setMsg] = useState(null);
    const [choices, setChoices] = useState(null); // خيارات قابلة للضغط من الوكيل
    const [confirmUi, setConfirmUi] = useState(null); // تأكيد إجراء واجهة (خروج/بدء جلسة)
    const [serverConfirm, setServerConfirm] = useState(null); // تأكيد عملية كتابة معلّقة في الخادم
    const [modal, setModal] = useState(null);
    const sessionIdRef = useRef('');
    const runRef = useRef(null);

    // مراجع دورة الحياة والأمان لتفادي تسريب الذاكرة والـ Race Conditions
    const recRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const maxRecordingTimerRef = useRef(null);
    const isMountedRef = useRef(true);

    const prefix = ROLE_PREFIX[(role || '').toLowerCase()];

    /**
     * إيقاف وتنظيف جميع موارد التسجيل (Web Speech + MediaRecorder + Stream Tracks)
     */
    const stopAllRecordings = useCallback(() => {
        if (maxRecordingTimerRef.current) {
            clearTimeout(maxRecordingTimerRef.current);
            maxRecordingTimerRef.current = null;
        }

        if (recRef.current) {
            try {
                recRef.current.onresult = null;
                recRef.current.onerror = null;
                recRef.current.onend = null;
                recRef.current.abort();
            } catch (e) {
                // تجاهل
            }
            recRef.current = null;
        }

        if (mediaRecorderRef.current) {
            try {
                if (mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                }
            } catch (e) {
                // تجاهل
            }
            mediaRecorderRef.current = null;
        }

        if (audioStreamRef.current) {
            try {
                audioStreamRef.current.getTracks().forEach((track) => track.stop());
            } catch (e) {
                // تجاهل
            }
            audioStreamRef.current = null;
        }

        audioChunksRef.current = [];

        if (isMountedRef.current) {
            setListening(false);
            setRecordMode('idle');
        }
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            stopAllRecordings();
        };
    }, [stopAllRecordings]);

    /**
     * تنفيذ إجراءات الواجهة الصادرة من الوكيل (قائمة بيضاء: انظر uiActions.js)
     */
    const applyActions = useCallback((actions) => {
        const handlers = {
            navigate: (route) => {
                navigate(route);
                setText('');
                setTimeout(() => {
                    if (isMountedRef.current) setOpen(false);
                }, 800);
            },
            logout: () => {
                logout();
                navigate('/login', { replace: true });
            },
            openModal: (name) => {
                setModal(name);
                setOpen(false);
            },
            showText: (t) => setMsg({ kind: 'info', text: t }),
            showChoices: (opts) => setChoices(opts),
            showConfirm: (c) => setConfirmUi(c),
            sendMessage: (t) => {
                if (runRef.current) runRef.current(t);
            },
        };
        (actions || []).forEach((a) => runUiAction(a, { prefix, handlers }));
    }, [navigate, logout, prefix]);

    /**
     * إرسال الرسالة إلى وكيل منارة (محادثة بجلسة) وتنفيذ ما يرجع
     */
    const run = useCallback(async (value) => {
        const q = (value || '').trim();
        if (!q) return;

        setBusy(true);
        setMsg(null);
        setChoices(null);
        setConfirmUi(null);
        setServerConfirm(null);

        try {
            const res = await sendAgentMessage(q, sessionIdRef.current);
            if (!isMountedRef.current) return;

            if (res.session_id) sessionIdRef.current = res.session_id;
            if (res.answer) {
                setMsg({ kind: res.ai_available === false ? 'err' : 'info', text: res.answer });
            }
            if (res.confirm_required?.confirm_token) {
                setServerConfirm({
                    token: res.confirm_required.confirm_token,
                    text: res.confirm_required.speak || res.answer,
                });
            }
            applyActions(res.ui_actions);
        } catch (err) {
            if (isMountedRef.current) {
                const errMsg = err.response?.data?.message || 'تعذّر الاتصال بالمساعد الذكي حالياً.';
                setMsg({ kind: 'err', text: errMsg });
            }
        } finally {
            if (isMountedRef.current) {
                setBusy(false);
            }
        }
    }, [applyActions]);

    useEffect(() => {
        runRef.current = run;
    }, [run]);

    /**
     * رد المستخدم (نعم/لا) على عملية كتابة معلّقة في الخادم
     */
    const answerServerConfirm = useCallback(async (utterance) => {
        const pending = serverConfirm;
        if (!pending) return;
        setServerConfirm(null);
        setBusy(true);
        try {
            const key = window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
            const res = await confirmAgentAction(pending.token, utterance, key);
            if (!isMountedRef.current) return;
            if (res.status === 'confirm_required' && res.confirm_token) {
                setServerConfirm({ token: res.confirm_token, text: res.speak });
            }
            setMsg({ kind: res.status === 'ok' ? 'ok' : 'info', text: res.speak || 'تم.' });
        } catch (err) {
            if (isMountedRef.current) {
                setMsg({ kind: 'err', text: err.response?.data?.message || 'تعذّر إكمال العملية.' });
            }
        } finally {
            if (isMountedRef.current) setBusy(false);
        }
    }, [serverConfirm]);

    /**
     * طلب أذونات الميكروفون صراحة من المتصفح لضمان ظهور نافذة الإذن للمستخدم
     * طلب أذونات الميكروفون صراحة من المتصفح لإظهار نافذة (سماح / حظر) للمستخدم
     */
    const requestMicrophonePermission = useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setMsg({
                kind: 'err',
                text: 'متصفحك لا يدعم الوصول للميكروفون. يمكنك كتابة الأمر نصياً.',
            });
            return null;
        }

        try {
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    const permStatus = await navigator.permissions.query({ name: 'microphone' });
                    if (permStatus.state === 'prompt' && isMountedRef.current) {
                        setMsg({
                            kind: 'info',
                            text: 'يرجى الضغط على «سماح / Allow» في نافذة المتصفح العلوية لتفعيل الميكروفون...',
                        });
                    }
                } catch {
                    // بعض المتصفحات لا تدعم استعلام microphone في permissions API
                }
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            return stream;
        } catch (err) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setMsg({
                    kind: 'err',
                    text: 'تم حظر إذن الميكروفون. اضغط على أيقونة القفل 🔒 بجانب رابط الموقع في الأعلى واختر «سماح» للميكروفون.',
                });
            } else {
                setMsg({
                    kind: 'err',
                    text: 'تعذر الوصول لجهاز الميكروفون، تأكد من توصيله بشكل صحيح أو اكتب الأمر نصياً.',
                });
            }
            return null;
        }
    }, []);

    /**
     * تشغيل التسجيل الصوتي عبر MediaRecorder وإرسال الملف للخادم
     */
    const startMediaRecorderFallback = useCallback(async (existingStream = null) => {
        stopAllRecordings();

        let stream = existingStream;
        if (!stream) {
            stream = await requestMicrophonePermission();
        }

        if (!stream || !isMountedRef.current) return;

        const mimeType = getSupportedAudioMimeType();
        audioChunksRef.current = [];
        audioStreamRef.current = stream;

        try {
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onerror = () => {
                stopAllRecordings();
                if (isMountedRef.current) {
                    setMsg({ kind: 'err', text: 'تعذّر إكمال التسجيل الصوتي عبر المسجل الاحتياطي.' });
                }
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, {
                    type: recorder.mimeType || mimeType || 'audio/webm',
                });
                audioChunksRef.current = [];

                if (audioStreamRef.current) {
                    audioStreamRef.current.getTracks().forEach((t) => t.stop());
                    audioStreamRef.current = null;
                }

                if (!isMountedRef.current) return;

                if (audioBlob.size < 200) {
                    setMsg({ kind: 'info', text: 'التسجيل الصوتي قصير جداً، حاول مجدداً.' });
                    setListening(false);
                    setRecordMode('idle');
                    return;
                }

                setBusy(true);
                setMsg({ kind: 'info', text: 'جاري إرسال ومعالجة الصوت عبر خادم المنصة...' });

                try {
                    const transcribed = await transcribeAudioCommand(
                        audioBlob,
                        recorder.mimeType || mimeType || 'audio/webm'
                    );

                    if (!isMountedRef.current) return;

                    if (transcribed && transcribed.trim()) {
                        setText(transcribed.trim());
                        await run(transcribed.trim());
                    } else {
                        setMsg({
                            kind: 'err',
                            text: 'لم يتم التقاط نص واضح من التسجيل، حاول مجدداً أو اكتب الأمر.',
                        });
                    }
                } catch (sttErr) {
                    if (isMountedRef.current) {
                        setMsg({
                            kind: 'err',
                            text: 'تعذر تفريغ الصوت عبر الخادم، يمكنك كتابة الأمر نصياً.',
                        });
                    }
                } finally {
                    if (isMountedRef.current) {
                        setBusy(false);
                        setListening(false);
                        setRecordMode('idle');
                    }
                }
            };

            recorder.start(250);
            setListening(true);
            setRecordMode('media-recorder');
            setMsg({
                kind: 'info',
                text: 'أستمع إليك عبر مسجل المنصة... اضغط الميكروفون ثانية لإرسال الأمر.',
            });

            maxRecordingTimerRef.current = setTimeout(() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            }, 15000);
        } catch (err) {
            stopAllRecordings();
            if (isMountedRef.current) {
                setMsg({ kind: 'err', text: 'تعذر تهيئة المسجل الصوتي الداخلي.' });
            }
        }
    }, [stopAllRecordings, requestMicrophonePermission, run]);

    /**
     * تشغيل Web Speech API أو التحول الفوري لـ MediaRecorder
     */
    const startWebSpeech = useCallback(async () => {
        // طلب إذن الميكروفون مرة واحدة فقط (يُظهر نافذة السماح للمستخدم)
        const stream = await requestMicrophonePermission();
        if (!stream) return;

        const SpeechClass = getSpeechRecognitionClass();
        // المتصفح لا يدعم Web Speech API -> نستخدم المسجل الداخلي بنفس التدفق
        if (!SpeechClass) {
            startMediaRecorderFallback(stream);
            return;
        }

        // Web Speech يفتح الميكروفون بنفسه: نحرر تدفق الفحص ونمهل بطاقة الصوت لحظة
        stream.getTracks().forEach((t) => t.stop());
        await new Promise((resolve) => setTimeout(resolve, 80));

        if (!isMountedRef.current) return;
        stopAllRecordings();

        try {
            const rec = new SpeechClass();
            recRef.current = rec;
            rec.lang = 'ar-SA';
            rec.continuous = false;
            rec.interimResults = true;
            rec.maxAlternatives = 1;

            rec.onstart = () => {
                if (!isMountedRef.current) return;
                setListening(true);
                setRecordMode('web-speech');
                setMsg(null);
            };

            rec.onresult = (ev) => {
                if (!isMountedRef.current) return;
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = ev.resultIndex; i < ev.results.length; ++i) {
                    const part = ev.results[i][0]?.transcript || '';
                    if (ev.results[i].isFinal) {
                        finalTranscript += part;
                    } else {
                        interimTranscript += part;
                    }
                }

                const currentPreview = (finalTranscript || interimTranscript).trim();
                if (currentPreview) {
                    setText(currentPreview);
                }

                if (finalTranscript.trim()) {
                    try {
                        rec.stop();
                    } catch (e) {
                        // تجاهل
                    }
                    setListening(false);
                    setRecordMode('idle');
                    run(finalTranscript.trim());
                }
            };

            rec.onerror = (ev) => {
                const err = ev.error;
                stopAllRecordings();
                if (!isMountedRef.current) return;

                if (err === 'not-allowed' || err === 'service-not-allowed') {
                    setMsg({
                        kind: 'err',
                        text: 'تم حظر إذن الميكروفون. اضغط على أيقونة القفل 🔒 بجانب رابط الموقع في الأعلى واختر «سماح» للميكروفون.',
                    });
                } else if (err === 'network') {
                    setMsg({
                        kind: 'info',
                        text: 'خدمة التعرف السحابية غير متاحة (حظر جغرافي/شبكة). جاري التبديل لمسجل المنصة...',
                    });
                    startMediaRecorderFallback();
                } else if (err === 'no-speech') {
                    setMsg({
                        kind: 'info',
                        text: 'لم يتم التقاط أي صوت، يرجى الضغط والتحدث بوضوح.',
                    });
                } else if (err === 'audio-capture') {
                    setMsg({
                        kind: 'err',
                        text: 'تعذر الوصول لجهاز الميكروفون، تأكد من توصيله وعدم استخدامه بواسطة برنامج آخر.',
                    });
                } else {
                    startMediaRecorderFallback();
                }
            };

            rec.onend = () => {
                if (isMountedRef.current && recordMode === 'web-speech') {
                    setListening(false);
                    setRecordMode('idle');
                }
            };

            rec.start();
        } catch (e) {
            startMediaRecorderFallback();
        }
    }, [requestMicrophonePermission, stopAllRecordings, startMediaRecorderFallback, recordMode, run]);

    /**
     * زر التبديل الرئيسي للميكروفون
     */
    const toggleMic = useCallback(() => {
        if (!isSecureEnvironment()) {
            setMsg({
                kind: 'err',
                text: 'يتطلب الإدخال الصوتي اتصالاً آمناً (HTTPS). يرجى استخدام الإدخال النصي.',
            });
            return;
        }

        if (listening) {
            if (recordMode === 'media-recorder' && mediaRecorderRef.current) {
                if (mediaRecorderRef.current.state === 'recording') {
                    mediaRecorderRef.current.stop();
                }
            } else {
                stopAllRecordings();
            }
            return;
        }

        startWebSpeech();
    }, [listening, recordMode, stopAllRecordings, startWebSpeech]);

    if (!prefix) return null;

    return (
        <>
            <button
                className="agent-fab"
                onClick={() => setOpen((o) => !o)}
                aria-label="مساعد منارة الذكي"
                title="مساعد منارة الذكي"
            >
                {open ? <X size={24} weight="bold" /> : <Sparkle size={24} weight="fill" />}
            </button>

            {open && (
                <div className="agent-panel" dir="rtl" role="dialog" aria-label="أوامر منصة منارة">
                    <div className="agent-header">
                        <div className="agent-title">
                            <Sparkle size={18} weight="fill" style={{ color: 'var(--primary-green, #166534)' }} />
                            <span>مساعد منارة الذكي</span>
                        </div>
                        {recordMode === 'media-recorder' && (
                            <span className="agent-mode-badge fallback">مسجل المنصة الداخلي</span>
                        )}
                    </div>

                    <form
                        className="agent-row"
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(text);
                        }}
                    >
                        <button
                            type="button"
                            className={`agent-mic ${listening ? 'on' : ''} ${
                                recordMode === 'media-recorder' ? 'fallback-active' : ''
                            }`}
                            onClick={toggleMic}
                            disabled={busy}
                            aria-label={listening ? 'إيقاف التسجيل' : 'تحدث الآن'}
                            title={listening ? 'إيقاف التسجيل' : 'تحدث بالصوت'}
                        >
                            <Microphone size={20} weight={listening ? 'fill' : 'bold'} />
                        </button>

                        <input
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={
                                listening
                                    ? recordMode === 'media-recorder'
                                        ? 'أستمع إليك عبر مسجل المنصة...'
                                        : 'أستمع إليك الآن... قل أمرك'
                                    : 'اكتب أو قل أمرك: افتح التسميع'
                            }
                            disabled={busy}
                            autoFocus
                        />

                        <button
                            type="submit"
                            className="agent-send"
                            disabled={busy || !text.trim()}
                            aria-label="إرسال"
                            title="إرسال"
                        >
                            {busy ? (
                                <CircleNotch size={18} weight="bold" className="agent-spin" />
                            ) : (
                                <PaperPlaneRight size={18} weight="fill" />
                            )}
                        </button>
                    </form>

                    {msg && (
                        <div className={`agent-msg ${msg.kind}`}>
                            {msg.kind === 'err' && (
                                <WarningCircle
                                    size={16}
                                    weight="fill"
                                    style={{ marginInlineEnd: 6, verticalAlign: 'text-bottom' }}
                                />
                            )}
                            {msg.text}
                        </div>
                    )}

                    {choices && choices.length > 0 && (
                        <div className="agent-choices-list">
                            {choices.map((c, i) => (
                                <button
                                    key={`${c.label}-${i}`}
                                    type="button"
                                    className="agent-choice"
                                    onClick={() => {
                                        setChoices(null);
                                        applyActions([c.action]);
                                    }}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {confirmUi && (
                        <div className="agent-confirm">
                            <button
                                type="button"
                                onClick={() => {
                                    const c = confirmUi;
                                    setConfirmUi(null);
                                    applyActions(c.onConfirm);
                                }}
                            >
                                نعم
                            </button>
                            <button
                                type="button"
                                className="ghost"
                                onClick={() => {
                                    setConfirmUi(null);
                                    setMsg({ kind: 'info', text: 'تم الإلغاء.' });
                                }}
                            >
                                لا
                            </button>
                        </div>
                    )}

                    {serverConfirm && (
                        <div className="agent-confirm">
                            <button type="button" disabled={busy} onClick={() => answerServerConfirm('نعم')}>
                                نعم، نفّذ
                            </button>
                            <button
                                type="button"
                                className="ghost"
                                disabled={busy}
                                onClick={() => answerServerConfirm('لا')}
                            >
                                إلغاء
                            </button>
                        </div>
                    )}
                </div>
            )}

            {modal === 'change_password' && (
                <ChangePasswordModal isOpen onClose={() => setModal(null)} />
            )}
        </>
    );
};

export default AgentCommandButton;

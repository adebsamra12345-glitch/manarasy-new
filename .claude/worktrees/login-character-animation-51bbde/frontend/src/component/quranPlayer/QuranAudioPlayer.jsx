import { useState, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import './quranPlayer.css';

/**
 * QuranAudioPlayer — مشغّل التلاوات الصوتية
 * Props:
 *   audioUrl: string   — رابط الملف الصوتي
 *   title: string      — اسم السورة / الآية
 */
const QuranAudioPlayer = ({ audioUrl, title = 'التلاوة القرآنية' }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const toggleMute = () => {
        if (!audioRef.current) return;
        audioRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setProgress(isNaN(pct) ? 0 : pct);
    };

    const handleSeek = (e) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = (e.target.value / 100) * audioRef.current.duration;
        setProgress(e.target.value);
    };

    return (
        <div className="quran-player">
            <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
            />
            <div className="player-title">{title}</div>
            <div className="player-controls">
                <button className="player-btn" onClick={() => { if (audioRef.current) audioRef.current.currentTime = 0; }}>
                    <SkipBack size={20} />
                </button>
                <button className="player-btn play-btn" onClick={togglePlay}>
                    {isPlaying ? <Pause size={24} weight="fill" /> : <Play size={24} weight="fill" />}
                </button>
                <button className="player-btn" onClick={toggleMute}>
                    {isMuted ? <SpeakerSlash size={20} /> : <SpeakerHigh size={20} />}
                </button>
            </div>
            <input
                className="player-progress"
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={handleSeek}
            />
        </div>
    );
};

export default QuranAudioPlayer;

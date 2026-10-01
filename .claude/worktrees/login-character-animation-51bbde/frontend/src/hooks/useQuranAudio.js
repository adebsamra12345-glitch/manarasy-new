import { useState, useRef, useCallback } from 'react';

/**
 * useQuranAudio — إدارة مشغّل الصوت القرآني
 */
export const useQuranAudio = () => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrack, setCurrentTrack] = useState(null);

    const play = useCallback((url, title) => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        audioRef.current = new Audio(url);
        audioRef.current.play();
        audioRef.current.onended = () => setIsPlaying(false);
        setCurrentTrack({ url, title });
        setIsPlaying(true);
    }, []);

    const pause = useCallback(() => {
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
    }, []);

    const stop = useCallback(() => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        setIsPlaying(false);
        setCurrentTrack(null);
    }, []);

    return { isPlaying, currentTrack, play, pause, stop };
};

export default useQuranAudio;

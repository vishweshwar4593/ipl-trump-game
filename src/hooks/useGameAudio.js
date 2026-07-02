import { useState, useEffect, useRef, useCallback } from "react";
import clickSound from "../assets/sounds/click.wav";
import winSound from "../assets/sounds/win.wav";
import loseSound from "../assets/sounds/lose.wav";
import hitSound from "../assets/sounds/hit.wav";

export function useGameAudio() {
  const clickAudio = useRef(new Audio(clickSound));
  const winAudio = useRef(new Audio(winSound));
  const loseAudio = useRef(new Audio(loseSound));
  const hitAudio = useRef(new Audio(hitSound));

  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem("isMuted") === "true";
  });

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newVal = !prev;
      localStorage.setItem("isMuted", String(newVal));
      return newVal;
    });
  }, []);

  useEffect(() => {
    // Configure volumes
    clickAudio.current.volume = 0.5;
    winAudio.current.volume = 0.7;
    loseAudio.current.volume = 0.7;
    hitAudio.current.volume = 0.6;

    // Preload audio files within the React lifecycle
    clickAudio.current.preload = "auto";
    winAudio.current.preload = "auto";
    loseAudio.current.preload = "auto";
    hitAudio.current.preload = "auto";
  }, []);

  useEffect(() => {
    clickAudio.current.muted = isMuted;
    winAudio.current.muted = isMuted;
    loseAudio.current.muted = isMuted;
    hitAudio.current.muted = isMuted;
  }, [isMuted]);

  const playClick = useCallback(() => {
    clickAudio.current.currentTime = 0;
    clickAudio.current.play().catch(() => {});
  }, []);

  const playWin = useCallback(() => {
    winAudio.current.currentTime = 0;
    winAudio.current.play().catch(() => {});
  }, []);

  const playLose = useCallback(() => {
    loseAudio.current.currentTime = 0;
    loseAudio.current.play().catch(() => {});
  }, []);

  const playHit = useCallback(() => {
    hitAudio.current.currentTime = 0;
    hitAudio.current.play().catch(() => {});
  }, []);

  return {
    isMuted,
    toggleMute,
    playClick,
    playWin,
    playLose,
    playHit,
  };
}

import type { SoundTone } from "@/lib/types";

export const SOUND_TONE_OPTIONS: { value: SoundTone; label: string }[] = [
  { value: "bell", label: "Bell" },
  { value: "chime", label: "Chime" },
  { value: "alert", label: "Alert" },
  { value: "soft", label: "Soft" },
];

// Plays a short notification tone using the Web Audio API - no audio files
// to host or fetch, everything is generated on the fly in the browser.
export function playTone(tone: SoundTone) {
  if (typeof window === "undefined") return;
  const AudioCtxClass =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return;

  try {
    const ctx = new AudioCtxClass();
    const now = ctx.currentTime;

    function beep(freq: number, start: number, duration: number, gain = 0.2) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(gain, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    }

    switch (tone) {
      case "bell":
        beep(1046.5, 0, 0.5);
        beep(1568, 0.05, 0.4);
        break;
      case "chime":
        beep(880, 0, 0.25);
        beep(1108.7, 0.15, 0.25);
        beep(1318.5, 0.3, 0.4);
        break;
      case "alert":
        beep(660, 0, 0.15);
        beep(660, 0.2, 0.15);
        beep(660, 0.4, 0.25);
        break;
      case "soft":
        beep(523.25, 0, 0.6, 0.12);
        break;
    }

    setTimeout(() => ctx.close(), 1200);
  } catch {
    // Audio isn't available in this context (e.g. autoplay blocked before
    // any user interaction) - silently skip rather than breaking the page.
  }
}

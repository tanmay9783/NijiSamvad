// Synthesize nice notification sounds without needing audio files

let audioCtx = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const playNotificationSound = (type = 'receive') => {
  try {
    initAudio();
    if (!audioCtx) return;

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'receive') {
      // Gentle double chime (glassy)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.1); // E5
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (type === 'send') {
      // Soft pop
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      
      osc.start(t);
      osc.stop(t + 0.1);
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

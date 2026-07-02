// Web Audio API Synthesized Sound Effects
// Dynamically generates UI feedback sounds so the app needs no external MP3 dependencies.

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Custom oscillators / envelopes for different sound effects

export const SoundEffects = {
  // Play a standard notification sound for incoming chat message
  playMessageReceived() {
    try {
      const ctx = getAudioContext();
      const time = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, time); // C5
      osc1.frequency.exponentialRampToValueAtTime(783.99, time + 0.1); // G5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1046.50, time); // C6
      osc2.frequency.exponentialRampToValueAtTime(1567.98, time + 0.1); // G6

      gainNode.gain.setValueAtTime(0.15, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 0.25);
      osc2.stop(time + 0.25);
    } catch (e) {
      console.warn("Failed to play message received sound", e);
    }
  },

  // Play a sound for outgoing chat message
  playMessageSent() {
    try {
      const ctx = getAudioContext();
      const time = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, time); // D5
      osc.frequency.exponentialRampToValueAtTime(440.00, time + 0.08); // A4

      gainNode.gain.setValueAtTime(0.08, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.12);
    } catch (e) {
      console.warn("Failed to play message sent sound", e);
    }
  },

  // Play an ascending chime on call connect
  playCallConnected() {
    try {
      const ctx = getAudioContext();
      const time = ctx.currentTime;

      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      const noteDuration = 0.08;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time + idx * noteDuration);

        gainNode.gain.setValueAtTime(0, time + idx * noteDuration);
        gainNode.gain.linearRampToValueAtTime(0.12, time + idx * noteDuration + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + idx * noteDuration + noteDuration * 1.5);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(time + idx * noteDuration);
        osc.stop(time + idx * noteDuration + noteDuration * 1.6);
      });
    } catch (e) {
      console.warn("Failed to play call connected sound", e);
    }
  },

  // Play a descending tone sequence on disconnect
  playCallDisconnected() {
    try {
      const ctx = getAudioContext();
      const time = ctx.currentTime;

      const notes = [392.00, 329.63, 261.63, 196.00]; // G4, E4, C4, G3
      const noteDuration = 0.12;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time + idx * noteDuration);

        gainNode.gain.setValueAtTime(0.1, time + idx * noteDuration);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + idx * noteDuration + noteDuration * 1.2);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(time + idx * noteDuration);
        osc.stop(time + idx * noteDuration + noteDuration * 1.3);
      });
    } catch (e) {
      console.warn("Failed to play call disconnected sound", e);
    }
  },

  // Play outgoing ringing loop
  // Returns a controller object to stop the ringtone loop
  startOutgoingRing() {
    try {
      const ctx = getAudioContext();
      let isPlaying = true;
      let intervalId = null;
      let activeOscs = [];
      let activeGains = [];

      const playRingCycle = () => {
        if (!isPlaying) return;
        const time = ctx.currentTime;

        // Clean out any stale nodes
        activeOscs = [];
        activeGains = [];

        // Outgoing ring is traditionally dual frequency (440Hz + 480Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, time);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, time);

        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.08, time + 0.1);
        gainNode.gain.setValueAtTime(0.08, time + 1.8);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 2.0);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 2.0);
        osc2.stop(time + 2.0);

        activeOscs.push(osc1, osc2);
        activeGains.push(gainNode);
      };

      // Play immediately and then repeat every 3 seconds (2s sound, 1s silence)
      playRingCycle();
      intervalId = setInterval(playRingCycle, 3000);

      return {
        stop() {
          isPlaying = false;
          clearInterval(intervalId);
          // Immediately fade out and stop any current playing frequencies
          const now = ctx.currentTime;
          activeGains.forEach(g => {
            try {
              g.gain.cancelScheduledValues(now);
              g.gain.linearRampToValueAtTime(0, now + 0.1);
            } catch (err) {}
          });
          setTimeout(() => {
            activeOscs.forEach(o => {
              try { o.stop(); } catch (err) {}
            });
          }, 150);
        }
      };
    } catch (e) {
      console.warn("Failed to start outgoing ringtone", e);
      return { stop() {} };
    }
  },

  // Play incoming ringing loop
  // Returns a controller object to stop the ringtone loop
  startIncomingRing() {
    try {
      const ctx = getAudioContext();
      let isPlaying = true;
      let intervalId = null;
      let activeOscs = [];
      let activeGains = [];

      const playRingCycle = () => {
        if (!isPlaying) return;
        const time = ctx.currentTime;

        activeOscs = [];
        activeGains = [];

        // Elegant European double-ring style: 425Hz ringing
        // Ring 1 (0.4s) -> Silence (0.2s) -> Ring 2 (0.4s) -> Silence (2s)
        const runRing = (startTime, duration) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(425, startTime);

          // Add a subtle tremolo
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          lfo.frequency.setValueAtTime(25, startTime);
          lfoGain.gain.setValueAtTime(10, startTime);
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);

          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
          gainNode.gain.setValueAtTime(0.12, startTime + duration - 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          lfo.start(startTime);
          osc.start(startTime);
          lfo.stop(startTime + duration);
          osc.stop(startTime + duration);

          activeOscs.push(osc, lfo);
          activeGains.push(gainNode);
        };

        runRing(time, 0.4);
        runRing(time + 0.6, 0.4);
      };

      playRingCycle();
      intervalId = setInterval(playRingCycle, 3000);

      return {
        stop() {
          isPlaying = false;
          clearInterval(intervalId);
          const now = ctx.currentTime;
          activeGains.forEach(g => {
            try {
              g.gain.cancelScheduledValues(now);
              g.gain.linearRampToValueAtTime(0, now + 0.1);
            } catch (err) {}
          });
          setTimeout(() => {
            activeOscs.forEach(o => {
              try { o.stop(); } catch (err) {}
            });
          }, 150);
        }
      };
    } catch (e) {
      console.warn("Failed to start incoming ringtone", e);
      return { stop() {} };
    }
  }
};

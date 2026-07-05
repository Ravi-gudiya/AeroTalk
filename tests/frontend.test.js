import { describe, it, expect } from 'vitest';

// Mock browser globals for frontend testing
global.window = {
  AudioContext: function() {
    return {
      createOscillator: () => ({
        connect: () => {},
        start: () => {},
        stop: () => {},
        frequency: {
          value: 0,
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          linearRampToValueAtTime: () => {}
        }
      }),
      createGain: () => ({
        connect: () => {},
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
          cancelScheduledValues: () => {}
        }
      }),
      currentTime: 0,
      destination: {}
    };
  },
  setInterval: (fn) => { fn(); return 1; },
  clearInterval: () => {},
  setTimeout: (fn) => fn()
};

import { SoundEffects } from '../frontend/src/sound-effects.js';

describe('Frontend Layer Unit Tests', () => {
  it('should initialize SoundEffects and verify play methods', () => {
    expect(SoundEffects).toBeDefined();
    
    // Test that the helper methods do not throw when called
    expect(() => SoundEffects.playMessageReceived()).not.toThrow();
    expect(() => SoundEffects.playMessageSent()).not.toThrow();
    expect(() => SoundEffects.playCallConnected()).not.toThrow();
    expect(() => SoundEffects.playCallDisconnected()).not.toThrow();
    
    // Outgoing ring
    const outRing = SoundEffects.startOutgoingRing();
    expect(outRing).toBeDefined();
    expect(() => outRing.stop()).not.toThrow();

    // Incoming ring
    const inRing = SoundEffects.startIncomingRing();
    expect(inRing).toBeDefined();
    expect(() => inRing.stop()).not.toThrow();
  });
});

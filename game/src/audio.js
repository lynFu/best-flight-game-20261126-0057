// audio.js — every sound is synthesised with WebAudio: no audio files.
// One job: engine hum, wind, ring chimes and landing sounds from oscillators.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let windSrc = null;
  let started = false;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // Engine: two detuned saws through a low-pass filter.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 82.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise through a band-pass filter.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    windSrc = ctx.createBufferSource();
    windSrc.buffer = buf;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windSrc.start();
  }

  function tone(freq, at, dur, type = 'sine', vol = 0.16) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  return {
    // Call on the first user gesture; browsers block audio before that.
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      started = true;
    },
    update(throttle, speed, flying) {
      if (!ctx || !started) return;
      const now = ctx.currentTime;
      const target = flying ? 0.05 + throttle * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, now, 0.1);
      if (engineOsc) engineOsc.frequency.setTargetAtTime(50 + throttle * 70, now, 0.1);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.09, speed * 0.0012) : 0, now, 0.15);
    },
    ring() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(880, t, 0.35);
      tone(1318, t + 0.09, 0.45);
    },
    crash() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(70, t, 0.7, 'sine', 0.3);
      tone(45, t + 0.05, 0.8, 'triangle', 0.25);
    },
    land() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.12, 0.4));
    },
    click() {
      if (!ctx) return;
      tone(660, ctx.currentTime, 0.08, 'square', 0.06);
    },
  };
}

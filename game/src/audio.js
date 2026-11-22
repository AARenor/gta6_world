// All sound is synthesised at run time: no files, no network. A noise buffer and a handful of
// oscillators make gunshots, crashes, explosions, the siren bed, the engine, pickups and menu
// clicks. Nothing starts until the player's first gesture, and a missing AudioContext simply
// leaves the game silent.

export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let sirenNode = null;
  let engineNode = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.36;
    master.connect(ctx.destination);
    const length = Math.floor(ctx.sampleRate * 0.6);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let k = 0; k < length; k += 1) data[k] = Math.random() * 2 - 1;
    return true;
  }

  function envelope(node, peak, attack, decay) {
    const t = ctx.currentTime;
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function burst(duration, peak, filterHz, type = 'lowpass') {
    if (!ensure() || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterHz;
    const gain = ctx.createGain();
    envelope(gain, peak, 0.005, duration);
    src.connect(filter).connect(gain).connect(master);
    src.start();
    src.stop(ctx.currentTime + duration + 0.05);
  }

  function tone(freq, duration, peak, type = 'sine', slide = 0) {
    if (!ensure() || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), ctx.currentTime + duration);
    const gain = ctx.createGain();
    envelope(gain, peak, 0.008, duration);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.06);
  }

  function gunshot(volume = 1) {
    burst(0.16, 0.55 * volume, 1600);
    tone(96, 0.12, 0.16 * volume, 'triangle', -40);
  }

  function crash(volume = 1) {
    burst(0.3, Math.min(0.5, 0.16 * volume), 700);
    tone(58, 0.2, 0.1 * volume, 'sawtooth', -20);
  }

  function explosion() {
    burst(0.85, 0.7, 420);
    tone(44, 0.7, 0.35, 'sine', -24);
    burst(0.4, 0.3, 2000);
  }

  function sirenSting() {
    tone(760, 0.22, 0.12, 'square', 240);
    window.setTimeout(() => tone(620, 0.26, 0.1, 'square', -180), 180);
  }

  function jobStart() {
    tone(392, 0.16, 0.12, 'triangle');
    window.setTimeout(() => tone(523, 0.18, 0.12, 'triangle'), 120);
    window.setTimeout(() => tone(659, 0.3, 0.12, 'triangle'), 250);
  }

  function payoff() {
    tone(880, 0.12, 0.1, 'square');
    window.setTimeout(() => tone(1174, 0.12, 0.1, 'square'), 100);
    window.setTimeout(() => tone(1568, 0.34, 0.1, 'square'), 200);
  }

  function click() { tone(640, 0.045, 0.06, 'square'); }
  function pickup() { tone(660, 0.08, 0.09, 'triangle'); window.setTimeout(() => tone(990, 0.14, 0.09, 'triangle'), 70); }
  function door() { burst(0.08, 0.16, 900); }
  function carjack() { burst(0.16, 0.22, 700); tone(180, 0.16, 0.08, 'sawtooth', 90); }
  function engineStart() { tone(70, 0.35, 0.14, 'sawtooth', 90); }
  function reload() { burst(0.05, 0.12, 2600); window.setTimeout(() => burst(0.06, 0.14, 1800), 260); }
  function hurt() { tone(160, 0.16, 0.14, 'sawtooth', -60); }

  function setSiren(level) {
    if (!ensure()) return;
    if (level > 0 && !sirenNode) {
      sirenNode = ctx.createOscillator();
      sirenNode.type = 'triangle';
      sirenNode.frequency.value = 520;
      const gain = ctx.createGain();
      gain.gain.value = 0.045;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain).connect(sirenNode.frequency);
      sirenNode.connect(gain).connect(master);
      sirenNode.start();
      lfo.start();
      sirenNode.lfo = lfo;
    } else if (level === 0 && sirenNode) {
      try {
        sirenNode.stop();
        sirenNode.lfo.stop();
      } catch {
        // Already stopped.
      }
      sirenNode = null;
    }
  }

  function setEngine(on, speed) {
    if (!ensure()) return;
    if (on && !engineNode) {
      engineNode = ctx.createOscillator();
      engineNode.type = 'sawtooth';
      engineNode.frequency.value = 70;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.012;
      engineNode.connect(engineGain).connect(master);
      engineNode.start();
    } else if (!on && engineNode) {
      try {
        engineNode.stop();
      } catch {
        // Already stopped.
      }
      engineNode = null;
      engineGain = null;
    }
    if (engineNode) engineNode.frequency.value = 58 + Math.min(180, Math.abs(speed) * 0.24);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.36;
    return muted;
  }

  return {
    ensure, gunshot, crash, explosion, sirenSting, jobStart, payoff, click, pickup,
    door, carjack, engineStart, reload, hurt, setSiren, setEngine, toggleMute,
  };
}

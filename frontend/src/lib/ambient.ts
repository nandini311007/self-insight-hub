// Meditative ambient sound, synthesized with the Web Audio API — no audio assets to ship.
// A soft low drone plus filtered "breathing" noise, faded in and out so it never clicks.
// Playback only ever starts from a user gesture (the toggle), so autoplay policy is satisfied.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let nodes: { stop: () => void } | null = null;

const STORAGE_KEY = "sih-ambient-on";

type Ctor = typeof AudioContext;

function audioContextCtor(): Ctor | null {
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function buildNoiseBuffer(context: AudioContext): AudioBuffer {
  const seconds = 4;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  // Brown-ish noise: gentler and less hissy than white noise.
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

export function isAmbientOn(): boolean {
  return nodes !== null;
}

export function loadAmbientPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function savePreference(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // Storage can be blocked; the toggle still works for this session.
  }
}

export async function startAmbient(): Promise<boolean> {
  if (nodes) return true;
  const Ctor = audioContextCtor();
  if (!Ctor) return false;

  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") await ctx.resume();

  master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 2.5); // slow fade in
  master.connect(ctx.destination);

  // Two detuned sine drones a fifth apart — calm, not musical enough to distract.
  const drones = [110, 164.81].map((freq, i) => {
    const osc = ctx!.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx!.createGain();
    gain.gain.value = i === 0 ? 0.5 : 0.25;
    osc.connect(gain).connect(master!);
    osc.start();
    return { osc, gain };
  });

  // Slow LFO on the drone level: an unhurried "breath" roughly every 11 seconds.
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.09;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.16;
  lfo.connect(lfoGain).connect(drones[0].gain.gain);
  lfo.start();

  // Filtered brown noise: a distant, airy wash.
  const noise = ctx.createBufferSource();
  noise.buffer = buildNoiseBuffer(ctx);
  noise.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.5;
  noise.connect(lp).connect(noiseGain).connect(master);
  noise.start();

  nodes = {
    stop: () => {
      drones.forEach(({ osc }) => {
        try {
          osc.stop();
        } catch {
          // already stopped
        }
      });
      try {
        lfo.stop();
      } catch {
        // already stopped
      }
      try {
        noise.stop();
      } catch {
        // already stopped
      }
    },
  };

  savePreference(true);
  return true;
}

export function stopAmbient(): void {
  savePreference(false);
  if (!nodes || !ctx || !master) {
    nodes = null;
    return;
  }
  const current = nodes;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.8); // fade out, no click
  nodes = null;
  window.setTimeout(() => current.stop(), 900);
}

export async function toggleAmbient(): Promise<boolean> {
  if (nodes) {
    stopAmbient();
    return false;
  }
  return await startAmbient();
}

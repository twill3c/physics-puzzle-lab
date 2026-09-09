/**
 * 効果音。原仕様 §41。
 *
 * **音声ファイルを持たない。** Web Audio API でその場で作る。
 * 外部素材を持たないという方針(SPEC N-03)と、著作権・容量・
 * CDN 依存を避けるためである(原仕様 §69)。
 *
 * **既定は OFF。** 断りなく音が出るほうが驚きが大きい。設定は
 * LocalStorage に載る(`settings.sound`)。
 */

export type SoundEvent = "click" | "collision" | "spring" | "goal" | "clear" | "fail";

/** 音ごとの素の形。周波数(Hz)・長さ(秒)・波形。 */
const VOICES: Record<SoundEvent, { freq: number; to?: number; dur: number; type: OscillatorType; gain: number }> = {
  click: { freq: 440, dur: 0.05, type: "square", gain: 0.05 },
  collision: { freq: 180, dur: 0.06, type: "triangle", gain: 0.05 },
  spring: { freq: 300, to: 700, dur: 0.16, type: "sine", gain: 0.07 },
  goal: { freq: 660, to: 880, dur: 0.22, type: "sine", gain: 0.08 },
  clear: { freq: 523, to: 1046, dur: 0.45, type: "sine", gain: 0.09 },
  fail: { freq: 220, to: 110, dur: 0.3, type: "sawtooth", gain: 0.06 },
};

let ctx: AudioContext | null = null;

/**
 * AudioContext を取る。
 *
 * ブラウザは利用者の操作より前に音を鳴らすことを許さないので、
 * 実際に鳴らす時点で作る。作れない環境では null を返し、**黙って鳴らさない** ——
 * 音が出ないことでアプリが止まる理由が無い。
 */
function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 1 音鳴らす。`enabled` が偽なら何もしない。 */
export function playSound(event: SoundEvent, enabled: boolean): void {
  if (!enabled) return;

  const audio = audioContext();
  if (!audio) return;

  try {
    const v = VOICES[event];
    const now = audio.currentTime;

    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = v.type;
    osc.frequency.setValueAtTime(v.freq, now);
    if (v.to !== undefined) osc.frequency.exponentialRampToValueAtTime(v.to, now + v.dur);

    // 立ち上がりと減衰を付ける。矩形のままだとプチッと鳴る。
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(v.gain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + v.dur);

    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + v.dur + 0.02);
  } catch {
    // 音が出ないことでアプリが止まる理由が無い。
  }
}

/** 一覧(設定画面や検査から数えるため)。 */
export const SOUND_EVENTS: SoundEvent[] = ["click", "collision", "spring", "goal", "clear", "fail"];

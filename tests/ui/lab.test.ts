import { describe, it, expect } from "vitest";

import {
  LAB_SLIDERS,
  defaultLabParams,
  applyLabPreset,
  labReadouts,
  velocityArrow,
  buildLabStage,
} from "@/lib/lab";
import { LAB_PRESETS } from "@/physics/presets";
import { GRAVITY_PRESETS } from "@/lib/constants";
import { Simulation } from "@/physics/world";
import { validateStage } from "@/game/validation";

/**
 * F-19〜F-22 — Lab Mode。原仕様 §30〜§35。
 *
 * 検査するのは純粋な部分(プリセットの値・状態量の導出・ベクトルの向きと長さ)。
 * 画面そのものは実ブラウザで見る(SPEC D-12)。
 */

describe("T-070 スライダーが原仕様 §32 の 10 項目を覆う(F-19)", () => {
  const expected = [
    "gravity",
    "gravityDirection",
    "friction",
    "airResistance",
    "restitution",
    "ballMass",
    "boardAngle",
    "fanForce",
    "springStrength",
    "timeScale",
  ];

  it("項目が過不足なく揃っている", () => {
    expect(LAB_SLIDERS.map((s) => s.key).sort()).toEqual([...expected].sort());
  });

  it("各項目に範囲と刻みがあり、既定値がその範囲に収まる", () => {
    const params = defaultLabParams();

    for (const s of LAB_SLIDERS) {
      expect(s.min, s.key).toBeLessThan(s.max);
      expect(s.step, s.key).toBeGreaterThan(0);

      const value = s.get(params);
      expect(value, `${s.key} の既定値が範囲外`).toBeGreaterThanOrEqual(s.min);
      expect(value, `${s.key} の既定値が範囲外`).toBeLessThanOrEqual(s.max);
    }
  });

  it("重力の範囲が検証器の許す範囲を超えない(SPEC D-08)", () => {
    // 画面で作れる値が検証を通らないなら、その画面は壊れた世界を作れてしまう。
    const g = LAB_SLIDERS.find((s) => s.key === "gravity")!;
    expect(g.max).toBeLessThanOrEqual(5);
    expect(g.min).toBeGreaterThanOrEqual(0);
  });

  it("スライダーで作れる値の端どうしでもステージ検証を通る", () => {
    // 端を組み合わせた世界が検証を落ちるなら、利用者はスライダーを
    // 端まで動かしただけでアプリを壊せることになる。
    for (const s of LAB_SLIDERS) {
      for (const v of [s.min, s.max]) {
        const params = s.set(defaultLabParams(), v);
        const stage = buildLabStage(params);
        expect(validateStage(stage).errors, `${s.key}=${v}`).toEqual([]);
      }
    }
  });
});

describe("T-071 プリセットが原仕様 §33 と一致する(F-20)", () => {
  it("7 種そろっている", () => {
    expect(Object.keys(LAB_PRESETS).sort()).toEqual(
      ["bouncy", "earth", "heavy", "ice", "mars", "moon", "zeroG"].sort(),
    );
  });

  it("重力の値が原仕様 §18 / §33 どおり", () => {
    const base = defaultLabParams();
    expect(applyLabPreset(base, "earth").gravityY).toBe(GRAVITY_PRESETS.earth);
    expect(applyLabPreset(base, "moon").gravityY).toBe(GRAVITY_PRESETS.moon);
    expect(applyLabPreset(base, "mars").gravityY).toBe(GRAVITY_PRESETS.mars);
    expect(applyLabPreset(base, "zeroG").gravityY).toBe(GRAVITY_PRESETS.zeroG);
    expect(applyLabPreset(base, "heavy").gravityY).toBe(2);
  });

  it("Ice World は摩擦がほぼ 0、Bouncy World は反発がほぼ 1", () => {
    const base = defaultLabParams();
    expect(applyLabPreset(base, "ice").friction).toBeLessThan(0.01);
    expect(applyLabPreset(base, "bouncy").restitution).toBeGreaterThan(0.9);
  });

  it("プリセットは触れていない項目を書き換えない", () => {
    // 重力だけを変えるつもりが摩擦まで戻る、といったことが起きないこと。
    const base = { ...defaultLabParams(), friction: 0.42 };
    expect(applyLabPreset(base, "moon").friction).toBe(0.42);
  });

  it("知らないプリセット名は既定へ落ちる(例外にしない)", () => {
    const base = defaultLabParams();
    expect(() => applyLabPreset(base, "そんな世界")).not.toThrow();
  });
});

describe("T-072 実時間の状態量が原仕様 §34 の 8 項目を覆う(F-21)", () => {
  const expected = [
    "positionX",
    "positionY",
    "velocityX",
    "velocityY",
    "speed",
    "angularVelocity",
    "collisionCount",
    "elapsedTime",
  ];

  it("項目が過不足なく揃っている", () => {
    const sim = new Simulation({ stage: buildLabStage(defaultLabParams()) });
    expect(labReadouts(sim).map((r) => r.key).sort()).toEqual([...expected].sort());
  });

  it("値が物理の状態から導かれる(画面が独自に計算していない)", () => {
    const sim = new Simulation({ stage: buildLabStage(defaultLabParams()) });
    sim.runTicks(45);

    const r = Object.fromEntries(labReadouts(sim).map((x) => [x.key, x.value]));
    const s = sim.ballState();

    expect(r.positionX).toBe(s.x);
    expect(r.positionY).toBe(s.y);
    expect(r.velocityX).toBe(s.vx);
    expect(r.velocityY).toBe(s.vy);
    expect(r.speed).toBe(s.speed);
    expect(r.angularVelocity).toBe(s.angularVelocity);
    expect(r.collisionCount).toBe(sim.collisionCount);
    expect(r.elapsedTime).toBeCloseTo(sim.tick / 60, 10);
  });

  it("進めば値が動く(表示が固まっていない)", () => {
    const sim = new Simulation({ stage: buildLabStage(defaultLabParams()) });
    const before = labReadouts(sim).find((r) => r.key === "positionY")!.value;
    sim.runTicks(60);
    const after = labReadouts(sim).find((r) => r.key === "positionY")!.value;
    expect(after).not.toBe(before);
  });
});

describe("T-073 速度ベクトルの向きと長さ(F-22)", () => {
  it("速度の向きを指す", () => {
    const arrow = velocityArrow({ x: 100, y: 100, vx: 3, vy: 4, speed: 5, angle: 0, angularVelocity: 0 });

    expect(arrow).not.toBeNull();
    // 始点は物体の位置。
    expect(arrow!.x1).toBe(100);
    expect(arrow!.y1).toBe(100);
    // 向きが速度と一致する(長さは倍率で決まるので、比だけを見る)。
    const dx = arrow!.x2 - arrow!.x1;
    const dy = arrow!.y2 - arrow!.y1;
    expect(dy / dx).toBeCloseTo(4 / 3, 10);
    expect(dx).toBeGreaterThan(0);
  });

  it("速いほど長い", () => {
    const slow = velocityArrow({ x: 0, y: 0, vx: 1, vy: 0, speed: 1, angle: 0, angularVelocity: 0 })!;
    const fast = velocityArrow({ x: 0, y: 0, vx: 4, vy: 0, speed: 4, angle: 0, angularVelocity: 0 })!;

    expect(fast.x2 - fast.x1).toBeGreaterThan(slow.x2 - slow.x1);
  });

  it("止まっていれば矢印を出さない", () => {
    // 長さ 0 の矢印は「向きが無い」のではなく「向きが不定」である。
    // 描くと直前の向きが残って嘘をつく。
    expect(velocityArrow({ x: 0, y: 0, vx: 0, vy: 0, speed: 0, angle: 0, angularVelocity: 0 })).toBeNull();
  });

  it("長さに上限がある(画面からはみ出さない)", () => {
    const huge = velocityArrow({ x: 450, y: 270, vx: 900, vy: 0, speed: 900, angle: 0, angularVelocity: 0 })!;
    expect(Math.hypot(huge.x2 - huge.x1, huge.y2 - huge.y1)).toBeLessThanOrEqual(160);
  });
});

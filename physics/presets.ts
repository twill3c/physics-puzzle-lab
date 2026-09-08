import { GRAVITY_PRESETS, WORLD_DEFAULTS } from "@/lib/constants";
import type { PhysicsObjectDefinition, Placement, WorldParams } from "@/types/physics";

/**
 * 部品の既定寸法と、Lab のプリセット。
 *
 * 原仕様 §33(Lab プリセット)/ §19(Tool Palette)。
 */

/**
 * ツールで置いた部品の既定パラメータ。
 *
 * プレイヤーは位置と角度しか決めない(原仕様 §19 の操作は選択・移動・回転・削除)ので、
 * 寸法や強さはここで決める。**ステージ側で上書きできる**ようにしてあるのは、
 * 面ごとに部品の性格を変えたいことがあるためだが、既定を持たせて
 * 「何も書かなければ同じ部品」を保証する。
 */
export const TOOL_DEFAULTS = {
  board: { width: 180, height: 20 },
  block: { width: 44, height: 44, density: 0.001, friction: 0.3, restitution: 0.4 },
  spring: { length: 90, stiffness: 0.05, damping: 0.02 },
  fan: { power: 0.0016, range: 180 },
} as const;

/**
 * 配置 → 定義への変換。
 *
 * ここが「プレイヤーの操作」と「物理の入力」の境目である。
 * 境をまたぐ変換は一箇所に閉じ込める —— 散らばると、同じ配置が
 * 経路によって別の物体になる(go-particle-lab の HC-190 と同じ型の事故)。
 */
export function placementToDefinition(p: Placement): PhysicsObjectDefinition {
  const q = p.params ?? {};

  switch (p.kind) {
    case "board":
      return {
        id: p.id,
        kind: "board",
        x: p.x,
        y: p.y,
        width: q.width ?? TOOL_DEFAULTS.board.width,
        height: q.height ?? TOOL_DEFAULTS.board.height,
        angle: p.angle,
        isStatic: true,
      };

    case "block":
      return {
        id: p.id,
        kind: "block",
        x: p.x,
        y: p.y,
        width: q.width ?? TOOL_DEFAULTS.block.width,
        height: q.height ?? TOOL_DEFAULTS.block.height,
        angle: p.angle,
        density: q.density ?? TOOL_DEFAULTS.block.density,
        friction: q.friction ?? TOOL_DEFAULTS.block.friction,
        restitution: q.restitution ?? TOOL_DEFAULTS.block.restitution,
      };

    case "spring":
      return {
        id: p.id,
        kind: "spring",
        anchorX: p.x,
        anchorY: p.y,
        objectId: "ball",
        length: q.length ?? TOOL_DEFAULTS.spring.length,
        stiffness: q.stiffness ?? TOOL_DEFAULTS.spring.stiffness,
        damping: q.damping ?? TOOL_DEFAULTS.spring.damping,
      };

    case "fan":
      return {
        id: p.id,
        kind: "fan",
        x: p.x,
        y: p.y,
        direction: p.angle,
        power: q.power ?? TOOL_DEFAULTS.fan.power,
        range: q.range ?? TOOL_DEFAULTS.fan.range,
      };
  }
}

/**
 * Lab のプリセット(原仕様 §33)。
 *
 * 重力の値は**地球を 1.0 とした相対値**であって SI ではない。
 * 教育用の近似であることは原仕様 §18 が明記を求めており、About ページに書く。
 */
export const LAB_PRESETS: Record<string, Partial<WorldParams> & { label: string }> = {
  earth: { label: "Earth", gravityY: GRAVITY_PRESETS.earth },
  moon: { label: "Moon", gravityY: GRAVITY_PRESETS.moon },
  mars: { label: "Mars", gravityY: GRAVITY_PRESETS.mars },
  zeroG: { label: "Zero Gravity", gravityY: GRAVITY_PRESETS.zeroG },
  ice: { label: "Ice World", gravityY: WORLD_DEFAULTS.gravityY, friction: 0.001 },
  bouncy: { label: "Bouncy World", gravityY: WORLD_DEFAULTS.gravityY, restitution: 0.99 },
  heavy: { label: "Heavy World", gravityY: 2 },
};

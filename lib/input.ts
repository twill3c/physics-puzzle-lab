import { KEY_BINDINGS } from "@/types/tools";

/**
 * キーボード操作の割り当て。原仕様 §45。
 *
 * 割り当ては `KEY_BINDINGS`(types/tools.ts)が正本で、ここは
 * 「押されたキー → 動作」の対応だけを持つ。表示用の文字列とは分けてある ——
 * 表示を変えたときに割り当てが黙って変わらないようにするため。
 */

export type KeyAction = "startPause" | "reset" | "delete" | "deselect" | "slowMotion";

export interface KeyContext {
  /** 文字入力中か。入力欄にいるあいだは操作を横取りしない。 */
  inTextField?: boolean;
}

/**
 * 押されたキーに対応する動作を返す。対応が無ければ null。
 *
 * **文字入力中は何も返さない。** ここを外すと、名前を打つだけでゲームが始まる。
 */
export function resolveKeyAction(key: string, ctx: KeyContext = {}): KeyAction | null {
  if (ctx.inTextField) return null;

  // 英字は大文字小文字を区別しない(Shift を押していても同じ動作にする)。
  const k = key.length === 1 ? key.toLowerCase() : key;

  if (k === KEY_BINDINGS.startPause) return "startPause";
  if (k === KEY_BINDINGS.reset) return "reset";
  if (k === KEY_BINDINGS.delete) return "delete";
  if (k === KEY_BINDINGS.deselect) return "deselect";
  if (k === KEY_BINDINGS.slowMotion) return "slowMotion";

  return null;
}

/** 入力欄にいるかどうかを DOM から判定する。 */
export function isTextFieldTarget(target: EventTarget | null): boolean {
  if (!target || !(target as HTMLElement).tagName) return false;
  const el = target as HTMLElement;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
}

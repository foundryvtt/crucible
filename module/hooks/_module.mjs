export {default as accessory} from "./accessory.mjs";
export {default as action} from "./action.mjs";
export {default as talent} from "./talent.mjs";
export {default as spell} from "./spell.mjs";
export {default as spellcraft} from "./spellcraft.mjs";
export {default as affix} from "./affix.mjs";
export const weapon = {};
export const armor = {};

/* -------------------------------------------- */

/**
 * Yield formatted hook context objects for displaying module-defined hooks on a sheet.
 * Callers should annotate each yielded object with application-specific state (e.g. expanded).
 * @param {Record<string, Function>} hooks              The hook object from crucible.api.hooks.*[identifier]
 * @param {Record<string, object>} hookConfig           The hook definitions (SYSTEM.ACTOR.HOOKS or SYSTEM.ACTION_HOOKS)
 * @yields {{hookId: string, label: string, source: string, isModule: true}}
 */
export function* formatHookContext(hooks, hookConfig) {
  for ( const [hookId, fn] of Object.entries(hooks) ) {
    const cfg = hookConfig[hookId];
    if ( !cfg || !(fn instanceof Function) ) continue;
    const prefix = cfg.async ? "async " : "";
    yield {
      hookId,
      isModule: true,
      label: `${prefix}${hookId}(${cfg.argLabels.join(", ")})`,
      source: _dedent(fn.toString())
    };
  }
}

/* -------------------------------------------- */

/**
 * Remove common leading whitespace from a multi-line string.
 * @param {string} text
 * @returns {string}
 */
function _dedent(text) {
  const lines = text.split("\n");
  if ( lines.length <= 1 ) return text;
  const indents = lines.slice(1).filter(l => l.trim()).map(l => l.match(/^(\s*)/)[1].length);
  const min = Math.min(...indents);
  if ( min === 0 ) return text;
  return lines.map((l, i) => (i === 0) ? l : l.slice(min)).join("\n");
}

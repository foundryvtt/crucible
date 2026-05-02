export {default as accessory} from "./accessory.mjs";
export {default as action} from "./action.mjs";
export {default as talent} from "./talent.mjs";
export {default as tool} from "./tool.mjs";
export {default as spell} from "./spell.mjs";
export {default as spellcraft} from "./spellcraft.mjs";
export {default as affix} from "./affix.mjs";
export const weapon = {
  chainHook: {
    preActivateAction(...args) {
      crucible.api.hooks.affix.returning.preActivateAction(...args);
    }
  }
};
export const armor = {};

/* -------------------------------------------- */

/**
 * The template partial used to render a single hook entry on a sheet.
 * @type {string}
 */
export const HOOK_PARTIAL = "systems/crucible/templates/sheets/partials/hook.hbs";

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
      source: _formatBody(fn.toString())
    };
  }
}

/* -------------------------------------------- */

/**
 * Extract the function body from a stringified function and remove common leading whitespace.
 * @param {string} text     The result of Function.prototype.toString()
 * @returns {string}
 */
function _formatBody(text) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if ( (first === -1) || (last === -1) || (first >= last) ) return text;
  let lines = text.slice(first + 1, last).split("\n");
  while ( lines.length && !lines[0].trim() ) lines.shift();
  while ( lines.length && !lines.at(-1).trim() ) lines.pop();
  if ( !lines.length ) return "";
  const indents = lines.filter(l => l.trim()).map(l => l.match(/^(\s*)/)[1].length);
  const min = Math.min(...indents);
  return lines.map(l => l.slice(min)).join("\n").trimEnd();
}

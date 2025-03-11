/**
 * @import {VariablesRecord}  from '../animation-system.mjs'
 */

/**
 * @template T
 * @template {boolean} [Resolved = false]
 * @typedef {(Resolved extends true ? T : T | {type: 'variable', key: string})} VariableValue
 */

/**
 * Walks through a config object and replaces any variable definitions with their values
 * as defined in the `variablesLookup` object.
 *
 * @param {unknown} config config to resolve variables in
 * @param {VariablesRecord} variablesLookup object containing variable values
 * @param {number} [depth=0] recursion depth
 * @returns {any} the resolved config object
 */
export function resolveVariables(config, variablesLookup, depth = 0) {
  if (depth === 100) {
    throw new Error(
      "Maximum recursion depth reached when trying to resolve variables",
    )
  }
  depth++
  if (Array.isArray(config)) {
    return config.map((entry) =>
      resolveVariables(entry, variablesLookup, depth),
    )
  }
  if (config instanceof Object && config.type === "variable") {
    const key = config.key
    if (!key) {
      throw new Error('Must supply a "key" for a variable definition')
    }
    return variablesLookup[key]
  }
  if (config instanceof Object) {
    const obj = {}
    for (const [key, value] of Object.entries(config)) {
      obj[key] = resolveVariables(value, variablesLookup, depth)
    }
    return obj
  }
  return config
}

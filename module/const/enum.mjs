/**
 * An object structure used for an enum with keys, values, and labels.
 * TODO deprecate this
 * @template {any} ValueType
 */
export default class Enum {
  constructor(values) {
    Object.defineProperty(this, "labels", {value: {}});
    for ( const [key, {value, label}] of Object.entries(values) ) {
      Object.defineProperty(this, key, {value: value, writable: false, enumerable: true});
      this.labels[key] = label;
      this.#values[value] = key;
    }
    Object.freeze(this);
    Object.freeze(this.#values);
  }

  /**
   * An internal registry of enum values.
   * @type {Record<string, ValueType>}
   */
  #values = {};

  /**
   * A registry of value labels.
   * @type {Record<string, string>}
   */
  labels;

  /**
   * Provide the label for an enum entry by its key or by its value.
   * @param {string|ValueType} keyOrValue
   * @returns {string}
   */
  label(keyOrValue) {
    const key = keyOrValue in this.labels ? keyOrValue : this.#values[keyOrValue];
    return this.labels[key];
  }

  /**
   * The enum expressed as an object of choices suitable for a <select> input or similar use case.
   * @returns {Record<ValueType, string>}
   */
  get choices() {
    return Object.entries(this.#values).reduce((obj, [k, v]) => {
      obj[k] = this.labels[v];
      return obj;
    }, {});
  }
}

/* -------------------------------------------- */

/**
 * Decorate a record-style enumeration in place with derived metadata that does not depend on localization.
 * Each entry is assigned an `id` matching its key and a `label` defaulted to the key when absent. A
 * non-enumerable `choices` getter is installed on the record, producing an array of {value, label, group} objects
 * suitable for select inputs.
 *
 * The record and its entries are intentionally left mutable so that {@link preLocalizeConfig} can transform
 * `label` (and any other string keys) during the `init` hook. The system performs a final
 * {@link foundry.utils.deepFreeze} pass on `SYSTEM` during the `setup` hook, which is the canonical point at which
 * these enums become immutable.
 *
 * @param {Record<string, object>} record  The record to decorate
 * @returns {Record<string, object>}       The same record, decorated in place
 */
export function defineEnum(record) {
  for ( const [k, v] of Object.entries(record) ) {
    v.id = k;
    v.label ??= k;
  }
  Object.defineProperty(record, "choices", {
    get() {
      return Object.values(this).map(v => ({value: v.id, label: v.label, group: v.group}));
    }
  });
  return record;
}

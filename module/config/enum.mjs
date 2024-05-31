/**
 * An object structure used for an enum with keys, values, and labels.
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

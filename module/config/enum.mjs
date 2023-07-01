/**
 * An object structure used for an enum with keys, values, and labels.
 */
export default class Enum {
  constructor(values) {
    for ( const [key, {value, label}] of Object.entries(values) ) {
      Object.defineProperty(this, key, {value: value, writable: false, enumerable: true});
      this.#labels[key] = label;
      this.#values[value] = key;
    }
    Object.freeze(this);
    Object.freeze(this.#labels);
    Object.freeze(this.#values);
  }

  #values = {};

  #labels = {};

  /**
   * Provide the label for an enum entry by its key or by its value.
   * @param {string|number} keyOrValue
   * @returns {string}
   */
  label(keyOrValue) {
    const key = keyOrValue in this.#labels ? keyOrValue : this.#values[keyOrValue];
    return this.#labels[key];
  }
}

/**
 * An object structure used for an enum with keys, values, and labels.
 */
export default class Enum {
  #metadata;

  constructor(values) {
    this.#metadata = {};
    for ( const [key, {value, ...metadata}] of Object.entries(values) ) {
      Object.defineProperty(this, key, {value: value, writable: false, enumerable: true});
      this.#metadata[value] = metadata;
    }
    Object.freeze(this);
    Object.seal(this.#metadata);
  }

  label(value) {
    return this.#metadata[value]?.label;
  }
}

const {ObjectField} = foundry.data.fields;
const {VFXReferenceField} = foundry.canvas.vfx.fields;

/**
 * A {@link VFXReferenceField} that preserves resolved value identity unchanged. Use when the inner
 * reference target is a Document, PIXI display object, geometry instance, or other class whose
 * prototype/methods must survive the schema clean / validate / initialize pipeline (a plain
 * ObjectField would not preserve class identity).
 *
 * The persisted form is the reference shape `{reference, property?, delta?}`; the resolved form is
 * the raw object returned by the framework's reference resolution, with no further transformation.
 *
 * Mirrors {@link foundry.canvas.vfx.fields.VFXPointSourcePolygonField} as a generic - any object
 * instance is accepted on the non-reference path.
 */
export default class VFXResolvedReferenceField extends VFXReferenceField {
  constructor(options, context) {
    const valueField = new ObjectField({required: false, nullable: true, initial: null});
    super(valueField, {nullable: true, initial: null, ...options}, context);
  }

  /* -------------------------------------------- */

  /** @override */
  _cleanType(value, options, state) {
    if ( this.constructor._isPassthrough(value) ) return value;
    return super._cleanType(value, options, state);
  }

  /* -------------------------------------------- */

  /** @override */
  _validateType(value, options) {
    if ( this.constructor._isPassthrough(value) ) return;
    return super._validateType(value, options);
  }

  /* -------------------------------------------- */

  /** @override */
  initialize(value, model, options) {
    if ( this.constructor._isPassthrough(value) ) return value;
    return super.initialize(value, model, options);
  }

  /* -------------------------------------------- */

  /** @override */
  resolve(value, references) {
    if ( !this.constructor.isReference(value) ) return value;
    let result = references[value.reference];
    if ( value.property ) result = foundry.utils.getProperty(result, value.property);
    return result;
  }

  /* -------------------------------------------- */

  /**
   * A non-null, non-reference object is treated as an already-resolved value and passed through.
   * @param {any} value
   * @returns {boolean}
   * @protected
   */
  static _isPassthrough(value) {
    return (value !== null) && (typeof value === "object") && !this.isReference(value);
  }
}

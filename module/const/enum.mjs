/**
 * Decorate a record-style enumeration in place with derived metadata that does not depend on localization.
 * Each entry is assigned an `id` matching its key and a `label` defaulted to the key when absent.
 * Exposes `choices` to easily iterate values and labels.
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

/* -------------------------------------------- */

/**
 * Define an integer-valued enumeration suitable as the persisted value of a NumberField.
 * Each top-level key is the name of an enum constant; accessing it returns the integer value.
 * @param {Record<string, {value: number, label: string}>} record
 * @returns {Record<string, number>}
 */
export function defineIntEnum(record) {
  const enumeration = {};
  const labels = {};
  for ( const [key, {value, label}] of Object.entries(record) ) {
    Object.defineProperty(enumeration, key, {value, enumerable: true});
    labels[key] = label ?? key;
  }
  Object.defineProperty(enumeration, "labels", {value: labels});
  Object.defineProperty(enumeration, "label", {
    value(keyOrValue) {
      if ( keyOrValue in labels ) return labels[keyOrValue];
      const key = Object.entries(enumeration).find(([_k, v]) => v === keyOrValue)?.[0];
      return key ? labels[key] : undefined;
    }
  });
  Object.defineProperty(enumeration, "choices", {
    get() {
      const result = {};
      for ( const [key, value] of Object.entries(enumeration) ) result[value] = labels[key];
      return result;
    }
  });
  return enumeration;
}

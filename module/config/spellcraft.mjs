
export class CrucibleRune {
  constructor(config={}) {
    const attrs = Object.fromEntries(Object.entries(config).map(([k, v]) => {
      return [k, {value: v, writable: k === "label", enumerable: true}];
    }));
    Object.defineProperties(this, attrs);
  }

  /**
   * The icon used for this rune. Defined by the Talent which provides it.
   * @type {string}
   */
  img;

  /**
   * Tags used to annotate this Gesture.
   * @returns {string[]}
   */
  get tags() {
    const tags = [];

    // Affected Resource
    const resource = CONFIG.SYSTEM.RESOURCES[this.resource]
    tags.push(resource.label);

    // Damage Type
    if ( this.damageType ) {
      const dt = CONFIG.SYSTEM.DAMAGE_TYPES[this.damageType];
      tags.push(`${dt.label} Damage`);
    }

    // Restoration
    if ( this.restoration ) {
      tags.push("Restoration");
    }

    // Opposition
    const op = RUNES[this.opposed];
    tags.push(`Opposed ${op.label}`);
    return tags;
  }
}

/**
 * The Runes which exist in the Crucible spellcraft system.
 * @enum {CrucibleRune}
 */
export const RUNES = Object.freeze({
  courage: new CrucibleRune({
    id: "courage",
    label: "SPELL.RuneCourage",
    resource: "morale",
    restoration: true,
    opposed: "mind"
  }),
  death: new CrucibleRune({
    id: "death",
    label: "SPELL.RuneDeath",
    resource: "health",
    damageType: "unholy",
    opposed: "life"
  }),
  earth: new CrucibleRune({
    id: "earth",
    label: "SPELL.RuneEarth",
    resource: "health",
    damageType: "acid",
    opposed: "lightning"
  }),
  flame: new CrucibleRune({
    id: "flame",
    label: "SPELL.RuneFlame",
    resource: "health",
    damageType: "fire",
    opposed: "frost"
  }),
  frost: new CrucibleRune({
    id: "frost",
    label: "SPELL.RuneFrost",
    resource: "health",
    damageType: "frost",
    opposed: "flame"
  }),
  life: new CrucibleRune({
    id: "life",
    label: "SPELL.RuneLife",
    resource: "health",
    restoration: true,
    opposed: "death"
  }),
  lightning: new CrucibleRune({
    id: "lightning",
    label: "SPELL.RuneLightning",
    resource: "health",
    damageType: "lightning",
    opposed: "earth"
  }),
  mind: new CrucibleRune({
    id: "mind",
    label: "SPELL.RuneMind",
    resource: "morale",
    damageType: "psychic",
    opposed: "courage"
  }),
  radiance: new CrucibleRune({
    id: "radiance",
    label: "SPELL.RuneRadiance",
    resource: "health",
    damageType: "radiant",
    opposed: "void"
  }),
  void: new CrucibleRune({
    id: "void",
    label: "SPELL.RuneVoid",
    resource: "morale",
    damageType: "void",
    opposed: "radiance"
  }),
});


export class CrucibleGesture {
  constructor(config={}) {
    const attrs = Object.fromEntries(Object.entries(config).map(([k, v]) => {
      return [k, {value: v, writable: k === "label", enumerable: true}];
    }));
    Object.defineProperties(this, attrs);
  }

  /**
   * The icon used for this rune. Defined by the Talent which provides it.
   * @type {string}
   */
  img;
}

export const GESTURES = {
  arrow: new CrucibleGesture({
    id: "arrow",
    label: "SPELL.GestureArrow"
  }),
  aspect: new CrucibleGesture({
    id: "aspect",
    label: "SPELL.GestureAspect"
  }),
  create: new CrucibleGesture({
    id: "create",
    label: "SPELL.GestureCreate"
  }),
  fan: new CrucibleGesture({
    id: "fan",
    label: "SPELL.GestureFan"
  }),
  influence: new CrucibleGesture({
    id: "influence",
    label: "SPELL.GestureInfluence"
  }),
  ray: new CrucibleGesture({
    id: "ray",
    label: "SPELL.GestureRay"
  }),
  step: new CrucibleGesture({
    id: "step",
    label: "SPELL.GestureStep"
  }),
  strike: new CrucibleGesture({
    id: "strike",
    label: "SPELL.GestureStrike"
  }),
  touch: new CrucibleGesture({
    id: "touch",
    label: "SPELL.GestureTouch",
    img: "icons/magic/light/hand-sparks-smoke-teal.webp"
  }),
  ward: new CrucibleGesture({
    id: "ward",
    label: "SPELL.GestureWard"
  })
}


export class CrucibleInflection {
  constructor(config={}) {
    const attrs = Object.fromEntries(Object.entries(config).map(([k, v]) => {
      return [k, {value: v, writable: k === "label", enumerable: true}];
    }));
    Object.defineProperties(this, attrs);
  }

  /**
   * The icon used for this rune. Defined by the Talent which provides it.
   * @type {string}
   */
  img;
}

export const INFLECTIONS = {
  extend: new CrucibleInflection({
    id: "extend",
    label: "Extend"
  }),
  negate: new CrucibleInflection({
    id: "negate",
    label: "Negate"
  }),
  pull: new CrucibleInflection({
    id: "pull",
    label: "Pull"
  }),
  push: new CrucibleInflection({
    id: "push",
    label: "Push"
  }),
}

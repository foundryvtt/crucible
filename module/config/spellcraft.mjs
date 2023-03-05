export const NAME_FORMATS = Object.freeze({
  NOUN: 1,
  ADJ: 2
});

/**
 * The Arcane Runes which exist in the Crucible spellcraft system.
 * These config objects are instantiated as CrucibleRune instances during system initialization.
 * @enum {CrucibleRune}
 */
export const RUNES = Object.seal({
  courage: {
    id: "courage",
    name: "SPELL.RuneCourage",
    img: "icons/magic/control/fear-fright-white.webp",
    resource: "morale",
    restoration: true,
    opposed: "mind",
    defense: "willpower",
    scaling: "presence",
    nameFormat: NAME_FORMATS.NOUN
  },
  death: {
    id: "death",
    name: "SPELL.RuneDeath",
    img: "icons/magic/unholy/hand-claw-fire-blue.webp",
    resource: "health",
    damageType: "unholy",
    opposed: "life",
    defense: "fortitude",
    scaling: "wisdom",
    nameFormat: NAME_FORMATS.NOUN
  },
  earth: {
    id: "earth",
    name: "SPELL.RuneEarth",
    img: "icons/magic/earth/projectile-boulder-debris.webp",
    resource: "health",
    damageType: "acid",
    opposed: "lightning",
    defense: "reflex",
    scaling: "intellect",
    nameFormat: NAME_FORMATS.ADJ
  },
  flame: {
    id: "flame",
    name: "SPELL.RuneFlame",
    img: "icons/magic/fire/barrier-wall-flame-ring-yellow.webp",
    resource: "health",
    damageType: "fire",
    opposed: "frost",
    defense: "reflex",
    scaling: "intellect",
    nameFormat: NAME_FORMATS.NOUN
  },
  frost: {
    id: "frost",
    name: "SPELL.RuneFrost",
    img: "icons/magic/water/snowflake-ice-snow-white.webp",
    resource: "health",
    damageType: "frost",
    opposed: "flame",
    defense: "fortitude",
    scaling: "intellect",
    nameFormat: NAME_FORMATS.NOUN
  },
  kinesis: {
    id: "kinesis",
    name: "SPELL.RuneKinesis",
    img: "icons/magic/movement/pinwheel-turning-blue.webp",
    resource: "health",
    damageType: "slashing",
    opposed: "time",
    defense: "physical",
    scaling: "presence",
    nameFormat: NAME_FORMATS.ADJ
  },
  life: {
    id: "life",
    name: "SPELL.RuneLife",
    img: "icons/magic/life/heart-shadow-red.webp",
    resource: "health",
    restoration: true,
    opposed: "death",
    defense: "fortitude",
    scaling: "wisdom",
    nameFormat: NAME_FORMATS.NOUN
  },
  lightning: {
    id: "lightning",
    name: "SPELL.RuneLightning",
    img: "icons/magic/lightning/bolt-strike-blue.webp",
    resource: "health",
    damageType: "lightning",
    opposed: "earth",
    defense: "reflex",
    scaling: "intellect",
    nameFormat: NAME_FORMATS.ADJ
  },
  mind: {
    id: "mind",
    name: "SPELL.RuneMind",
    img: "icons/magic/control/hypnosis-mesmerism-eye.webp",
    resource: "morale",
    damageType: "psychic",
    opposed: "courage",
    defense: "willpower",
    scaling: "presence",
    nameFormat: NAME_FORMATS.NOUN
  },
  radiance: {
    id: "radiance",
    name: "SPELL.RuneRadiance",
    img: "icons/magic/light/projectile-beam-yellow.webp",
    resource: "health",
    damageType: "radiant",
    opposed: "void",
    defense: "willpower",
    scaling: "wisdom",
    nameFormat: NAME_FORMATS.NOUN
  },
  time: {
    id: "time",
    name: "SPELL.RuneTime",
    img: "icons/magic/time/clock-spinning-gold-pink.webp",
    resource: "morale",
    opposed: "kinesis",
    defense: "willpower",
    scaling: "presence",
    nameFormat: NAME_FORMATS.ADJ
  },
  void: {
    id: "void",
    name: "SPELL.RuneVoid",
    img: "icons/magic/unholy/orb-rays-blue.webp",
    resource: "morale",
    damageType: "void",
    opposed: "radiance",
    defense: "fortitude",
    scaling: "wisdom",
    nameFormat: NAME_FORMATS.ADJ
  },
});

/**
 * The Somatic Gestures which exist in the Crucible spellcraft system.
 * These config objects are instantiated as CrucibleGesture instances during system initialization.
 * @enum {CrucibleGesture}
 */
export const GESTURES = Object.seal({
  arrow: {
    id: "arrow",
    name: "SPELL.GestureArrow",
    cost: {
      action: 2,
      focus: 1
    },
    damage: {
      base: 10
    },
    hands: 1,
    scaling: "intellect",
    target: {
      type: "single",
      number: 1,
      distance: 10
    },
    tier: 1
  },
  aspect: {
    id: "aspect",
    name: "SPELL.GestureAspect",
    cost: {
      action: 2,
      focus: 1
    },
    hands: 1,
    nameFormat: NAME_FORMATS.NOUN,
    scaling: "wisdom",
    target: {
      type: "self"
    },
    tier: 1
  },
  create: {
    id: "create",
    name: "SPELL.GestureCreate",
    cost: {
      action: 2,
      focus: 1
    },
    hands: 2,
    nameFormat: NAME_FORMATS.ADJ,
    scaling: "wisdom",
    target: {
      type: "self"
    },
    tier: 1
  },
  fan: {
    id: "fan",
    name: "SPELL.GestureFan",
    cost: {
      action: 2,
      focus: 1
    },
    damage: {
      base: 4
    },
    hands: 1,
    scaling: "intellect",
    target: {
      type: "fan",
      number: 1,
      distance: 1
    },
    tier: 1
  },
  influence: {
    id: "influence",
    name: "SPELL.GestureInfluence",
    cost: {
      action: 2,
      focus: 1
    },
    damage: {
      base: 12
    },
    hands: 1,
    nameFormat: NAME_FORMATS.ADJ,
    scaling: "wisdom",
    target: {
      type: "single",
      number: 1,
      distance: 1
    },
    tier: 1
  },
  ray: {
    id: "ray",
    name: "SPELL.GestureRay",
    cost: {
      action: 2,
      focus: 1
    },
    damage: {
      base: 4
    },
    hands: 1,
    scaling: "intellect",
    target: {
      type: "ray",
      number: 1,
      distance: 6
    },
    tier: 1
  },
  step: {
    id: "step",
    name: "SPELL.GestureStep",
    cost: {
      action: 1,
      focus: 1
    },
    hands: 0,
    nameFormat: NAME_FORMATS.ADJ,
    scaling: "dexterity",
    target: {
      type: "self",
      distance: 4
    },
    tier: 1
  },
  strike: {
    id: "strike",
    name: "SPELL.GestureStrike",
    hands: 0,
    nameFormat: NAME_FORMATS.ADJ,
    scaling: "strength",
    cost: {
      action: 2,
      focus: 1
    },
    damage: {
      base: 12
    },
    target: {
      type: "single",
      number: 1,
      distance: 1
    },
    tier: 1
  },
  touch: {
    id: "touch",
    name: "SPELL.GestureTouch",
    img: "icons/magic/light/hand-sparks-smoke-teal.webp",
    description: "<p>Touch is one of the most universal somatic gestures. This gesture is easily performed and is typically the first gesture learned by novice spellcasters.</p><p>Touch-based spells cause a small amount of damage or healing, but can be performed quickly requiring less Action than more complex gestures.</p>",
    cost: {
      action: 1,
      focus: 1
    },
    damage: {
      base: 4
    },
    hands: 1,
    scaling: "dexterity",
    target: {
      type: "single",
      number: 1,
      distance: 1
    },
    tier: 1
  },
  ward: {
    id: "ward",
    name: "SPELL.GestureWard",
    cost: {
      action: 1,
      focus: 1
    },
    damage: {
      base: 6
    },
    hands: 1,
    scaling: "toughness",
    target: {
      type: "self"
    },
    tier: 1
  }
});

/**
 * The Metamagic Inflections which exist in the Crucible spellcraft system.
 * These config objects are instantiated as CrucibleInflection instances during system initialization.
 * @enum {CrucibleInflection}
 */
export const INFLECTIONS = Object.seal({
  compose: {
    id: "compose",
    name: "SPELL.MetamagicCompose",
    cost: {
      action: 1,
      focus: -1
    },
    tier: 1
  },
  quicken: {
    id: "quicken",
    name: "SPELL.MetamagicQuicken",
    cost: {
      action: -1,
      focus: 1
    },
    tier: 1
  },
  extend: {
    id: "extend",
    name: "SPELL.MetamagicExtend",
    cost: {
      action: 1,
      focus: 1
    },
    tier: 1
  },
  negate: {
    id: "negate",
    name: "SPELL.MetamagicNegate",
    cost: {
      focus: 1
    },
    tier: 1
  },
  pull: {
    id: "pull",
    name: "SPELL.MetamagicPull",
    cost: {
      focus: 1
    },
    tier: 1
  },
  push: {
    id: "push",
    name: "SPELL.MetamagicPush",
    cost: {
      focus: 1
    },
    tier: 1
  }
});

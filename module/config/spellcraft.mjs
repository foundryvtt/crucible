/**
 * The Arcane Runes which exist in the Crucible spellcraft system.
 * These config objects are instantiated as CrucibleRune instances during system initialization.
 * @enum {CrucibleRune}
 */
export const RUNES = Object.seal({
  courage: {
    id: "courage",
    name: "SPELL.RuneCourage",
    resource: "morale",
    restoration: true,
    opposed: "mind",
    save: "willpower",
    scaling: "presence"
  },
  death: {
    id: "death",
    name: "SPELL.RuneDeath",
    resource: "health",
    damageType: "unholy",
    opposed: "life",
    save: "fortitude",
    scaling: "wisdom"
  },
  earth: {
    id: "earth",
    name: "SPELL.RuneEarth",
    resource: "health",
    damageType: "acid",
    opposed: "lightning",
    save: "reflex",
    scaling: "intellect"
  },
  flame: {
    id: "flame",
    name: "SPELL.RuneFlame",
    resource: "health",
    damageType: "fire",
    opposed: "frost",
    save: "reflex",
    scaling: "intellect"
  },
  frost: {
    id: "frost",
    name: "SPELL.RuneFrost",
    resource: "health",
    damageType: "frost",
    opposed: "flame",
    save: "fortitude",
    scaling: "intellect"
  },
  kinesis: {
    id: "kinesis",
    name: "SPELL.RuneKinesis",
    resource: "health",
    opposed: "time",
    save: "reflex",
    scaling: "presence"
  },
  life: {
    id: "life",
    name: "SPELL.RuneLife",
    resource: "health",
    restoration: true,
    opposed: "death",
    save: "fortitude",
    scaling: "wisdom"
  },
  lightning: {
    id: "lightning",
    name: "SPELL.RuneLightning",
    resource: "health",
    damageType: "lightning",
    opposed: "earth",
    save: "reflex",
    scaling: "intellect"
  },
  mind: {
    id: "mind",
    name: "SPELL.RuneMind",
    resource: "morale",
    damageType: "psychic",
    opposed: "courage",
    save: "willpower",
    scaling: "presence"
  },
  radiance: {
    id: "radiance",
    name: "SPELL.RuneRadiance",
    resource: "health",
    damageType: "radiant",
    opposed: "void",
    save: "willpower",
    scaling: "wisdom"
  },
  time: {
    id: "time",
    name: "SPELL.RuneTime",
    resource: "morale",
    opposed: "kinesis",
    save: "willpower",
    scaling: "presence"
  },
  void: {
    id: "void",
    name: "SPELL.RuneVoid",
    resource: "morale",
    damageType: "void",
    opposed: "radiance",
    save: "willpower",
    scaling: "wisdom"
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
      action: 1,
      focus: 0
    },
    damage: {
      base: 6
    },
    hands: 1,
    scaling: "intellect",
    tier: 1
  },
  aspect: {
    id: "aspect",
    name: "SPELL.GestureAspect",
    cost: {
      action: 2,
      focus: 1
    },
    damage: {
      base: 2
    },
    hands: 1,
    scaling: "wisdom",
    tier: 1
  },
  create: {
    id: "create",
    name: "SPELL.GestureCreate",
    cost: {
      action: 2,
      focus: 1
    },
    damage: {
      base: 2
    },
    hands: 2,
    scaling: "wisdom",
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
      base: 8
    },
    hands: 1,
    scaling: "wisdom",
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
    tier: 1
  },
  step: {
    id: "step",
    name: "SPELL.GestureStep",
    cost: {
      action: 1,
      focus: 1
    },
    damage: {
      base: 2
    },
    hands: 0,
    scaling: "dexterity",
    tier: 1
  },
  strike: {
    id: "strike",
    name: "SPELL.GestureStrike",
    cost: {
      action: 1,
      focus: 0
    },
    damage: {
      base: 6
    },
    hands: 0,
    scaling: "strength",
    tier: 1
  },
  touch: {
    id: "touch",
    name: "SPELL.GestureTouch",
    img: "icons/magic/light/hand-sparks-smoke-teal.webp",
    cost: {
      action: 1,
      focus: 0
    },
    damage: {
      base: 4
    },
    hands: 1,
    scaling: "dexterity",
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
    tier: 1
  }
});

/**
 * The Metamagic Inflections which exist in the Crucible spellcraft system.
 * These config objects are instantiated as CrucibleInflection instances during system initialization.
 * @enum {CrucibleInflection}
 */
export const INFLECTIONS = Object.seal({
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

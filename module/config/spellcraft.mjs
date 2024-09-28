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
  death: {
    id: "death",
    name: "SPELL.RUNES.Death",
    img: "icons/magic/unholy/hand-claw-fire-blue.webp",
    resource: "health",
    damageType: "corruption",
    opposed: "life",
    defense: "fortitude",
    scaling: "intellect",
    nameFormat: NAME_FORMATS.NOUN
  },
  earth: {
    id: "earth",
    name: "SPELL.RUNES.Earth",
    img: "icons/magic/earth/projectile-boulder-debris.webp",
    resource: "health",
    damageType: "acid",
    opposed: "lightning",
    defense: "reflex",
    scaling: "wisdom",
    nameFormat: NAME_FORMATS.ADJ
  },
  flame: {
    id: "flame",
    name: "SPELL.RUNES.Flame",
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
    name: "SPELL.RUNES.Frost",
    img: "icons/magic/water/snowflake-ice-snow-white.webp",
    resource: "health",
    damageType: "cold",
    opposed: "flame",
    defense: "fortitude",
    scaling: "wisdom",
    nameFormat: NAME_FORMATS.NOUN
  },
  illumination: {
    id: "illumination",
    name: "SPELL.RUNES.Illumination",
    img: "icons/magic/light/projectile-beam-yellow.webp",
    resource: "health",
    damageType: "radiant",
    opposed: "shadow",
    defense: "willpower",
    scaling: "presence",
    nameFormat: NAME_FORMATS.ADJ
  },
  kinesis: {
    id: "kinesis",
    name: "SPELL.RUNES.Kinesis",
    img: "icons/magic/movement/pinwheel-turning-blue.webp",
    resource: "health",
    damageType: "physical",
    opposed: "stasis",
    defense: "physical",
    scaling: "presence",
    nameFormat: NAME_FORMATS.ADJ
  },
  life: {
    id: "life",
    name: "SPELL.RUNES.Life",
    img: "icons/magic/life/heart-shadow-red.webp",
    resource: "health",
    restoration: true,
    damageType: "poison",
    opposed: "death",
    defense: "fortitude",
    scaling: "wisdom",
    nameFormat: NAME_FORMATS.NOUN
  },
  lightning: {
    id: "lightning",
    name: "SPELL.RUNES.Lightning",
    img: "icons/magic/lightning/bolt-strike-blue.webp",
    resource: "health",
    damageType: "electricity",
    opposed: "earth",
    defense: "reflex",
    scaling: "intellect",
    nameFormat: NAME_FORMATS.ADJ
  },
  control: {
    id: "control",
    name: "SPELL.RUNES.Control",
    img: "icons/magic/control/hypnosis-mesmerism-eye.webp",
    resource: "morale",
    damageType: "psychic",
    opposed: "spirit",
    defense: "willpower",
    scaling: "intellect",
    nameFormat: NAME_FORMATS.NOUN
  },
  shadow: {
    id: "shadow",
    name: "SPELL.RUNES.Shadow",
    img: "icons/magic/unholy/orb-rays-blue.webp",
    resource: "morale",
    damageType: "void",
    opposed: "illumination",
    defense: "fortitude",
    scaling: "presence",
    nameFormat: NAME_FORMATS.ADJ
  },
  spirit: {
    id: "spirit",
    name: "SPELL.RUNES.Spirit",
    img: "icons/magic/control/fear-fright-white.webp",
    resource: "morale",
    restoration: true,
    damageType: "psychic",
    opposed: "control",
    defense: "willpower",
    scaling: "presence",
    nameFormat: NAME_FORMATS.NOUN
  },
  stasis: {
    id: "stasis",
    name: "SPELL.RUNES.Stasis",
    img: "icons/magic/time/clock-spinning-gold-pink.webp",
    resource: "morale",
    damageType: "physical",
    opposed: "kinesis",
    defense: "willpower",
    scaling: "wisdom",
    nameFormat: NAME_FORMATS.ADJ
  }
});

/**
 * The Somatic Gestures which exist in the Crucible spellcraft system.
 * These config objects are instantiated as CrucibleGesture instances during system initialization.
 * @enum {CrucibleGesture}
 */
export const GESTURES = Object.seal({
  arrow: {
    id: "arrow",
    name: "SPELL.GESTURES.Arrow",
    cost: {
      action: 3,
      focus: 1
    },
    damage: {
      base: 8
    },
    hands: 1,
    range: {
      minimum: 1,
      maximum: 60
    },
    scaling: "intellect",
    target: {
      type: "single",
      number: 1
    }
  },
  aspect: {
    id: "aspect",
    name: "SPELL.GESTURES.Aspect",
    cost: {
      action: 2,
      focus: 1
    },
    hands: 1,
    nameFormat: NAME_FORMATS.NOUN,
    scaling: "wisdom",
    target: {
      type: "self"
    }
  },
  create: {
    id: "create",
    name: "SPELL.GESTURES.Create",
    cost: {
      action: 4,
      focus: 1
    },
    hands: 2,
    range: {
      maximum: 10
    },
    nameFormat: NAME_FORMATS.ADJ,
    scaling: "wisdom",
    target: {
      type: "summon"
    }
  },
  fan: {
    id: "fan",
    name: "SPELL.GESTURES.Fan",
    cost: {
      action: 3,
      focus: 1
    },
    damage: {
      base: 6
    },
    hands: 1,
    range: {
      maximum: 6
    },
    scaling: "intellect",
    target: {
      type: "fan"
    }
  },
  influence: {
    id: "influence",
    name: "SPELL.GESTURES.Influence",
    cost: {
      action: 3,
      focus: 1
    },
    damage: {
      base: 10
    },
    hands: 1,
    range: {
      maximum: 1
    },
    nameFormat: NAME_FORMATS.ADJ,
    scaling: "presence",
    target: {
      type: "single"
    }
  },
  pulse: {
    id: "pulse",
    name: "SPELL.GESTURES.Pulse",
    cost: {
      action: 4,
      focus: 1
    },
    damage: {
      base: 6
    },
    hands: 2,
    range: {
      maximum: 0
    },
    scaling: "presence",
    target: {
      type: "pulse",
      size: 6
    }
  },
  ray: {
    id: "ray",
    name: "SPELL.GESTURES.Ray",
    cost: {
      action: 4,
      focus: 1
    },
    damage: {
      base: 6
    },
    hands: 1,
    range: {
      maximum: 30
    },
    scaling: "wisdom",
    target: {
      type: "ray",
      size: 1
    }
  },
  step: {
    id: "step",
    name: "SPELL.GESTURES.Step",
    cost: {
      action: 1,
      focus: 1
    },
    damage: {
      base: 2
    },
    hands: 0,
    range: {
      maximum: 0
    },
    nameFormat: NAME_FORMATS.ADJ,
    scaling: "dexterity",
    target: {
      type: "ray",
      distance: 20
    }
  },
  strike: {
    id: "strike",
    name: "SPELL.GESTURES.Strike",
    cost: {
      action: 0,
      focus: 1,
      weapon: true
    },
    damage: {
      base: 12
    },
    hands: 0,
    range: {
      weapon: true
    },
    nameFormat: NAME_FORMATS.ADJ,
    scaling: "strength",
    target: {
      type: "single"
    }
  },
  touch: {
    id: "touch",
    name: "SPELL.GESTURES.Touch",
    img: "icons/magic/light/hand-sparks-smoke-teal.webp",
    description: "<p>Touch is one of the most universal somatic gestures. This gesture is easily performed and is typically the first gesture learned by novice spellcasters.</p><p>Touch-based spells cause a small amount of damage or healing, but can be performed quickly requiring less Action than more complex gestures.</p>",
    cost: {
      action: 2,
      focus: 1
    },
    damage: {
      base: 6
    },
    hands: 1,
    range: {
      maximum: 1
    },
    scaling: "dexterity",
    target: {
      type: "single"
    }
  },
  ward: {
    id: "ward",
    name: "SPELL.GESTURES.Ward",
    cost: {
      action: 2,
      focus: 1
    },
    damage: {
      base: 6
    },
    hands: 1,
    scaling: "toughness",
    target: {
      type: "self"
    }
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
    name: "SPELL.INFLECTIONS.Compose",
    cost: {
      action: 1,
      focus: -1
    }
  },
  determine: {
    id: "determine",
    name: "SPELL.INFLECTIONS.Determine",
    cost: {
      focus: 1
    }
  },
  quicken: {
    id: "quicken",
    name: "SPELL.INFLECTIONS.Quicken",
    cost: {
      action: -1,
      focus: 1
    }
  },
  extend: {
    id: "extend",
    name: "SPELL.INFLECTIONS.Extend",
    cost: {
      action: 1,
      focus: 1
    }
  },
  eluding: {
    id: "eluding",
    name: "SPELL.INFLECTIONS.Elude",
    cost: {
      focus: 1
    }
  },
  negate: {
    id: "negate",
    name: "SPELL.INFLECTIONS.Negate",
    cost: {
      focus: 1
    }
  },
  pull: {
    id: "pull",
    name: "SPELL.INFLECTIONS.Pull",
    cost: {
      focus: 1
    }
  },
  push: {
    id: "push",
    name: "SPELL.INFLECTIONS.Push",
    cost: {
      focus: 1
    }
  },
  reshape: {
    id: "reshape",
    name: "SPELL.INFLECTIONS.Reshape",
    cost: {
      focus: 2
    },
    hooks: {
      prepare() {
        if ( this.damage.restoration ) this.target.scope = SYSTEM.ACTION.TARGET_SCOPES.ALLIES;
        else this.target.scope = SYSTEM.ACTION.TARGET_SCOPES.ENEMIES;
      }
    }
  }
});


export const CREATION_SUMMONS =  {
  death: "Compendium.crucible.summons.Actor.56puGK932Qc0cowe",
  earth: "Compendium.crucible.summons.Actor.xTFgTg5Rh2s0s5gZ",
  flame: "Compendium.crucible.summons.Actor.RuNh1bFGiHKdHeKI",
  frost: "Compendium.crucible.summons.Actor.me5glbOshiijlVUH",
  lightning: "Compendium.crucible.summons.Actor.Ne25xsSqYijgcrm0",
  fallback: "Compendium.crucible.summons.Actor.RuNh1bFGiHKdHeKI" // FIXME temporary
}

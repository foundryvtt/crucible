export const NAME_FORMATS = Object.freeze({
  NOUN: 1,
  ADJ: 2
});

/**
 * The Arcane Runes which exist in the Crucible spellcraft system.
 * These config objects are instantiated as CrucibleSpellcraftRune instances during system initialization.
 * @enum {object}
 */
export const RUNES = {
  control: {
    id: "control",
    name: "SPELL.RUNES.Control",
    img: "icons/magic/control/hypnosis-mesmerism-eye.webp",
    resource: "morale",
    damageType: "psychic",
    opposed: "kinesis",
    defense: "willpower",
    scaling: "intellect",
    nameFormat: NAME_FORMATS.NOUN,
    talentUuid: "Compendium.crucible.talent.Item.runeControl00000"
  },
  death: {
    id: "death",
    name: "SPELL.RUNES.Death",
    img: "icons/magic/unholy/hand-claw-fire-blue.webp",
    resource: "health",
    damageType: "corruption",
    opposed: "life",
    defense: "fortitude",
    scaling: "intellect",
    nameFormat: NAME_FORMATS.NOUN,
    talentUuid: "Compendium.crucible.talent.Item.runeDeath0000000"
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
    nameFormat: NAME_FORMATS.ADJ,
    talentUuid: "Compendium.crucible.talent.Item.runeEarth0000000"
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
    nameFormat: NAME_FORMATS.NOUN,
    talentUuid: "Compendium.crucible.talent.Item.runeFlame0000000"
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
    nameFormat: NAME_FORMATS.NOUN,
    talentUuid: "Compendium.crucible.talent.Item.runeFrost0000000"
  },
  illumination: {
    id: "illumination",
    name: "SPELL.RUNES.Illumination",
    img: "icons/magic/light/projectile-beam-yellow.webp",
    resource: "health",
    damageType: "radiant",
    opposed: "illusion",
    defense: "reflex",
    scaling: "presence",
    nameFormat: NAME_FORMATS.ADJ,
    talentUuid: "Compendium.crucible.talent.Item.runeIllumination"
  },
  illusion: {
    id: "illusion",
    name: "SPELL.RUNES.Illusion",
    img: "icons/magic/light/projectile-smoke-blue-white.webp",
    resource: "morale",
    damageType: "psychic",
    opposed: "illumination",
    defense: "willpower",
    scaling: "intellect",
    nameFormat: NAME_FORMATS.ADJ,
    talentUuid: "Compendium.crucible.talent.Item.runeIllusion0000"
  },
  kinesis: {
    id: "kinesis",
    name: "SPELL.RUNES.Kinesis",
    img: "icons/magic/movement/pinwheel-turning-blue.webp",
    resource: "health",
    damageType: "physical",
    opposed: "control",
    defense: "physical",
    scaling: "presence",
    nameFormat: NAME_FORMATS.ADJ,
    talentUuid: "Compendium.crucible.talent.Item.runeKinesis00000"
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
    nameFormat: NAME_FORMATS.NOUN,
    talentUuid: "Compendium.crucible.talent.Item.runeLife00000000"
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
    nameFormat: NAME_FORMATS.ADJ,
    talentUuid: "Compendium.crucible.talent.Item.runeLightning000"
  },
  oblivion: {
    id: "oblivion",
    name: "SPELL.RUNES.Oblivion",
    img: "icons/magic/unholy/barrier-shield-glowing-pink.webp",
    resource: "morale",
    damageType: "void",
    opposed: "soul",
    defense: "willpower",
    scaling: "intellect",
    nameFormat: NAME_FORMATS.NOUN,
    talentUuid: "Compendium.crucible.talent.Item.runeOblivion0000"
  },
  soul: {
    id: "soul",
    name: "SPELL.RUNES.Soul",
    img: "icons/magic/light/projectile-halo-teal.webp",
    resource: "morale",
    restoration: true,
    damageType: "psychic",
    opposed: "oblivion",
    defense: "willpower",
    scaling: "presence",
    nameFormat: NAME_FORMATS.NOUN,
    talentUuid: "Compendium.crucible.talent.Item.runeSoul00000000"
  },
};

/**
 * The Somatic Gestures which exist in the Crucible spellcraft system.
 * These config objects are instantiated as CrucibleSpellcraftGesture instances during system initialization.
 * @enum {object}
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
    },
    talentUuid: "Compendium.crucible.talent.Item.gesturearrow0000"
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
    scaling: "presence",
    target: {
      type: "self"
    },
    talentUuid: "Compendium.crucible.talent.Item.gestureaspect000"
  },
  aura: {
    id: "aura",
    name: "SPELL.GESTURES.Aura",
    cost: {
      action: 5,
      focus: 1 // Maintained
    },
    hands: 2,
    nameFormat: NAME_FORMATS.NOUN,
    scaling: "presence",
    target: {
      type: "pulse", // TODO need an aura type
      size: 20
    },
    talentUuid: "Compendium.crucible.talent.Item.gestureAura00000"
  },
  blast: {
    id: "blast",
    name: "SPELL.GESTURES.Blast",
    cost: {
      action: 5,
      focus: 2
    },
    damage: {
      base: 8
    },
    hands: 2,
    nameFormat: NAME_FORMATS.ADJ,
    range: {
      maximum: 60
    },
    scaling: "intellect",
    target: {
      type: "blast",
      size: 6
    },
    talentUuid: "Compendium.crucible.talent.Item.gestureBlast0000"
  },
  cone: {
    id: "cone",
    name: "SPELL.GESTURES.Cone",
    cost: {
      action: 5,
      focus: 2
    },
    damage: {
      base: 8
    },
    hands: 2,
    nameFormat: NAME_FORMATS.NOUN,
    range: {
      maximum: 30
    },
    scaling: "intellect",
    target: {
      type: "cone"
    },
    talentUuid: "Compendium.crucible.talent.Item.gestureCone00000"
  },
  conjure: {
    id: "conjure",
    name: "SPELL.GESTURES.Conjure",
    cost: {
      action: 5,
      focus: 2
    },
    hands: 2,
    range: {
      maximum: 30
    },
    nameFormat: NAME_FORMATS.NOUN,
    scaling: "wisdom",
    target: {
      type: "summon"
    },
    talentUuid: "Compendium.crucible.talent.Item.gestureConjure00"
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
    },
    talentUuid: "Compendium.crucible.talent.Item.gesturecreate000"
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
    },
    talentUuid: "Compendium.crucible.talent.Item.gesturefan000000"
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
    },
    talentUuid: "Compendium.crucible.talent.Item.gestureinfluence"
  },
  pulse: {
    id: "pulse",
    name: "SPELL.GESTURES.Pulse",
    cost: {
      action: 4,
      focus: 1
    },
    damage: {
      base: 8
    },
    hands: 2,
    range: {
      maximum: 0
    },
    scaling: "presence",
    target: {
      type: "pulse",
      size: 10
    },
    talentUuid: "Compendium.crucible.talent.Item.gesturepulse0000"
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
    },
    talentUuid: "Compendium.crucible.talent.Item.gestureray000000"
  },
  sense: {
    id: "sense",
    name: "SPELL.GESTURES.Sense",
    cost: {
      action: 3,
      focus: 1 // Maintained
    },
    hands: 1,
    nameFormat: NAME_FORMATS.ADJ,
    scaling: "presence",
    target: {
      type: "pulse", // TODO aura type
      size: 30
    },
    talentUuid: "Compendium.crucible.talent.Item.gestureSense0000"
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
    },
    talentUuid: "Compendium.crucible.talent.Item.gesturestep00000"
  },
  strike: {
    id: "strike",
    name: "SPELL.GESTURES.Strike",
    cost: {
      action: 0,
      focus: 1,
      weapon: true
    },
    damage: {},
    hands: 0,
    range: {
      weapon: true
    },
    nameFormat: NAME_FORMATS.ADJ,
    scaling: "strength",
    target: {
      type: "single"
    },
    talentUuid: "Compendium.crucible.talent.Item.gesturestrike000"
  },
  surge: {
    id: "surge",
    name: "SPELL.GESTURES.Surge",
    cost: {
      action: 5,
      focus: 2
    },
    damage: {
      base: 8
    },
    hands: 2,
    range: {
      maximum: 15
    },
    nameFormat: NAME_FORMATS.ADJ,
    scaling: "wisdom",
    target: {
      type: "ray",
      size: 10
    },
    talentUuid: "Compendium.crucible.talent.Item.gestureSurge0000"
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
    },
    talentUuid: null
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
    },
    talentUuid: "Compendium.crucible.talent.Item.gestureward00000"
  }
});

/**
 * The Metamagic Inflections which exist in the Crucible spellcraft system.
 * These config objects are instantiated as CrucibleSpellcraftInflection instances during system initialization.
 * Until that occurs, this object can be mutated by downstream modules to register additional inflection types.
 * After initialization, this record becomes frozen and can no longer be extended.
 * @type {Record<string, object>}
 */
export const INFLECTIONS = {
  compose: {
    id: "compose",
    name: "SPELL.INFLECTIONS.Compose",
    cost: {
      action: 1,
      focus: -1
    },
    talentUuid: "Compendium.crucible.talent.Item.inflectioncompos"
  },
  determine: {
    id: "determine",
    name: "SPELL.INFLECTIONS.Determine",
    cost: {
      focus: 1
    },
    talentUuid: "Compendium.crucible.talent.Item.inflectiondeterm"
  },
  eluding: {
    id: "eluding",
    name: "SPELL.INFLECTIONS.Elude",
    cost: {
      focus: 1
    },
    talentUuid: "Compendium.crucible.talent.Item.inflectionelude0"
  },
  extend: {
    id: "extend",
    name: "SPELL.INFLECTIONS.Extend",
    cost: {
      action: 1,
      focus: 1
    },
    talentUuid: "Compendium.crucible.talent.Item.inflectionextend"
  },
  negate: {
    id: "negate",
    name: "SPELL.INFLECTIONS.Negate",
    cost: {
      focus: 1
    },
    talentUuid: "Compendium.crucible.talent.Item.inflectionnegate"
  },
  pull: {
    id: "pull",
    name: "SPELL.INFLECTIONS.Pull",
    cost: {
      focus: 1
    },
    talentUuid: "Compendium.crucible.talent.Item.inflectionpull00"
  },
  push: {
    id: "push",
    name: "SPELL.INFLECTIONS.Push",
    cost: {
      focus: 1
    },
    talentUuid: "Compendium.crucible.talent.Item.inflectionpush00"
  },
  quicken: {
    id: "quicken",
    name: "SPELL.INFLECTIONS.Quicken",
    cost: {
      action: -1,
      focus: 1
    },
    talentUuid: "Compendium.crucible.talent.Item.inflectionquicke"
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
    },
    talentUuid: "Compendium.crucible.talent.Item.inflectionReshap"
  }
};

export const GESTURE_SUMMONS =  {
  create: {
    death: "Compendium.crucible.summons.Actor.56puGK932Qc0cowe",
    earth: "Compendium.crucible.summons.Actor.xTFgTg5Rh2s0s5gZ",
    flame: "Compendium.crucible.summons.Actor.RuNh1bFGiHKdHeKI",
    frost: "Compendium.crucible.summons.Actor.me5glbOshiijlVUH",
    lightning: "Compendium.crucible.summons.Actor.Ne25xsSqYijgcrm0",
    fallback: "Compendium.crucible.summons.Actor.RuNh1bFGiHKdHeKI" // FIXME flame
  },
  conjure: {
    earth: "Compendium.crucible.summons.Actor.ugQYiiEmj9idwvqW",
    flame: "Compendium.crucible.summons.Actor.AlwoqQKoL1BnnZjd",
    frost: "Compendium.crucible.summons.Actor.mMBMYzpipJdqVf7k",
    lightning: "Compendium.crucible.summons.Actor.c5B0l3VQPNMSw0MQ",
    fallback: "Compendium.crucible.summons.Actor.AlwoqQKoL1BnnZjd" // FIXME flame
  }
}

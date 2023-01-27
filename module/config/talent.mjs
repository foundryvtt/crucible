/**
 * The allowed target types which an Action may have.
 * @enum {{label: string}}
 */
export const ACTION_TARGET_TYPES = {
  none: {
    label: "None"
  },
  self: {
    label: "Self"
  },
  single: {
    label: "Single"
  },
  cone: {
    label: "Cone"
  },
  fan: {
    label: "Fan"
  },
  pulse: {
    label: "Pulse"
  },
  blast: {
    label: "Blast"
  },
  ray: {
    label: "Ray"
  },
  wall: {
    label: "Wall"
  }
}

/* -------------------------------------------- */

/**
 * @typedef {Object}    ActionTag
 * @property {string} tag
 * @property {string} label
 * @property {Function} [prepare]
 * @property {Function} [can]
 * @property {Function} [pre]
 * @property {Function} [execute]
 * @property {Function} [post]
 */

/**
 * Define special logic for action tag types
 * @enum {ActionTag}
 */
export const ACTION_TAGS = {
  chain: {
    tag: "chain",
    label: "ACTION.TagChain",
    tooltip: "ACTION.TagChainTooltip",
    post: async function(actor, action, target, rolls) {
      if ( !rolls.every(r => r.isSuccess ) ) return;
      const chain = await actor.equipment.weapons.mainhand.weaponAttack(target, action.bonuses);
      rolls.push(chain);
    }
  },
  deadly: {
    tag: "deadly",
    label: "ACTION.TagDeadly",
    tooltip: "ACTION.TagDeadlyTooltip",
    pre: (actor, action) => action.bonuses.multiplier += 1,
  },
  difficult: {
    tag: "difficult",
    label: "ACTION.TagDifficult",
    tooltip: "ACTION.TagDifficultTooltip",
    pre: (actor, action) => action.bonuses.banes += 2
  },
  dualwield: {
    tag: "dualwield",
    label: "ACTION.TagDualWield",
    tooltip: "ACTION.TagDualWieldTooltip",
    can: (actor, action) => actor.equipment.weapons.dualWield
  },
  empowered: {
    tag: "empowered",
    label: "ACTION.TagEmpowered",
    tooltip: "ACTION.TagEmpoweredTooltip",
    pre: (actor, action) => action.bonuses.damageBonus += 2,
  },
  exposing: {
    tag: "exposing",
    label: "ACTION.TagExposing",
    tooltip: "ACTION.TagExposingTooltip",
    pre: (actor, action) => action.bonuses.boons += 2
  },
  finesse: {
    tag: "finesse",
    label: "ACTION.TagFinesse",
    tooltip: "ACTION.TagFinesseTooltip",
    can: (actor, action) => actor.equipment.weapons.mainhand.config.category.scaling.includes("dexterity")
  },
  harmless: {
    tag: "harmless",
    label: "ACTION.TagHarmless",
    tooltip: "ACTION.TagHarmlessTooltip",
    pre: (actor, action) => action.bonuses.multiplier = 0
  },
  weakened: {
    tag: "weakened",
    label: "ACTION.TagWeakened",
    tooltip: "ACTION.TagWeakenedTooltip",
    pre: (actor, action) => action.bonuses.damageBonus -= 2,
  },
  melee: {
    tag: "melee",
    label: "ACTION.TagMelee",
    tooltip: "ACTION.TagMeleeTooltip",
    can: (actor, action) => actor.equipment.weapons.melee,
    execute: (actor, action, target) => {
      target.status.wasAttacked = true
      actor.status.hasAttacked = true
    }
  },
  mainhand: {
    tag: "mainhand",
    label: "ACTION.TagMainHand",
    tooltip: "ACTION.TagMainHandTooltip",
    prepare: (actor, action) => {
      const mh = actor.equipment.weapons.mainhand;
      action.actionCost = mh.system.actionCost + action.cost.action;
    },
    pre: (actor, action) => {
      const mh = actor.equipment.weapons.mainhand;
      foundry.utils.mergeObject(action.bonuses, mh.getItemBonuses());
      foundry.utils.mergeObject(action.context, {
        type: "weapons",
        label: "Weapon Tags",
        icon: "fa-solid fa-swords",
        hasDice: true
      });
      action.context.tags.add(mh.name);
    },
    execute: (actor, action, target) => actor.equipment.weapons.mainhand.weaponAttack(target, action.bonuses)
  },
  movement: {
    tag: "movement",
    label: "ACTION.TagMovement",
    tooltip: "ACTION.TagMovementTooltip",
    prepare: (actor, action) => action.actionCost -= (actor.status.hasMoved ? 0 : 1),
    execute: (actor, action, target) => action.actorUpdates["data.status.hasMoved"] = true
  },
  ranged: {
    tag: "ranged",
    label: "ACTION.TagRanged",
    tooltip: "ACTION.TagRangedTooltip",
    can: (actor, action) => actor.equipment.weapons.ranged,
    execute: (actor, action, target) => action.actorUpdates["data.status.hasAttacked"] = true
  },
  reaction: {
    tag: "reaction",
    label: "ACTION.TagReaction",
    tooltip: "ACTION.TagReactionTooltip",
    can: (actor, action) => actor !== game.combat?.combatant.actor
  },
  shield: {
    tag: "shield",
    label: "ACTION.TagShield",
    tooltip: "ACTION.TagShieldTooltip",
    can: (actor, action) => actor.equipment.weapons.shield
  },
  twohand: {
    tag: "twohand",
    label: "ACTION.TagTwoHanded",
    tooltip: "ACTION.TagTwoHandedTooltip",
    prepare: (actor, action) => {
      const mh = actor.equipment.weapons.mainhand;
      action.actionCost = mh.system.actionCost + action.cost.action;
    },
    can: (actor, action) => actor.equipment.weapons.twoHanded,
    pre: (actor, action) => {
      const mh = actor.equipment.weapons.mainhand;
      foundry.utils.mergeObject(action.bonuses, mh.getItemBonuses());
      foundry.utils.mergeObject(action.context, {
        type: "weapons",
        label: "Weapon Tags",
        icon: "fa-solid fa-swords",
        hasDice: true
      });
      action.context.tags.add(mh.name);
    },
    execute: (actor, action, target) => actor.equipment.weapons.mainhand.weaponAttack(target, action.bonuses)
  },
  offhand: {
    tag: "offhand",
    label: "ACTION.TagOffHand",
    tooltip: "ACTION.TagOffHandTooltip",
    prepare: (actor, action) => {
      const oh = actor.equipment.weapons.offhand;
      action.actionCost = oh.system.actionCost + action.cost.action;
    },
    pre: (actor, action) => {
      const oh = actor.equipment.weapons.offhand;
      foundry.utils.mergeObject(action.bonuses, oh.getItemBonuses());
      foundry.utils.mergeObject(action.context, {
        type: "weapons",
        label: "Weapon Tags",
        icon: "fa-solid fa-swords",
        hasDice: true
      });
      action.context.tags.add(oh.name);
    },
    execute: (actor, action, target) => actor.equipment.weapons.offhand.weaponAttack(target, action.bonuses)
  },
  unarmed: {
    tag: "unarmed",
    label: "ACTION.TagUnarmed",
    tooltip: "ACTION.TagUnarmedTooltip",
    can: (actor, action) => actor.equipment.weapons.unarmed
  },
  unarmored: {
    tag: "unarmored",
    label: "ACTION.TagUnarmored",
    tooltip: "ACTION.TagUnarmoredTooltip",
    can: (actor, action) => actor.equipment.unarmored
  },

  /* -------------------------------------------- */
  /*  Skill Checks                                */
  /* -------------------------------------------- */

  healing: {
    tag: "healing",
    label: "ACTION.TagHealing",
    tooltip: "ACTION.TagHealingTooltip",
  },

  medicine: {
    tag: "medicine",
    label: "SKILLS.Medicine",
    tooltip: "SKILLS.MedicineActionTooltip",
    execute: (actor, action, target) => actor.rollSkill("medicine", action.bonuses)
  },

  /* -------------------------------------------- */
  /*  TODO - Spells (Temporary)                   */
  /* -------------------------------------------- */

  spell: {
    tag: "spell",
    label: "Spell",
    pre: (actor, action) => {
      foundry.utils.mergeObject(action.bonuses, {multiplier: 1});
      foundry.utils.mergeObject(action.context, {
        hasDice: true,
        label: action.name,
        tags: []
      });
    },
    execute: (actor, action, target) => action.document.spellAttack(target, action.bonuses)
  },
  fortitude: {
    tag: "fortitude",
    label: "Fortitude",
    pre: (actor, action) => {
      foundry.utils.mergeObject(action.bonuses, {defenseType: "fortitude"});
      foundry.utils.mergeObject(action.context, {
        hasDice: true,
        label: action.name,
        tags: ["Fortitude"]
      });
    },
  },
  reflex: {
    tag: "reflex",
    label: "Reflex",
    pre: (actor, action) => {
      foundry.utils.mergeObject(action.bonuses, {defenseType: "reflex"});
      foundry.utils.mergeObject(action.context, {
        hasDice: true,
        label: action.name,
        tags: ["Reflex"]
      });
    },
  },
  willpower: {
    tag: "willpower",
    label: "Willpower",
    pre: (actor, action) => {
      foundry.utils.mergeObject(action.bonuses, {defenseType: "willpower"});
      foundry.utils.mergeObject(action.context, {
        hasDice: true,
        label: action.name,
        tags: ["Willpower"]
      });
    },
  },

  acid: {
    tag: "acid",
    label: "Acid",
    pre: (actor, action) => foundry.utils.mergeObject(action.bonuses, {damageType: "acid"}),
  },
  fire: {
    tag: "fire",
    label: "Fire",
    pre: (actor, action) => foundry.utils.mergeObject(action.bonuses, {damageType: "fire"}),
  },
  frost: {
    tag: "frost",
    label: "Frost",
    pre: (actor, action) => foundry.utils.mergeObject(action.bonuses, {damageType: "frost"}),
  },
  lightning: {
    tag: "lightning",
    label: "Lightning",
    pre: (actor, action) => foundry.utils.mergeObject(action.bonuses, {damageType: "lightning"}),
  },
  psychic: {
    tag: "psychic",
    label: "Psychic",
    pre: (actor, action) => foundry.utils.mergeObject(action.bonuses, {damageType: "psychic"}),
  },
  radiant: {
    tag: "radiant",
    label: "Radiant",
    pre: (actor, action) => foundry.utils.mergeObject(action.bonuses, {damageType: "radiant"}),
  },
  unholy: {
    tag: "unholy",
    label: "Unholy",
    pre: (actor, action) => foundry.utils.mergeObject(action.bonuses, {damageType: "unholy"}),
  }
}

/* -------------------------------------------- */

/**
 * The default actions that every character can perform regardless of their attributes or talents.
 * @type {object}
 */
export const DEFAULT_ACTIONS = [
  {
    id: "move",
    name: "Move",
    img: "icons/skills/movement/arrow-upward-yellow.webp",
    description: "Move quickly up to 4 spaces in any direction, or move cautiously one space in any direction.",
    targetType: "none",
    targetNumber: 1,
    targetDistance: 4,
    cost: {
      action: 1
    },
    affectAllies: false,
    affectEnemies: false,
    tags: ["movement"]
  },
  {
    id: "strike",
    name: "Strike",
    img: "icons/skills/melee/blade-tip-orange.webp",
    description: "Attack a single target creature or object with your main-hand weapon.",
    targetType: "single",
    targetNumber: 1,
    targetDistance: 1,
    affectAllies: false,
    affectEnemies: true,
    tags: ["mainhand"]
  },
  {
    id: "defend",
    name: "Defend",
    img: "icons/magic/defensive/shield-barrier-deflect-teal.webp",
    description: "You concentrate effort on avoiding harm, heightening your physical defense.",
    targetType: "self",
    targetNumber: 1,
    targetDistance: 0,
    cost: {
      action: 1
    },
    affectAllies: false,
    affectEnemies: false,
    tags: []
  }
];

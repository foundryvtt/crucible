export {default as ACTIONS} from "./actions.mjs";
import {SKILLS} from "./skills.mjs";
import {DAMAGE_TYPES, RESOURCES} from "./attributes.mjs";
import Enum from "./enum.mjs";

/**
 * The allowed target types which an Action may have.
 * @enum {{label: string}}
 */
export const TARGET_TYPES = Object.freeze({
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
});

/**
 * The scope of creatures affected by an action.
 * @enum {number}
 */
export const TARGET_SCOPES = new Enum({
  NONE: {value: 0, label: "None"},
  SELF: {value: 1, label: "Self"},
  ALLIES: {value: 2, label: "Allies"},
  ENEMIES: {value: 3, label: "Enemies"},
  ALL: {value: 4, label: "All"}
});

/* -------------------------------------------- */

/**
 * @typedef {Object}    ActionTag
 * @property {string} tag
 * @property {string} label
 * @property {Function} [prepare]
 * @property {Function} [can]
 * @property {Function} [pre]
 * @property {Function} [roll]
 * @property {Function} [post]
 */

/**
 * A generalized helper which populates tags for mainhand, offhand, and twoHanded tags.
 */
function weaponAttack(type="mainhand") {
  return {
    prepare: (actor, action) => {
      const w = actor.equipment.weapons[type === "offhand" ? "offhand" : "mainhand"];
      if ( !w ) return;
      action.cost.action += (w?.system.actionCost || 0);
      action.usage.hasDice = true;
      Object.assign(action.usage.bonuses, w.system.actionBonuses);
      Object.assign(action.usage.context, {type: "weapons", label: "Weapon Tags", icon: "fa-solid fa-swords"});
      action.usage.context.tags.add(w.name);
    },
    can: actor => {
      if ( (type === "twoHanded") && !actor.equipment.weapons.twoHanded ) {
        throw new Error("You must have a two-handed weapon equipped")
      }
      const w = actor.equipment.weapons[type === "offhand" ? "offhand" : "mainhand"];
      if ( !w ) return false;
      if ( w.config.category.reload && !w.system.loaded ) {
        throw new Error("Your weapon requires reloading in order to attack")
      }
    },
    roll: async (actor, action, target) => {
      const w = actor.equipment.weapons[type === "offhand" ? "offhand" : "mainhand"];
      action.usage.actorUpdates["system.status.hasAttacked"] = true;
      if ( w.config.category.ranged ) {
        action.usage.actorUpdates["system.status.rangedAttack"] = true;
        if ( w.config.category.reload ) {
          action.usage.actorUpdates.items ||= [];
          action.usage.actorUpdates.items.push({_id: w.id, "system.loaded": false});
        }
      }
      else action.usage.actorUpdates["system.status.meleeAttack"] = true;
      return w.attack(target, action.usage.bonuses)
    }
  }
}

/**
 * Define special logic for action tag types
 * @enum {ActionTag}
 */
export const TAGS = {

  /* -------------------------------------------- */
  /*  Required Equipment                          */
  /* -------------------------------------------- */

  // Requires Dual-Wield
  dualwield: {
    tag: "dualwield",
    label: "ACTION.TagDualWield",
    tooltip: "ACTION.TagDualWieldTooltip",
    can: (actor, action) => actor.equipment.weapons.dualWield
  },

  // Requires One-Handed weapon
  onehand: {
    tag: "onehand",
    label: "ACTION.TagOneHand",
    tooltip: "ACTION.TagOneHandTooltip",
    can: (actor, action) => !actor.equipment.weapons.twoHanded
  },

  // Requires Dexterity Weapon
  finesse: {
    tag: "finesse",
    label: "ACTION.TagFinesse",
    tooltip: "ACTION.TagFinesseTooltip",
    can: (actor, action) => actor.equipment.weapons.mainhand.config.category.scaling.includes("dexterity")
  },

  // Requires Heavy Weapon
  heavy: {
    tag: "heavy",
    label: "ACTION.TagHeavy",
    tooltip: "ACTION.TagHeavyTooltip",
    can: (actor, action) => actor.equipment.weapons.mainhand.config.category.scaling.includes("strength")
  },

  // Requires Melee Weapon
  melee: {
    tag: "melee",
    label: "ACTION.TagMelee",
    tooltip: "ACTION.TagMeleeTooltip",
    can: (actor, action) => actor.equipment.weapons.melee
  },

  // Requires Ranged Weapon
  ranged: {
    tag: "ranged",
    label: "ACTION.TagRanged",
    tooltip: "ACTION.TagRangedTooltip",
    can: (actor, action) => actor.equipment.weapons.ranged
  },

  // Requires Shield
  shield: {
    tag: "shield",
    label: "ACTION.TagShield",
    tooltip: "ACTION.TagShieldTooltip",
    can: (actor, action) => actor.equipment.weapons.shield
  },

  // Requires Unarmed
  unarmed: {
    tag: "unarmed",
    label: "ACTION.TagUnarmed",
    tooltip: "ACTION.TagUnarmedTooltip",
    can: (actor, action) => actor.equipment.weapons.unarmed
  },

  // Requires Unarmored
  unarmored: {
    tag: "unarmored",
    label: "ACTION.TagUnarmored",
    tooltip: "ACTION.TagUnarmoredTooltip",
    can: (actor, action) => actor.equipment.unarmored
  },

  // Requires Free Hand
  freehand: {
    tag: "freehand",
    label: "ACTION.TagFreehand",
    tooltip: "ACTION.TagFreehandTooltip",
    can: (actor, action) => {
      const weapons = actor.equipment.weapons;
      if ( weapons.twoHanded && actor.talentIds.has("stronggrip000000") ) return true;
      return weapons.freehand;
    }
  },

  /* -------------------------------------------- */
  /*  Context Requirements                        */
  /* -------------------------------------------- */

  // Involves Movement
  movement: {
    tag: "movement",
    label: "ACTION.TagMovement",
    tooltip: "ACTION.TagMovementTooltip",
    can: (actor, action) => {
      if ( actor.statuses.has("restrained") ) throw new Error("You may not move while Restrained!");
    },
    prepare: (actor, action) => {
      if ( actor.system.status.hasMoved || !actor.equipment.canFreeMove ) action.cost.action += 1;
      if ( actor.statuses.has("slowed") ) action.cost.action += 1;
      action.usage.actorUpdates["system.status.hasMoved"] = true
    },
    confirm: async (actor) => {
      if ( actor.statuses.has("prone") ) await actor.toggleStatusEffect("prone", {active: false});
    }
  },

  // Requires Reaction
  reaction: {
    tag: "reaction",
    label: "ACTION.TagReaction",
    tooltip: "ACTION.TagReactionTooltip",
    can: (actor, action) => actor !== game.combat?.combatant.actor,
    prepare: (actor, action) => {
      const canFreeReact = actor.talentIds.has("gladiator0000000") && !actor.system.status.gladiator
        && (action.tags.has("mainhand") || action.tags.has("offhand"));
      if ( canFreeReact ) {
        action.cost.focus = -Infinity;
        action.usage.actorUpdates["system.status.gladiator"] = true;
      }
    }
  },

  /* -------------------------------------------- */
  /*  Spellcasting Tags                           */
  /* -------------------------------------------- */

  spell: {
    tag: "spell",
    label: "ACTION.TagSpell",
    tooltip: "ACTION.TagSpellTooltip",
    prepare: (actor, action) => {
      Object.assign(action.usage.context, {
        type: "spell",
        label: "Spell Tags",
        icon: "fa-solid fa-sparkles"
      });
      action.usage.context.tags.add(`Rune: ${action.rune.name}`);
      action.usage.context.tags.add(`Gesture: ${action.gesture.name}`);
      if ( action.inflection ) action.usage.context.tags.add(action.inflection.name);
    },
    roll: (actor, action, target) => {
      action.usage.actorUpdates["system.status.hasCast"] = true;
      return actor.castSpell(action, target)
    },
    post: (actor, action) => action.usage.actorFlags.lastSpell = action.id
  },

  /* -------------------------------------------- */
  /*  Attack Rolls                                */
  /* -------------------------------------------- */

  mainhand: {
    tag: "mainhand",
    label: "ACTION.TagMainHand",
    tooltip: "ACTION.TagMainHandTooltip",
    ...weaponAttack("mainhand")
  },

  twohand: {
    tag: "twohand",
    label: "ACTION.TagTwoHanded",
    tooltip: "ACTION.TagTwoHandedTooltip",
    ...weaponAttack("twoHanded")
  },

  offhand: {
    tag: "offhand",
    label: "ACTION.TagOffHand",
    tooltip: "ACTION.TagOffHandTooltip",
    ...weaponAttack("offhand")
  },

  /* -------------------------------------------- */
  /*  Ranged Attacks                              */
  /* -------------------------------------------- */

  reload: {
    tag: "Reload",
    label: "ACTION.TagReload",
    tooltip: "ACTION.TagReloadTooltip",
    can: actor => {
      const {mainhand: m, offhand: o, reload} = actor.equipment.weapons;
      if ( !reload || (m.system.loaded && (!o || o.system.loaded)) ) {
        throw new Error("Your weapons do not require reloading");
      }
    },
    prepare: async (actor, action) => {
      const {mainhand: m, offhand: o} = actor.equipment.weapons;
      action.usage.actorUpdates.items ||= [];
      if (m.config.category.reload && !m.system.loaded) {
        action.usage.actorUpdates.items.push({_id: m.id, "system.loaded": true});
      }
      else if (o?.config.category.reload && !o.system.loaded) {
        action.usage.actorUpdates.items.push({_id: o.id, "system.loaded": true});
      }
    }
  },

  /* -------------------------------------------- */
  /*  Attack Modifiers                            */
  /* -------------------------------------------- */

  deadly: {
    tag: "deadly",
    label: "ACTION.TagDeadly",
    tooltip: "ACTION.TagDeadlyTooltip",
    prepare: (actor, action) => action.usage.bonuses.multiplier += 1,
  },

  difficult: {
    tag: "difficult",
    label: "ACTION.TagDifficult",
    tooltip: "ACTION.TagDifficultTooltip",
    prepare: (actor, action) => action.usage.bonuses.banes += 1
  },

  empowered: {
    tag: "empowered",
    label: "ACTION.TagEmpowered",
    tooltip: "ACTION.TagEmpoweredTooltip",
    prepare: (actor, action) => action.usage.bonuses.damageBonus += 6,
  },

  exposing: {
    tag: "exposing",
    label: "ACTION.TagExposing",
    tooltip: "ACTION.TagExposingTooltip",
    prepare: (actor, action) => action.usage.bonuses.boons += 2
  },
  harmless: {
    tag: "harmless",
    label: "ACTION.TagHarmless",
    tooltip: "ACTION.TagHarmlessTooltip",
    post: async (actor, action, target, rolls) => {
      for ( const roll of rolls ) {
        if ( roll.data.damage ) roll.data.damage.total = 0;
      }
    }
  },
  weakened: {
    tag: "weakened",
    label: "ACTION.TagWeakened",
    tooltip: "ACTION.TagWeakenedTooltip",
    prepare: (actor, action) => action.usage.bonuses.damageBonus -= 6,
  },

  /* -------------------------------------------- */
  /*  Defense Modifiers                           */
  /* -------------------------------------------- */

  // Target Fortitude
  fortitude: {
    tag: "fortitude",
    label: "Fortitude",
    prepare: (actor, action) => {
      action.usage.defenseType = "fortitude";
      action.usage.context.tags.add("Fortitude");
    },
  },

  // Target Reflex
  reflex: {
    tag: "reflex",
    label: "Reflex",
    prepare: (actor, action) => {
      action.usage.defenseType = "reflex";
      action.usage.context.tags.add("Reflex");
    },
  },

  // Target Willpower
  willpower: {
    tag: "willpower",
    label: "Willpower",
    prepare: (actor, action) => {
      action.usage.defenseType = "willpower";
      action.usage.context.tags.add("Willpower");
    },
  },

  /* -------------------------------------------- */
  /*  Healing Actions                             */
  /* -------------------------------------------- */

  healing: {
    tag: "healing",
    label: "ACTION.TagHealing",
    tooltip: "ACTION.TagHealingTooltip",
    prepare: (actor, action) => {
      action.usage.defenseType = "wounds";
      action.usage.restoration = true;
    }
  },

  rallying: {
    tag: "rallying",
    label: "ACTION.TagRallying",
    tooltip: "ACTION.TagRallyingTooltip",
    prepare: (actor, action) => {
      action.usage.defenseType = "madness";
      action.usage.restoration = true;
    }
  }
}

/* -------------------------------------------- */
/*  Specialized Damage Type                     */
/* -------------------------------------------- */

for ( const {id, label} of Object.values(DAMAGE_TYPES) ) {
  TAGS[id] = {
    tag: id,
    label: label,
    prepare: (actor, action) => action.usage.bonuses.damageType = id
  }
}

/* -------------------------------------------- */
/*  Target Resources                            */
/* -------------------------------------------- */

for ( const {id, label} of Object.values(RESOURCES) ) {
  TAGS[id] = {
    tag: id,
    label: label,
    prepare: (actor, action) => action.usage.resource = id
  }
}

/* -------------------------------------------- */
/*  Skill Attacks                               */
/* -------------------------------------------- */

for ( const {id, label} of Object.values(SKILLS) ) {
  TAGS[id] = {
    tag: id,
    label: label,
    prepare: (actor, action) => {
      action.usage.skillId = id;
      const skill = actor.skills[id];
      action.usage.hasDice = true;
      Object.assign(action.usage.bonuses, {
        ability: skill.abilityBonus,
        skill: skill.skillBonus,
        enchantment: skill.enchantmentBonus
      });
      Object.assign(action.usage.context, {type: "skill", label: "Skill Tags", icon: "fa-solid fa-cogs"});
      action.usage.context.tags.add(SKILLS[id].label);
    },
    roll: async (actor, action, target) => actor.skillAttack(action, target)
  }
}

/* -------------------------------------------- */

/**
 * The default actions that every character can perform regardless of their attributes or talents.
 * @type {object[]}
 */
export const DEFAULT_ACTIONS = Object.freeze([
  {
    id: "cast",
    name: "Cast Spell",
    img: "icons/magic/air/air-smoke-casting.webp",
    description: "Weave arcana to create a work of spellcraft.",
    tags: ["spell"],
    target: {
      type: "none",
    }
  },
  {
    id: "move",
    name: "Move",
    img: "icons/skills/movement/arrow-upward-yellow.webp",
    description: "Move quickly up to 4 spaces in any direction, or move cautiously one space in any direction.",
    target: {
      type: "none",
      number: 0,
      distance: 4,
      scope: 1
    },
    tags: ["movement"]
  },
  {
    id: "strike",
    name: "Strike",
    img: "icons/skills/melee/blade-tip-orange.webp",
    description: "Attack a single target creature or object with your main-hand weapon.",
    target: {
      type: "single",
      number: 1,
      distance: 1,
      scope: 3
    },
    tags: ["mainhand"]
  },
  {
    id: "defend",
    name: "Defend",
    img: "icons/magic/defensive/shield-barrier-deflect-teal.webp",
    description: "You concentrate effort on avoiding harm, heightening your physical defense. You gain the <strong>Guarded</strong> condition until the start of your next Turn.",
    target: {
      type: "self",
      number: 0,
      distance: 0,
      scope: 1
    },
    cost: {
      action: 1
    },
    effects: [
      {
        duration: { rounds: 1 },
        statuses: ["guarded"]
      }
    ],
    tags: []
  },
  {
    id: "recover",
    name: "Recover",
    img: "icons/magic/life/cross-area-circle-green-white.webp",
    description: "When not actively in combat, recover your Health, Morale, and Focus. This action is only available during Playtest One.",
    target: {
      type: "self",
      number: 0,
      distance: 0,
      scope: 1
    },
    cost: {
      action: 0
    },
    tags: []
  },
  {
    id: "refocus",
    name: "Recover Focus",
    img: "icons/magic/light/orb-shadow-blue.webp",
    description: "Use your equipped Talisman to recover Focus.",
    target: {
      type: "self",
      scope: 1
    },
    cost: {
      action: 2
    },
    tags: []
  },
  {
    id: "reload",
    name: "Reload Weapon",
    img: "icons/skills/ranged/arrow-flying-broadhead-metal.webp",
    description: "Reload a ranged weapon which features a reloading time.",
    cost: {
      action: 1
    },
    tags: ["reload"],
    target: {
      type: "self",
    }
  },
]);

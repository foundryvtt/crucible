import {CREATURE_CATEGORIES} from "../const/actor.mjs";
import {DAMAGE_TYPES} from "../const/attributes.mjs";
import {SKILLS} from "../const/skills.mjs";
import {GESTURES, RUNES} from "../const/spellcraft.mjs";

const HOOKS = {};

/* -------------------------------------------- */
/*  Damage Type Affixes                         */
/* -------------------------------------------- */

for ( const [type, cfg] of Object.entries(DAMAGE_TYPES) ) {
  const dmgId = `${type}Damage`;
  HOOKS[dmgId] = {
    prepareWeapons(item) {
      const tier = item.system.affixes[dmgId].system.tier.value;
      item.system.damage.bonus += (2 * tier);
    }
  };
  const resId = `${type}Resistance`;
  HOOKS[resId] = {
    prepareResistances(item, resistances) {
      const tier = item.system.affixes[resId].system.tier.value;
      resistances[type].bonus += (3 * tier);
    }
  };
  if ( !["bludgeoning", "piercing", "slashing"].includes(type) ) {
    const convId = `${type}Conversion`;
    HOOKS[convId] = {
      prepareWeapons(item) {
        item.system.damageType = type;
      }
    };
  }
}

/* -------------------------------------------- */
/*  Rune Potency Affixes                        */
/* -------------------------------------------- */

for ( const runeId of Object.keys(RUNES) ) {
  const id = `${runeId}Potency`;
  HOOKS[id] = {
    prepareAttack(item, action, target, rollData) {
      if ( action.rune?.id !== runeId ) return;
      const tier = item.system.affixes[id].system.tier.value;
      rollData.enchantment = Math.max(rollData.enchantment, tier);
    }
  };
}

/* -------------------------------------------- */
/*  Rune Knowledge Affixes                      */
/* -------------------------------------------- */

for ( const runeId of Object.keys(RUNES) ) {
  const id = `${runeId}Spellcraft`;
  HOOKS[id] = {
    prepareGrimoire(item, grimoire) {
      grimoire.runeIds.push(runeId);
      this.training[runeId] = Math.max(this.training[runeId] ?? 0, 1);
    }
  };
}

/* -------------------------------------------- */
/*  Gesture Knowledge Affixes                   */
/* -------------------------------------------- */

for ( const gestureId of Object.keys(GESTURES) ) {
  if ( gestureId === "touch" ) continue;
  const id = `${gestureId}Spellcraft`;
  HOOKS[id] = {
    prepareGrimoire(item, grimoire) {
      grimoire.gestureIds.push(gestureId);
    }
  };
}

/* -------------------------------------------- */
/*  Skill Enchantment Affixes                   */
/* -------------------------------------------- */

for ( const skillId of Object.keys(SKILLS) ) {
  const id = `${skillId}Skill`;
  HOOKS[id] = {
    prepareSkills(item, skills) {
      const tier = item.system.affixes[id].system.tier.value;
      skills[skillId].enchantmentBonus = Math.max(skills[skillId].enchantmentBonus, tier);
    }
  };
}

/* -------------------------------------------- */

/**
 * Keen: Reduce the critical success threshold for attack rolls made with this weapon.
 * The threshold decreases by 1 per tier (default 6, tier 1 = 5, tier 2 = 4, tier 3 = 3).
 */
HOOKS.keen = {
  prepareAttack(item, action, target, rollData) {
    const tier = item.system.affixes.keen.system.tier.value;
    rollData.criticalSuccessThreshold = 6 - tier;
  }
};

/* -------------------------------------------- */

/**
 * Tenacity: Increase Fortitude defense by the affix tier.
 */
HOOKS.tenacity = {
  prepareDefenses(item, defenses) {
    const tier = item.system.affixes.tenacity.system.tier.value;
    defenses.fortitude.bonus += tier;
  }
};

/* -------------------------------------------- */

HOOKS.reach = {
  prepareWeapons(item, weapons) {
    const tier = item.system.affixes.reach.system.tier.value;
    const category = item.system.config.category;
    item.system.range += category.ranged ? (10 * tier) : tier;
  }
};

/* -------------------------------------------- */

HOOKS.reliable = {
  prepareAttack(item, action, target, rollData) {
    const tier = item.system.affixes.reliable.system.tier.value;
    rollData.criticalFailureThreshold = 6 - tier;
  }
};

/* -------------------------------------------- */

HOOKS.returning = {
  preActivateAction(item, action) {
    if ( !action.tags.has("strike") ) return;
    const updates = action.selfUpdateEvent.actorUpdates.items;
    if ( !updates ) return;
    const update = updates.find(u => (u._id === item.id) && (u.system?.dropped === true));
    if ( !update ) return;
    if ( !item.system.dropped ) delete update.system.dropped;
    if ( item.system.equipped ) delete update.system.equipped;
  }
};

/* -------------------------------------------- */

HOOKS.weaponPotency = {
  prepareWeapons(item, weapons) {
    const tier = item.system.affixes.weaponPotency.system.tier.value;
    item.system.actionBonuses.enchantment += tier;
  }
};

/* -------------------------------------------- */

HOOKS.deflection = {
  prepareDefenses(item, defenses) {
    const tier = item.system.affixes.deflection.system.tier.value;
    defenses.parry.bonus += tier;
  }
};

/* -------------------------------------------- */

/**
 * Token light configuration applied while the Activate Illumination action of a Luminous-affixed item is active.
 * Bright and dim radii scale with the affix tier; the warm hue with a slow pulse animation reads as enchanted
 * rather than mundane firelight.
 * @type {Readonly<LightData>}
 */
const LUMINOUS_LIGHT = Object.freeze({alpha: 0.7, angle: 360, color: "#ffe066", coloration: 100,
  attenuation: 0.6, luminosity: 0.5, saturation: 0.1, contrast: 0, shadows: 0, negative: false, priority: 0,
  animation: {type: "pulse", speed: 2, intensity: 3, reverse: false}, darkness: {min: 0, max: 1}});

HOOKS.luminous = {
  prepareToken(item, token) {
    if ( !this.effects.has("affixLuminous000") ) return;
    if ( (token.light.bright !== 0) || (token.light.dim !== 0) ) return;
    const tier = item.system.affixes.luminous.system.tier.value;
    const dim = 40 * tier;
    foundry.utils.mergeObject(token.light, {...LUMINOUS_LIGHT, bright: dim / 2, dim});
  }
};

/* -------------------------------------------- */

HOOKS.guarding = {
  prepareDefenses(item, defenses) {
    const tier = item.system.affixes.guarding.system.tier.value;
    defenses.block.bonus += tier;
  }
};

/* -------------------------------------------- */
/*  Accessory and Armor Affixes                 */
/* -------------------------------------------- */

HOOKS.determination = {
  prepareDefenses(item, defenses) {
    const tier = item.system.affixes.determination.system.tier.value;
    defenses.willpower.bonus += tier;
  }
};

/* -------------------------------------------- */

HOOKS.evasion = {
  prepareDefenses(item, defenses) {
    const tier = item.system.affixes.evasion.system.tier.value;
    defenses.dodge.bonus += tier;
  }
};

/* -------------------------------------------- */

HOOKS.nimbleness = {
  prepareDefenses(item, defenses) {
    const tier = item.system.affixes.nimbleness.system.tier.value;
    defenses.reflex.bonus += tier;
  }
};

/* -------------------------------------------- */

HOOKS.reinforcement = {
  prepareDefenses(item, defenses) {
    const tier = item.system.affixes.reinforcement.system.tier.value;
    defenses.armor.bonus += tier;
  }
};

HOOKS.hale = {
  prepareResources(item, resources) {
    const tier = item.system.affixes.hale.system.tier.value;
    resources.health.bonus += (6 * tier);
  }
};

/* -------------------------------------------- */

HOOKS.spirited = {
  prepareResources(item, resources) {
    const tier = item.system.affixes.spirited.system.tier.value;
    resources.morale.bonus += (6 * tier);
  }
};

/* -------------------------------------------- */
/*  Armor-Only Affixes                          */
/* -------------------------------------------- */

HOOKS.mending = {
  prepareDefenses(item, defenses) {
    const tier = item.system.affixes.mending.system.tier.value;
    defenses.wounds.bonus -= tier;
  }
};

/* -------------------------------------------- */

HOOKS.nonchalant = {
  defendAttack(item, action, attacker, rollData) {
    const resource = action.usage?.resource || action.rune?.resource || "health";
    if ( resource === "morale" ) {
      const tier = item.system.affixes.nonchalant.system.tier.value;
      rollData.criticalSuccessThreshold = (rollData.criticalSuccessThreshold ?? 6) + tier;
    }
  }
};

/* -------------------------------------------- */

HOOKS.rallying = {
  prepareDefenses(item, defenses) {
    const tier = item.system.affixes.rallying.system.tier.value;
    defenses.madness.bonus -= tier;
  }
};

/* -------------------------------------------- */

HOOKS.unshakeable = {
  defendAttack(item, action, attacker, rollData) {
    const resource = action.usage?.resource || action.rune?.resource || "health";
    if ( resource === "health" ) {
      const tier = item.system.affixes.unshakeable.system.tier.value;
      rollData.criticalSuccessThreshold = (rollData.criticalSuccessThreshold ?? 6) + tier;
    }
  }
};

/* -------------------------------------------- */
/*  Accessory-Only Affixes                      */
/* -------------------------------------------- */

HOOKS.luminary = {
  prepareAction(item, action) {
    if ( !action.tags.has("composed") || !action.inflection?.id ) return;
    const tier = item.system.affixes.luminary.system.tier.value;
    action.usage.boons[item.system.identifier] = {label: item.name, number: tier};
  }
};

/* -------------------------------------------- */
/*  Creature Bane Affixes                       */
/* -------------------------------------------- */

for ( const categoryId of Object.keys(CREATURE_CATEGORIES) ) {
  if ( (categoryId === "elemental") || (categoryId === "humanoid") ) continue;
  const id = `${categoryId}Bane`;
  HOOKS[id] = {
    prepareAttack(item, action, target, rollData) {
      if ( item.id !== rollData.itemId ) return;
      if ( target.system.details.taxonomy?.category !== categoryId ) return;
      const tier = item.system.affixes[id].system.tier.value;
      rollData.boons[id] = {label: item.name, number: tier};
    }
  };
}

/* -------------------------------------------- */

export default HOOKS;

import {CREATURE_CATEGORIES} from "../const/actor.mjs";
import {DAMAGE_TYPES} from "../const/attributes.mjs";
import {SKILLS} from "../const/skills.mjs";
import {GESTURES, INFLECTIONS, RUNES} from "../const/spellcraft.mjs";

const HOOKS = {};

/* -------------------------------------------- */
/*  Damage Type Affixes                         */
/* -------------------------------------------- */

for ( const [type, cfg] of Object.entries(DAMAGE_TYPES) ) {
  const dmgId = `${type}Damage`;
  HOOKS[dmgId] = {
    prepareWeapons(item) {
      const affix = item.system.affixes[dmgId].system;
      item.system.damage.bonus += (2 * affix.tier.value * affix.sign);
    }
  };
  const resId = `${type}Resistance`;
  HOOKS[resId] = {
    prepareResistances(item, resistances) {
      const affix = item.system.affixes[resId].system;
      resistances[type].bonus += (3 * affix.tier.value * affix.sign);
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
      const affix = item.system.affixes[id].system;
      rollData.enchantment = affix.cursed
        ? Math.min(rollData.enchantment, -affix.tier.value)
        : Math.max(rollData.enchantment, affix.tier.value);
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
      this.system.training[runeId] = Math.max(this.system.training[runeId] ?? 0, 1);
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
/*  Inflection Knowledge Affixes                */
/* -------------------------------------------- */

for ( const inflectionId of Object.keys(INFLECTIONS) ) {
  const id = `${inflectionId}Spellcraft`;
  HOOKS[id] = {
    prepareGrimoire(item, grimoire) {
      grimoire.inflectionIds.push(inflectionId);
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
      const affix = item.system.affixes[id].system;
      skills[skillId].enchantmentBonus = affix.cursed
        ? Math.min(skills[skillId].enchantmentBonus, -affix.tier.value)
        : Math.max(skills[skillId].enchantmentBonus, affix.tier.value);
    }
  };
}

/* -------------------------------------------- */

/**
 * Keen: reduce the critical success threshold by 1 per tier for attacks with this weapon, stacking with other reducers.
 */
HOOKS.keen = {
  prepareAttack(item, action, target, rollData) {
    if ( rollData.itemId !== item.id ) return; // Only apply to the correct weapon
    const affix = item.system.affixes.keen.system;
    rollData.criticalSuccessThreshold = (rollData.criticalSuccessThreshold ?? 6) - (affix.tier.value * affix.sign);
  }
};

/* -------------------------------------------- */

/**
 * Vicious: a Strike that scores a Critical Hit with this physical weapon exploits the wound. Piercing and slashing
 * weapons cause Bleeding; melee bludgeoning weapons leave the target Staggered.
 */
HOOKS.vicious = {
  applyCriticalEffects(item, action) {
    for ( const events of action.eventsByTarget.values() ) {
      for ( const event of events.roll ) {
        if ( !event.isCriticalSuccess || !event.damagesHealth ) continue;
        if ( event.weaponItem?.id !== item.id ) continue;
        const dt = event.weaponItem.system.damageType;
        if ( (dt === "piercing") || (dt === "slashing") ) {
          event.effects.push(SYSTEM.EFFECTS.bleeding(this, {damageType: dt}));
          break;
        }
        else if ( (dt === "bludgeoning") && action.tags.has("melee") ) {
          event.effects.push(SYSTEM.EFFECTS.staggered(this));
          break;
        }
      }
    }
  }
};

/* -------------------------------------------- */

/**
 * Tenacity: Increase Fortitude defense by the affix tier.
 */
HOOKS.tenacity = {
  prepareDefenses(item, defenses) {
    const affix = item.system.affixes.tenacity.system;
    defenses.fortitude.bonus += (affix.tier.value * affix.sign);
  }
};

/* -------------------------------------------- */

HOOKS.reach = {
  prepareWeapons(item, weapons) {
    const affix = item.system.affixes.reach.system;
    const category = item.system.config.category;
    item.system.range += (category.ranged ? 10 : 1) * affix.tier.value * affix.sign;
  }
};

/* -------------------------------------------- */

HOOKS.reliable = {
  prepareAttack(item, action, target, rollData) {
    const affix = item.system.affixes.reliable.system;
    rollData.criticalFailureThreshold = 6 - (affix.tier.value * affix.sign);
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
    const affix = item.system.affixes.weaponPotency.system;
    item.system.actionBonuses.enchantment += (affix.tier.value * affix.sign);
  }
};

/* -------------------------------------------- */

HOOKS.deflection = {
  prepareDefenses(item, defenses) {
    const affix = item.system.affixes.deflection.system;
    defenses.parry.bonus += (affix.tier.value * affix.sign);
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
    const affix = item.system.affixes.guarding.system;
    defenses.block.bonus += (affix.tier.value * affix.sign);
  }
};

/* -------------------------------------------- */
/*  Accessory and Armor Affixes                 */
/* -------------------------------------------- */

HOOKS.determination = {
  prepareDefenses(item, defenses) {
    const affix = item.system.affixes.determination.system;
    defenses.willpower.bonus += (affix.tier.value * affix.sign);
  }
};

/* -------------------------------------------- */

HOOKS.evasion = {
  prepareDefenses(item, defenses) {
    const affix = item.system.affixes.evasion.system;
    defenses.dodge.bonus += (affix.tier.value * affix.sign);
  }
};

/* -------------------------------------------- */

HOOKS.nimbleness = {
  prepareDefenses(item, defenses) {
    const affix = item.system.affixes.nimbleness.system;
    defenses.reflex.bonus += (affix.tier.value * affix.sign);
  }
};

/* -------------------------------------------- */

HOOKS.reinforcement = {
  prepareDefenses(item, defenses) {
    const affix = item.system.affixes.reinforcement.system;
    defenses.armor.bonus += (affix.tier.value * affix.sign);
  }
};

HOOKS.hale = {
  prepareResources(item, resources) {
    const affix = item.system.affixes.hale.system;
    resources.health.bonus += (6 * affix.tier.value * affix.sign);
  }
};

/* -------------------------------------------- */

HOOKS.spirited = {
  prepareResources(item, resources) {
    const affix = item.system.affixes.spirited.system;
    resources.morale.bonus += (6 * affix.tier.value * affix.sign);
  }
};

/* -------------------------------------------- */
/*  Armor-Only Affixes                          */
/* -------------------------------------------- */

HOOKS.mending = {
  prepareDefenses(item, defenses) {
    const affix = item.system.affixes.mending.system;
    defenses.wounds.bonus -= (affix.tier.value * affix.sign);
  }
};

/* -------------------------------------------- */

HOOKS.nonchalant = {
  defendAttack(item, action, attacker, rollData) {
    const resource = action.usage?.resource || action.rune?.resource || "health";
    if ( resource === "morale" ) {
      const affix = item.system.affixes.nonchalant.system;
      rollData.criticalSuccessThreshold = (rollData.criticalSuccessThreshold ?? 6) + (affix.tier.value * affix.sign);
    }
  }
};

/* -------------------------------------------- */

HOOKS.rallying = {
  prepareDefenses(item, defenses) {
    const affix = item.system.affixes.rallying.system;
    defenses.madness.bonus -= (affix.tier.value * affix.sign);
  }
};

/* -------------------------------------------- */

HOOKS.unshakeable = {
  defendAttack(item, action, attacker, rollData) {
    const resource = action.usage?.resource || action.rune?.resource || "health";
    if ( resource === "health" ) {
      const affix = item.system.affixes.unshakeable.system;
      rollData.criticalSuccessThreshold = (rollData.criticalSuccessThreshold ?? 6) + (affix.tier.value * affix.sign);
    }
  }
};

/* -------------------------------------------- */
/*  Accessory-Only Affixes                      */
/* -------------------------------------------- */

HOOKS.luminary = {
  prepareAction(item, action) {
    if ( !action.tags.has("composed") || !action.inflection?.id ) return;
    const affix = item.system.affixes.luminary.system;
    const pool = affix.cursed ? action.usage.banes : action.usage.boons;
    pool[item.system.identifier] = {label: item.name, number: affix.tier.value};
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
      const affix = item.system.affixes[id].system;
      const pool = affix.cursed ? rollData.banes : rollData.boons;
      pool[id] = {label: item.name, number: affix.tier.value};
    }
  };
}

/* -------------------------------------------- */

export default HOOKS;

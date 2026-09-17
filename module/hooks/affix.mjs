import {CREATURE_CATEGORIES} from "../const/actor.mjs";
import {DAMAGE_TYPES} from "../const/attributes.mjs";
import {SKILLS} from "../const/proficiencies.mjs";
import {GESTURES, INFLECTIONS, RUNES} from "../const/spellcraft.mjs";

const HOOKS = {};

/* -------------------------------------------- */
/*  Damage Type Affixes                         */
/* -------------------------------------------- */

for ( const [type, cfg] of Object.entries(DAMAGE_TYPES) ) {
  const dmgId = `${type}Damage`;
  HOOKS[dmgId] = {
    prepareWeapons(item) {
      const {isCursed, tier} = item.system.affixes[dmgId].system;
      const bonus = 2 * tier.value;
      item.system.damage.bonus += isCursed ? -bonus : bonus;
    }
  };
  const resId = `${type}Resistance`;
  HOOKS[resId] = {
    prepareResistances(item, resistances) {
      const {isCursed, tier} = item.system.affixes[resId].system;
      const bonus = 3 * tier.value;
      resistances[type].bonus += isCursed ? -bonus : bonus;
    }
  };
  if ( !["bludgeoning", "piercing", "slashing"].includes(type) ) {
    const convId = `${type}Conversion`;
    HOOKS[convId] = {
      prepareWeapons(item) {
        if ( item.system.affixes[convId].system.isCursed ) return;
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
      const {isCursed, tier} = item.system.affixes[id].system;
      if ( isCursed ) rollData.enchantment = Math.min(rollData.enchantment, -tier.value);
      else rollData.enchantment = Math.max(rollData.enchantment, tier.value);
    }
  };
}

/* -------------------------------------------- */
/*  Rune Knowledge Affixes                      */
/* -------------------------------------------- */

for ( const runeId of Object.keys(RUNES) ) {
  const id = `${runeId}Spellcraft`;
  HOOKS[id] = {
    prepareTraining(item, training) {
      const {isCursed, tier} = item.system.affixes[id].system;
      if ( isCursed ) return;
      const t = training[SYSTEM.SPELL.RUNES[runeId].training];
      if ( t ) t.initial += (2 * tier.value);
    },
    prepareGrimoire(item, grimoire) {
      if ( item.system.affixes[id].system.isCursed ) return;
      grimoire.runeIds.push(runeId);
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
      if ( item.system.affixes[id].system.isCursed ) return;
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
      if ( item.system.affixes[id].system.isCursed ) return;
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
      const {isCursed, tier} = item.system.affixes[id].system;
      const skill = skills[skillId];
      if ( isCursed ) skill.enchantmentBonus = Math.min(skill.enchantmentBonus, -tier.value);
      else skill.enchantmentBonus = Math.max(skill.enchantmentBonus, tier.value);
    }
  };
}

/* -------------------------------------------- */

/**
 * Keen: reduce the critical success threshold by 1 per tier for attacks with this weapon.
 */
HOOKS.keen = {
  prepareAttack(item, action, target, rollData) {
    if ( rollData.itemId !== item.id ) return; // Only apply to the correct weapon
    const {isCursed, tier} = item.system.affixes.keen.system;
    const threshold = rollData.criticalSuccessThreshold ?? 6;
    rollData.criticalSuccessThreshold = isCursed ? (threshold + tier.value) : (threshold - tier.value);
  }
};

/* -------------------------------------------- */

/**
 * Vicious: a Strike that scores a Critical Hit with this physical weapon causes bleeding or staggered.
 */
HOOKS.vicious = {
  applyCriticalEffects(item, action) {
    if ( item.system.affixes.vicious.system.isCursed ) return;
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
    const {isCursed, tier} = item.system.affixes.tenacity.system;
    defenses.fortitude.bonus += isCursed ? -tier.value : tier.value;
  }
};

/* -------------------------------------------- */

HOOKS.reach = {
  prepareWeapons(item, weapons) {
    const {isCursed, tier} = item.system.affixes.reach.system;
    if ( isCursed ) return;
    const category = item.system.config.category;
    item.system.range += category.ranged ? (10 * tier.value) : tier.value;
  }
};

/* -------------------------------------------- */

HOOKS.reliable = {
  prepareAttack(item, action, target, rollData) {
    const {isCursed, tier} = item.system.affixes.reliable.system;
    rollData.criticalFailureThreshold = isCursed ? (6 + tier.value) : (6 - tier.value);
  }
};

/* -------------------------------------------- */

HOOKS.returning = {
  preActivateAction(item, action) {
    if ( item.system.affixes.returning?.system.isCursed ) return; // Caution: weapon.chainHook delegates to this hook
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
    const {isCursed, tier} = item.system.affixes.weaponPotency.system;
    item.system.actionBonuses.enchantment += isCursed ? -tier.value : tier.value;
  }
};

/* -------------------------------------------- */

HOOKS.deflection = {
  prepareDefenses(item, defenses) {
    const {isCursed, tier} = item.system.affixes.deflection.system;
    defenses.parry.bonus += isCursed ? -tier.value : tier.value;
  }
};

/* -------------------------------------------- */

HOOKS.luminous = {
  LIGHT_CONFIG: Object.freeze({alpha: 0.7, angle: 360, color: "#ffe066", coloration: 100,
    attenuation: 0.6, luminosity: 0.5, saturation: 0.1, contrast: 0, shadows: 0, negative: false, priority: 0,
    animation: {type: "pulse", speed: 2, intensity: 3, reverse: false}, darkness: {min: 0, max: 1}}),
  prepareToken(item, token) {
    if ( !this.effects.has("affixLuminous000") ) return;
    if ( (token.light.bright !== 0) || (token.light.dim !== 0) ) return;
    const {isCursed, tier} = item.system.affixes.luminous.system;
    if ( isCursed ) return;
    const dim = 40 * tier.value;
    foundry.utils.mergeObject(token.light, {...HOOKS.luminous.LIGHT_CONFIG, bright: dim / 2, dim});
  }
};

/* -------------------------------------------- */

HOOKS.guarding = {
  prepareDefenses(item, defenses) {
    const {isCursed, tier} = item.system.affixes.guarding.system;
    defenses.block.bonus += isCursed ? -tier.value : tier.value;
  }
};

/* -------------------------------------------- */
/*  Accessory and Armor Affixes                 */
/* -------------------------------------------- */

HOOKS.determination = {
  prepareDefenses(item, defenses) {
    const {isCursed, tier} = item.system.affixes.determination.system;
    defenses.willpower.bonus += isCursed ? -tier.value : tier.value;
  }
};

/* -------------------------------------------- */

HOOKS.evasion = {
  prepareDefenses(item, defenses) {
    const {isCursed, tier} = item.system.affixes.evasion.system;
    defenses.dodge.bonus += isCursed ? -tier.value : tier.value;
  }
};

/* -------------------------------------------- */

HOOKS.nimbleness = {
  prepareDefenses(item, defenses) {
    const {isCursed, tier} = item.system.affixes.nimbleness.system;
    defenses.reflex.bonus += isCursed ? -tier.value : tier.value;
  }
};

/* -------------------------------------------- */

HOOKS.reinforcement = {
  prepareDefenses(item, defenses) {
    const {isCursed, tier} = item.system.affixes.reinforcement.system;
    defenses.armor.bonus += isCursed ? -tier.value : tier.value;
  }
};

HOOKS.hale = {
  prepareResources(item, resources) {
    const {isCursed, tier} = item.system.affixes.hale.system;
    const bonus = 6 * tier.value;
    resources.health.bonus += isCursed ? -bonus : bonus;
  }
};

/* -------------------------------------------- */

HOOKS.spirited = {
  prepareResources(item, resources) {
    const {isCursed, tier} = item.system.affixes.spirited.system;
    const bonus = 6 * tier.value;
    resources.morale.bonus += isCursed ? -bonus : bonus;
  }
};

/* -------------------------------------------- */
/*  Armor-Only Affixes                          */
/* -------------------------------------------- */

HOOKS.mending = {
  prepareDefenses(item, defenses) {
    const {isCursed, tier} = item.system.affixes.mending.system;
    defenses.wounds.bonus += isCursed ? tier.value : -tier.value;
  }
};

/* -------------------------------------------- */

HOOKS.nonchalant = {
  defendAttack(item, action, attacker, rollData) {
    const resource = action.usage?.resource || action.rune?.resource || "health";
    if ( resource === "morale" ) {
      const {isCursed, tier} = item.system.affixes.nonchalant.system;
      const threshold = rollData.criticalSuccessThreshold ?? 6;
      rollData.criticalSuccessThreshold = isCursed ? (threshold - tier.value) : (threshold + tier.value);
    }
  }
};

/* -------------------------------------------- */

HOOKS.rallying = {
  prepareDefenses(item, defenses) {
    const {isCursed, tier} = item.system.affixes.rallying.system;
    defenses.madness.bonus += isCursed ? tier.value : -tier.value;
  }
};

/* -------------------------------------------- */

HOOKS.unshakeable = {
  defendAttack(item, action, attacker, rollData) {
    const resource = action.usage?.resource || action.rune?.resource || "health";
    if ( resource === "health" ) {
      const {isCursed, tier} = item.system.affixes.unshakeable.system;
      const threshold = rollData.criticalSuccessThreshold ?? 6;
      rollData.criticalSuccessThreshold = isCursed ? (threshold - tier.value) : (threshold + tier.value);
    }
  }
};

/* -------------------------------------------- */
/*  Accessory-Only Affixes                      */
/* -------------------------------------------- */

HOOKS.luminary = {
  prepareAction(item, action) {
    if ( !action.tags.has("composed") || !action.inflection?.id ) return;
    const {isCursed, tier} = item.system.affixes.luminary.system;
    const pool = isCursed ? action.usage.banes : action.usage.boons;
    pool[item.system.identifier] = {label: item.name, number: tier.value};
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
      const {isCursed, tier} = item.system.affixes[id].system;
      const pool = isCursed ? rollData.banes : rollData.boons;
      pool[id] = {label: item.name, number: tier.value};
    }
  };
}

/* -------------------------------------------- */

export default HOOKS;

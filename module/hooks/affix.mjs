import {DAMAGE_TYPES} from "../const/attributes.mjs";
import {SKILLS} from "../const/skills.mjs";
import {RUNES} from "../const/spellcraft.mjs";

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
    const updates = action.selfUpdateEvent.actorUpdates.items;
    if ( !updates ) return;
    const update = updates.find(u => (u._id === item.id) && u.system?.dropped);
    if ( update ) delete update.system.dropped;
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

export default HOOKS;

const HOOKS = {};

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

/**
 * Weapon Potency: Increase the enchantment bonus to attack rolls by the affix tier.
 */
HOOKS.weaponPotency = {
  prepareWeapons(item, weapons) {
    const tier = item.system.affixes.weaponPotency.system.tier.value;
    item.system.actionBonuses.enchantment += tier;
  }
};

/* -------------------------------------------- */

export default HOOKS;

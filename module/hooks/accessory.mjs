const HOOKS = {};

/* -------------------------------------------- */

HOOKS.determination = {
  prepareDefenses(item, defenses) {
    const {quality, enchantment} = item.system.config;
    defenses.willpower.bonus += Math.min(quality.bonus, enchantment.bonus);
  }
}

/* -------------------------------------------- */

HOOKS.evasion = {
  prepareDefenses(item, defenses) {
    const {quality, enchantment} = item.system.config;
    defenses.dodge.bonus += Math.min(quality.bonus, enchantment.bonus);
  }
}

/* -------------------------------------------- */

HOOKS.nimbleness = {
  prepareDefenses(item, defenses) {
    const {quality, enchantment} = item.system.config;
    defenses.reflex.bonus += Math.min(quality.bonus, enchantment.bonus);
  }
}

/* -------------------------------------------- */

HOOKS.reinforcement = {
  prepareDefenses(item, defenses) {
    const {quality, enchantment} = item.system.config;
    defenses.armor.bonus += Math.min(quality.bonus, enchantment.bonus);
  }
}

/* -------------------------------------------- */

HOOKS.tenacity = {
  prepareDefenses(item, defenses) {
    const {quality, enchantment} = item.system.config;
    defenses.fortitude.bonus += Math.min(quality.bonus, enchantment.bonus);
  }
}

/* -------------------------------------------- */

export default HOOKS;

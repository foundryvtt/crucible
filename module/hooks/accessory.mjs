const HOOKS = {};

/* -------------------------------------------- */

HOOKS.reinforcement = {
  prepareDefenses(item, defenses) {
    const {quality, enchantment} = item.system.config;
    defenses.armor.bonus += Math.min(quality.bonus, enchantment.bonus);
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

export default HOOKS;

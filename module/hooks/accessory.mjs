const HOOKS = {};

/* -------------------------------------------- */

HOOKS.cloakKindlyVisage = {
  prepareSkillCheck(item, skill, rollData) {
    if ( rollData.type === "diplomacy" ) {
      const {enchantment} = item.system.config;
      rollData.boons[item.system.identifier] = {label: item.name, number: enchantment.bonus};
    }
  },
  preActivateAction(item, action, _targets) {
    if ( action.tags.has("diplomacy") ) {
      const {enchantment} = item.system.config;
      action.usage.boons[item.system.identifier] = {label: item.name, number: enchantment.bonus};
    }
  }
};

/* -------------------------------------------- */

HOOKS.determination = {
  prepareDefenses(item, defenses) {
    const {quality, enchantment} = item.system.config;
    defenses.willpower.bonus += Math.min(quality.bonus, enchantment.bonus);
  }
};

/* -------------------------------------------- */

HOOKS.evasion = {
  prepareDefenses(item, defenses) {
    const {quality, enchantment} = item.system.config;
    defenses.dodge.bonus += Math.min(quality.bonus, enchantment.bonus);
  }
};

/* -------------------------------------------- */

HOOKS.expandedToolbelt = {
  prepareAccessories(item, _accessories) {
    const {quality} = item.system.config;
    this.equipment.toolbeltSlots += (1 + quality.bonus);
  }
};

/* -------------------------------------------- */

HOOKS.luminary = {
  prepareAction(item, action) {
    if ( !action.tags.has("composed") || !action.inflection?.id ) return;
    const {enchantment} = item.system.config;
    this.usage.boons[item.system.identifier] = {label: item.name, number: enchantment.bonus};
  }
};

/* -------------------------------------------- */

HOOKS.nimbleness = {
  prepareDefenses(item, defenses) {
    const {quality, enchantment} = item.system.config;
    defenses.reflex.bonus += Math.min(quality.bonus, enchantment.bonus);
  }
};

/* -------------------------------------------- */

HOOKS.reinforcement = {
  prepareDefenses(item, defenses) {
    const {quality, enchantment} = item.system.config;
    defenses.armor.bonus += Math.min(quality.bonus, enchantment.bonus);
  }
};

/* -------------------------------------------- */

HOOKS.tenacity = {
  prepareDefenses(item, defenses) {
    const {quality, enchantment} = item.system.config;
    defenses.fortitude.bonus += Math.min(quality.bonus, enchantment.bonus);
  }
};

/* -------------------------------------------- */

export default HOOKS;

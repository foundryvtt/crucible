const HOOKS = {};

/* -------------------------------------------- */

HOOKS.expandedToolbelt = {
  prepareAccessories(item, _accessories) {
    const {quality} = item.system.config;
    this.equipment.toolbeltSlots += (1 + quality.bonus);
  }
};

/* -------------------------------------------- */

export default HOOKS;

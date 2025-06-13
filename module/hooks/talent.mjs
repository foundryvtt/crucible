const TALENT_HOOKS = {};

/* -------------------------------------------- */

TALENT_HOOKS.armoredShell0000 = {
  prepareDefenses(item, defenses) {
    if ( !this.statuses.has("guarded") ) return;
    const offhand = this.equipment.weapons.offhand;
    if ( offhand.category !== "shieldHeavy" ) return;
    const halfArmor = Math.ceil(defenses.armor.base / 2);
    defenses.armor.base -= halfArmor;
    defenses.block.bonus += halfArmor;
  }
};

/* -------------------------------------------- */

TALENT_HOOKS.bloodmagic000000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("spell") ) return;
    action.cost.health = action.cost.focus * 10;
    action.cost.focus = 0;
  },
  confirmActionOutcome(item, action, outcome, _options) {
    if ( action.target !== this ) return;
    outcome.resources.health = Math.min(outcome.resources.health, -action.cost.health);
  }
};

/* -------------------------------------------- */

TALENT_HOOKS.conserveeffort00 = {
  endTurn(item, {resourceRecovery, statusText}) {
    if ( this.resources.action.value ) {
      resourceRecovery.focus = (resourceRecovery.focus || 0) + 1;
      statusText.push({text: "Conserve Effort", fillColor: SYSTEM.RESOURCES.focus.color.css});
    }
  }
}

/* -------------------------------------------- */

TALENT_HOOKS.irrepressiblespi = {
  startTurn(item, {resourceRecovery}) {
    if ( !this.system.isBroken ) resourceRecovery.morale = (resourceRecovery.morale || 0) + 1;
  }
}

/* -------------------------------------------- */

TALENT_HOOKS.lesserregenerati = {
  startTurn(item, {resourceRecovery}) {
    if ( !this.system.isWeakened ) resourceRecovery.health = (resourceRecovery.health || 0) + 1;
  }
}

/* -------------------------------------------- */

TALENT_HOOKS.powerfulThrow000 = {
  prepareAction(item, action) {
    if ( action.tags.has("thrown") ) {
      action.range.maximum *= 2;
    }
  }
};

/* -------------------------------------------- */

export default TALENT_HOOKS;

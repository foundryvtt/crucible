const TALENT_HOOKS = {};

/* -------------------------------------------- */

TALENT_HOOKS.armoredShell0000 = {
  prepareDefenses(actor, defenses) {
    if ( !actor.statuses.has("guarded") ) return;
    const offhand = actor.equipment.weapons.offhand;
    if ( offhand.category !== "shieldHeavy" ) return;
    const halfArmor = Math.ceil(defenses.armor.base / 2);
    defenses.armor.base -= halfArmor;
    defenses.block.bonus += halfArmor;
  }
};

/* -------------------------------------------- */

TALENT_HOOKS.bloodmagic000000 = {
  prepareAction(actor, action) {
    if ( !action.tags.has("spell") ) return;
    action.cost.health = action.cost.focus * 10;
    action.cost.focus = 0;
  },
  confirmActionOutcome(actor, action, outcome, _options) {
    if ( action.target !== this ) return;
    outcome.resources.health = Math.min(outcome.resources.health, -action.cost.health);
  }
};

/* -------------------------------------------- */

TALENT_HOOKS.conserveeffort00 = {
  endTurn(actor, {resourceRecovery, statusText}) {
    if ( this.resources.action.value ) {
      resourceRecovery.focus = (resourceRecovery.focus || 0) + 1;
      statusText.push({text: "Conserve Effort", fillColor: SYSTEM.RESOURCES.focus.color.css});
    }
  }
}

/* -------------------------------------------- */

TALENT_HOOKS.irrepressiblespi = {
  startTurn(actor, {resourceRecovery}) {
    if ( !this.system.isBroken ) resourceRecovery.morale = (resourceRecovery.morale || 0) + 1;
  }
}

/* -------------------------------------------- */

TALENT_HOOKS.lesserregenerati = {
  startTurn(actor, {resourceRecovery}) {
    if ( !this.system.isWeakened ) resourceRecovery.health = (resourceRecovery.health || 0) + 1;
  }
}

/* -------------------------------------------- */

TALENT_HOOKS.powerfulThrow000 = {
  prepareAction(actor, action) {
    if ( action.tags.has("thrown") ) {
      action.range.maximum *= 2;
    }
  }
};

/* -------------------------------------------- */

export default TALENT_HOOKS;

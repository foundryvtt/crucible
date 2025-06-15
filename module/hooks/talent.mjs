const HOOKS = {};

/* -------------------------------------------- */

HOOKS.armoredShell0000 = {
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

HOOKS.bard000000000000 = {
  prepareSpellAttack(item, spell, _target, rollData) {
    if ( spell.rune.id === "spirit" ) rollData.boons.bard = {label: item.name, number: 2};
  }
}

/* -------------------------------------------- */

HOOKS.bloodmagic000000 = {
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

HOOKS.conserveeffort00 = {
  endTurn(item, {resourceRecovery, statusText}) {
    if ( this.resources.action.value ) {
      resourceRecovery.focus = (resourceRecovery.focus || 0) + 1;
      statusText.push({text: "Conserve Effort", fillColor: SYSTEM.RESOURCES.focus.color.css});
    }
  }
}

/* -------------------------------------------- */

HOOKS.irrepressiblespi = {
  startTurn(item, {resourceRecovery}) {
    if ( !this.system.isBroken ) resourceRecovery.morale = (resourceRecovery.morale || 0) + 1;
  }
}

/* -------------------------------------------- */

HOOKS.healer0000000000 = {
  prepareSpellAttack(item, spell, _target, rollData) {
    if ( spell.rune.id === "life" ) rollData.boons.healer = {label: item.name, number: 2};
  }
}

/* -------------------------------------------- */

HOOKS.lesserregenerati = {
  startTurn(item, {resourceRecovery}) {
    if ( !this.system.isWeakened ) resourceRecovery.health = (resourceRecovery.health || 0) + 1;
  }
}

/* -------------------------------------------- */

HOOKS.preparedness0000 = {
  preActivateAction(item, action, _targets) {
    if ( action.id !== "equipWeapon" ) return;
    if ( action.cost.action && !this.system.status.hasMoved ) {
      action.cost.action = 0;
      action.usage.actorStatus.hasMoved = true;
    }
  }
}


/* -------------------------------------------- */

HOOKS.powerfulThrow000 = {
  prepareAction(item, action) {
    if ( action.tags.has("thrown") ) {
      action.range.maximum *= 2;
    }
  }
};

/* -------------------------------------------- */

HOOKS.spellmute0000000 = {
  defendSpellAttack(item, spell, origin, rollData) {
    rollData.banes.spellmute = {label: item.name, number: 2};
  },
  prepareActions(item, actions) {
    for ( const [id, action] of Object.entries(actions) ) {
      if ( action.tags.has("spell") ) delete actions[id];
    }
    delete actions.cast;
  }
}

/* -------------------------------------------- */

export default HOOKS;

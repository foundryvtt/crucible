const HOOKS = {};

/* -------------------------------------------- */

HOOKS.arcanearcher0000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("spell") ) return;
    const mh = this.equipment.weapons.mainhand;
    if ( !["projectile1", "projectile2"].includes(mh.category) ) return;

    // Ignore hands for Gesture: Arrow
    if ( action.gesture.id === "arrow" ) {
      action.cost.hands = 0;
      action.range.weapon = true;
      action.range.maximum = mh.system.range;
    }

    // Reduce cost of spell following strike
    const lastAction = this.lastConfirmedAction;
    if ( lastAction?.tags.has("strike") ) action.cost.action -= 1;
  }
}

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

HOOKS.bloodSense000000 = {
  prepareWeaponAttack(_item, _action, target, rollData) {
    if ( target.resources.health.value < target.resources.health.max ) delete rollData.banes.blind;
  },
  prepareSkillAttack(_item, _action, target, rollData) {
    if ( target.resources.health.value < target.resources.health.max ) delete rollData.banes.blind;
  }
}

/* -------------------------------------------- */

HOOKS.coldAbsorption00 = {
  prepareResistances(_item, resistances) {
    resistances.cold.base *= 2;
  },
  receiveAttack(_item, _action, roll) {
    const dmg = roll.data.damage;
    if ( (dmg.type !== "cold") || dmg.restoration || (dmg.total > 0) ) return;
    const unmitigatedTotal = crucible.api.models.CrucibleAction.computeDamage({...dmg, resistance: 0});
    dmg.restoration = true;
    dmg.total = dmg.resistance - unmitigatedTotal;
  }
}

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

HOOKS.spellblade000000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("spell") ) return;
    const mh = this.equipment.weapons.mainhand;
    if ( mh.config.category.ranged ) return;

    // Add weapon damage bonus to Strike gesture
    if ( action.gesture.id === "strike" ) {
      action.damage.bonus = (action.damage.bonus ?? 0) + mh.system.damage.bonus;
    }

    // Reduce cost of spell following strike
    const lastAction = this.lastConfirmedAction;
    if ( lastAction?.tags.has("strike") ) action.cost.action -= 1;
  }
}

/* -------------------------------------------- */

HOOKS.spellmute0000000 = {
  defendSpellAttack(item, spell, origin, rollData) {
    rollData.banes.spellmute = {label: item.name, number: 2};
  },
  prepareActions(actions) {
    for ( const [id, action] of Object.entries(actions) ) {
      if ( action.tags.has("spell") ) delete actions[id];
    }
    delete actions.cast;
  }
}

/* -------------------------------------------- */

HOOKS.stronggrip000000 = {
  prepareActions(_actions) {
    const weapons = this.equipment.weapons;
    if ( weapons.twoHanded ) {
      weapons.freeHands += 1;
      weapons.spellHands += 1;
    }
  }
}

/* -------------------------------------------- */

HOOKS.evasiveshot00000 = {
  prepareWeaponAttack(item, action, _target, _rollData) {
    const isRanged = action.usage.strikes.some(w => w.system.config.category.ranged);
    if ( isRanged ) {
      const movementBonus = (this.system.status.movement?.bonus ?? 0) + Math.ceil(this.system.movement.stride / 2);
      foundry.utils.setProperty(action.usage.actorStatus, "movement.bonus", movementBonus);
    }
  }
}

/* -------------------------------------------- */

export default HOOKS;

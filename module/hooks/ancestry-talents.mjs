const ACTION = {};
const TALENT = {};

/**
 * Identify the active effect created by the Heroism action of an ancestry lineage talent.
 * @param {CrucibleItem} item   The lineage talent
 * @returns {string}            The ID of the effect created by the talent's action
 */
function lineageEffectId(item) {
  return SYSTEM.EFFECTS.getEffectId(item.actions[0].id);
}

/* -------------------------------------------- */
/*  Devilkin Lineage                            */
/* -------------------------------------------- */

TALENT.devilkinLineage0 = {
  async rollAction(item, action, target) {
    if ( (target === this) || !this.effects.has(lineageEffectId(item)) ) return;
    const fire = Math.ceil(this.abilities.presence.value / 2);
    const amount = Math.clamp(fire - target.getResistance("health", "fire"), 0, fire * 2);
    if ( !amount ) return;
    const struck = action.events.filter(e => (e.target === target) && e.roll?.hasDamage && e.damagesHealth);
    for ( const event of struck ) {
      action.recordEvent({target, resources: [{resource: "health", delta: -amount, damageType: "fire"}]},
        {index: action.events.indexOf(event) + 1});
    }
  },
  applyCriticalEffects(item, action) {
    if ( !this.effects.has(lineageEffectId(item)) ) return;
    for ( const event of action.events ) {
      if ( (event.target === this) || !event.isCriticalSuccess || !event.damagesHealth ) continue;
      event.effects.push(SYSTEM.EFFECTS.burning(this, {ability: "presence"}));
    }
  },
  prepareToken(_item, token) {
    crucible.api.hooks.talent.thermalVision000._applyThermalVision(token, 30);
  }
};

/* -------------------------------------------- */
/*  Dwarf Lineage                               */
/* -------------------------------------------- */

ACTION.grudgebearer = {
  postActivate() {
    const [target] = this.targets.keys();
    const {effect} = this.selfEvents?.getPrimaryEffect() ?? {};
    if ( !target || !effect ) return;
    effect.origin = target.uuid;
    effect.name = _loc("ACTIONS.Grudgebearer.Grudge", {target: target.name});
  }
};

TALENT.dwarfLineage0000 = {
  prepareAttack(item, _action, target, rollData) {
    const grudge = this.effects.get(lineageEffectId(item));
    if ( grudge?.origin === target.uuid ) rollData.damageBonus += this.abilities.wisdom.value;
  },
  finalizeAction(item, action) {
    if ( this.status.grudgebearer ) return;
    const grudge = this.effects.get(lineageEffectId(item));
    const AttackRoll = crucible.api.dice.AttackRoll;
    const attacked = action.events.some(e => (e.roll instanceof AttackRoll) && (e.target?.uuid === grudge?.origin));
    if ( !grudge || !attacked ) return;
    action.recordEvent({target: this, actorUpdates: {system: {status: {grudgebearer: true}}}});
  },
  endTurn(item, {effectChanges}) {
    const id = lineageEffectId(item);
    if ( this.effects.has(id) && !this.status.grudgebearer ) effectChanges.toDelete.push(id);
  },
  prepareToken(_item, token) {
    crucible.api.hooks.talent.darkvision000000._applyDarkvision(token, 30);
  }
};

/* -------------------------------------------- */
/*  Elf Lineage                                 */
/* -------------------------------------------- */

TALENT.elfLineage000000 = {
  prepareAbilities() {
    this.statuses.delete("asleep"); // Removed before resource preparation, where Asleep incapacitates
    this.statuses.delete("disoriented");
  },
  prepareAttack(item, _action, _target, rollData) {
    if ( !this.effects.has(lineageEffectId(item)) ) return;
    rollData.criticalSuccessThreshold = (rollData.criticalSuccessThreshold ?? 6) - 3;
  }
};

/* -------------------------------------------- */
/*  Giantkin Lineage                            */
/* -------------------------------------------- */

TALENT.giantkinLineage0 = {
  prepareMovement() {
    if ( this.system.capacity ) this.system.capacity.bonus += this.abilities.strength.value * 15;
  },
  prepareResistances(item, resistances) {
    if ( !this.effects.has(lineageEffectId(item)) ) return;
    const wisdom = this.abilities.wisdom.value;
    for ( const [id, dt] of Object.entries(SYSTEM.DAMAGE_TYPES) ) {
      if ( dt.type === "elemental" ) resistances[id].bonus += wisdom;
    }
  },
  prepareAttack(item, _action, _target, rollData) {
    if ( !this.effects.has(lineageEffectId(item)) || rollData.restoration ) return;
    if ( SYSTEM.DAMAGE_TYPES[rollData.damageType]?.type !== "elemental" ) return;
    rollData.damageBonus += this.abilities.wisdom.value;
  }
};

/* -------------------------------------------- */
/*  Gnome Lineage                               */
/* -------------------------------------------- */

TALENT.gnomeLineage0000 = {
  configureEquipment(_item, equipment) {
    equipment.toolbeltSlots += 1;
  },
  prepareAction(item, action) {
    if ( !action.tags.has("consume") ) return;
    if ( this.effects.has(lineageEffectId(item)) ) {
      action.cost.action = 0;
      action.usage.consumeUses = 0;
    }
    else delete action.usage.consumeUses;
  },
  finalizeAction(item, action) {
    const id = lineageEffectId(item);
    if ( !action.tags.has("consume") || !this.effects.has(id) ) return;
    action.recordEvent({type: "effect", target: this, effects: [{_id: id, _action: "delete"}]});
  }
};

/* -------------------------------------------- */
/*  Halfling Lineage                            */
/* -------------------------------------------- */

ACTION.stoutHeart = {
  prepare() {
    this.usage.hasDice = false;
  },
  postActivate() {
    const activation = this.selfEvents?.activation;
    if ( !activation ) return;
    activation.resources.push({resource: "morale", delta: this.actor.abilities.presence.value * 2});
    for ( const effect of this.actor.effects ) {
      if ( effect.statuses.has("frightened") || effect.statuses.has("confused") ) {
        activation.effects.push({_id: effect.id, _action: "delete"});
      }
    }
  }
};

TALENT.halflingLineage0 = {
  _NIMBLE_ACTIONS: new Set(["escape", "hide", "sneak"]),
  prepareAction(item, action) {
    if ( TALENT.halflingLineage0._NIMBLE_ACTIONS.has(action.id) ) {
      action.usage.boons[item.id] = {label: item.name, number: 1};
    }
  }
};

/* -------------------------------------------- */
/*  Human Lineage                               */
/* -------------------------------------------- */

TALENT.humanLineage0000 = {
  _ignoreBanes(actor, item, rollData) {
    if ( !actor.effects.has(lineageEffectId(item)) ) return;
    for ( const id of Object.keys(rollData.banes) ) {
      if ( id !== "special" ) delete rollData.banes[id]; // Self-imposed banes are not ignored
    }
  },
  finalizeAttack(item, _action, _target, rollData) {
    TALENT.humanLineage0000._ignoreBanes(this, item, rollData);
  },
  prepareSkillCheck(item, _skill, rollData) {
    TALENT.humanLineage0000._ignoreBanes(this, item, rollData);
  },
  prepareTraining() {
    if ( this.system.points ) this.system.points.proficiency.bonus += 2;
  }
};

/* -------------------------------------------- */
/*  Orc Lineage                                 */
/* -------------------------------------------- */

ACTION.deathlessFury = {
  canUse() {
    const {health, wounds} = this.actor.resources;
    if ( health.value > wounds.value ) throw new Error(_loc("ACTIONS.DeathlessFury.CannotUse", {name: this.actor.name}));
  }
};

TALENT.orcLineage000000 = {
  _expireFury(actor, item, effectChanges) {
    const {health, wounds} = actor.resources;
    const id = lineageEffectId(item);
    if ( actor.effects.has(id) && (health.value > wounds.value) ) effectChanges.toDelete.push(id);
  },
  _isFurious(actor, item, resources=actor.resources) {
    return actor.effects.has(lineageEffectId(item)) && (resources.health.value <= resources.wounds.value);
  },
  prepareResources(item, resources) {
    if ( this.system.isWeakened && TALENT.orcLineage000000._isFurious(this, item, resources) ) {
      resources.action.bonus += 2;
    }
  },
  prepareMovement(item, movement) {
    if ( TALENT.orcLineage000000._isFurious(this, item) ) movement.freeMoveBlockers.weakened = "";
  },
  prepareAttack(item, action, _target, rollData) {
    if ( !action.tags.has("strike") || !TALENT.orcLineage000000._isFurious(this, item) ) return;
    rollData.boons[item.id] = {label: item.name, number: 1};
  },
  prepareResistances(_item, resistances) {
    const {wounds} = this.resources;
    if ( !wounds.max ) return;
    const bonus = Math.floor(this.abilities.toughness.value * wounds.value / wounds.max);
    if ( !bonus ) return;
    for ( const [id, dt] of Object.entries(SYSTEM.DAMAGE_TYPES) ) {
      if ( dt.type === "physical" ) resistances[id].bonus += bonus;
    }
  },
  startTurn(item, {effectChanges}) {
    TALENT.orcLineage000000._expireFury(this, item, effectChanges);
  },
  endTurn(item, {effectChanges}) {
    TALENT.orcLineage000000._expireFury(this, item, effectChanges);
  }
};

/* -------------------------------------------- */

export default {action: ACTION, talent: TALENT};

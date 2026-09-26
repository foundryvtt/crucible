const ACTION = {};
const TALENT = {};

/* -------------------------------------------- */
/*  Deathless Fury (Orcish)                     */
/* -------------------------------------------- */

ACTION.deathlessFury = {
  canUse() {
    const {health, wounds} = this.actor.resources;
    if ( health.value > wounds.value ) throw new Error(_loc("ACTIONS.DeathlessFury.CannotUse", {name: this.actor.name}));
  }
};

TALENT.deathlessFury000 = {
  _expireFury(actor, item, effectChanges) {
    const {health, wounds} = actor.resources;
    if ( actor.effects.has(item.id) && (health.value > wounds.value) ) effectChanges.toDelete.push(item.id);
  },
  _isFurious(actor, item, resources=actor.resources) {
    return actor.effects.has(item.id) && (resources.health.value <= resources.wounds.value);
  },
  prepareResources(item, resources) {
    if ( this.system.isWeakened && TALENT.deathlessFury000._isFurious(this, item, resources) ) {
      resources.action.bonus += 2;
    }
  },
  prepareMovement(item, movement) {
    if ( TALENT.deathlessFury000._isFurious(this, item) ) movement.freeMoveBlockers.weakened = "";
  },
  prepareAttack(item, action, _target, rollData) {
    if ( !action.tags.has("strike") || !TALENT.deathlessFury000._isFurious(this, item) ) return;
    rollData.boons[item.id] = {label: item.name, number: 1};
  },
  startTurn(item, {effectChanges}) {
    TALENT.deathlessFury000._expireFury(this, item, effectChanges);
  },
  endTurn(item, {effectChanges}) {
    TALENT.deathlessFury000._expireFury(this, item, effectChanges);
  }
};

/* -------------------------------------------- */
/*  Elemental Birthright (Giantkin)             */
/* -------------------------------------------- */

TALENT.elementalBirthri = {
  prepareResistances(item, resistances) {
    if ( !this.effects.has(item.id) ) return;
    const wisdom = this.abilities.wisdom.value;
    for ( const [id, dt] of Object.entries(SYSTEM.DAMAGE_TYPES) ) {
      if ( dt.type === "elemental" ) resistances[id].bonus += wisdom;
    }
  },
  prepareAttack(item, _action, _target, rollData) {
    if ( !this.effects.has(item.id) || rollData.restoration ) return;
    if ( SYSTEM.DAMAGE_TYPES[rollData.damageType]?.type !== "elemental" ) return;
    rollData.damageBonus += this.abilities.wisdom.value;
  }
};

/* -------------------------------------------- */
/*  Grudgebearer (Dwarven)                      */
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

TALENT.grudgebearer0000 = {
  prepareAttack(item, _action, target, rollData) {
    const grudge = this.effects.get(item.id);
    if ( grudge?.origin === target.uuid ) rollData.damageBonus += this.abilities.wisdom.value;
  },
  finalizeAction(item, action) {
    if ( this.status.grudgebearer ) return;
    const grudge = this.effects.get(item.id);
    const AttackRoll = crucible.api.dice.AttackRoll;
    const attacked = action.events.some(e => (e.roll instanceof AttackRoll) && (e.target?.uuid === grudge?.origin));
    if ( !grudge || !attacked ) return;
    action.recordEvent({target: this, actorUpdates: {system: {status: {grudgebearer: true}}}});
  },
  endTurn(item, {effectChanges}) {
    if ( this.effects.has(item.id) && !this.status.grudgebearer ) effectChanges.toDelete.push(item.id);
  }
};

/* -------------------------------------------- */
/*  Hellbrand (Devilkin)                        */
/* -------------------------------------------- */

TALENT.hellbrand0000000 = {
  async rollAction(item, action, target) {
    if ( (target === this) || !this.effects.has(item.id) ) return;
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
    if ( !this.effects.has(item.id) ) return;
    for ( const event of action.events ) {
      if ( (event.target === this) || !event.isCriticalSuccess || !event.damagesHealth ) continue;
      event.effects.push(SYSTEM.EFFECTS.burning(this, {ability: "presence"}));
    }
  }
};

/* -------------------------------------------- */
/*  Perfect Precision (Elvish)                  */
/* -------------------------------------------- */

TALENT.perfectPrecision = {
  prepareAttack(item, _action, _target, rollData) {
    if ( !this.effects.has(item.id) ) return;
    rollData.criticalSuccessThreshold = (rollData.criticalSuccessThreshold ?? 6) - 3;
  }
};

/* -------------------------------------------- */
/*  Push Through (Human)                        */
/* -------------------------------------------- */

TALENT.pushThrough00000 = {
  _ignoreBanes(actor, item, rollData) {
    if ( !actor.effects.has(item.id) ) return;
    for ( const id of Object.keys(rollData.banes) ) {
      if ( id !== "special" ) delete rollData.banes[id]; // Self-imposed banes are not ignored
    }
  },
  finalizeAttack(item, _action, _target, rollData) {
    TALENT.pushThrough00000._ignoreBanes(this, item, rollData);
  },
  prepareSkillCheck(item, _skill, rollData) {
    TALENT.pushThrough00000._ignoreBanes(this, item, rollData);
  }
};

/* -------------------------------------------- */
/*  Stout Heart (Halfling)                      */
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

/* -------------------------------------------- */
/*  Tinker's Trick (Gnome)                      */
/* -------------------------------------------- */

TALENT.tinkersTrick0000 = {
  prepareAction(item, action) {
    if ( !action.tags.has("consume") ) return;
    if ( this.effects.has(item.id) ) {
      action.cost.action = 0;
      action.usage.consumeUses = 0;
    }
    else delete action.usage.consumeUses;
  },
  finalizeAction(item, action) {
    if ( !action.tags.has("consume") || !this.effects.has(item.id) ) return;
    action.recordEvent({type: "effect", target: this, effects: [{_id: item.id, _action: "delete"}]});
  }
};

/* -------------------------------------------- */

export default {action: ACTION, talent: TALENT};

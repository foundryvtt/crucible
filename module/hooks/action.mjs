const HOOKS = {};

/* -------------------------------------------- */

HOOKS.alchemistsFire = {
  preActivate() {
    const tiers = {
      shoddy: {turns: 2, amount: 2},
      standard: {turns: 3, amount: 3},
      fine: {turns: 4, amount: 4},
      superior: {turns: 5, amount: 6},
      masterwork: {turns: 6, amount: 8}
    };
    const burning = SYSTEM.EFFECTS.burning(this.actor, tiers[this.item.system.quality]);
    foundry.utils.mergeObject(this.effects[0], burning);
  }
};

/* -------------------------------------------- */

HOOKS.antitoxin = {
  postActivate() {
    const tiers = {shoddy: 3, standard: 5, fine: 7, superior: 9, masterwork: 11};
    const neutralizeAmount = tiers[this.item.system.quality];
    for ( const target of this.targets.keys() ) {
      const effects = [];
      for ( const effect of target.effects ) {
        if ( !effect.statuses.has("poisoned") || !effect.system.dot?.length ) continue;
        const poisonAmount = effect.system.dot.reduce((acc, {amount, damageType}) => {
          return acc + ((damageType === "poison") ? amount : 0);
        }, 0);
        if ( poisonAmount <= neutralizeAmount ) effects.push({_id: effect.id, _action: "delete"});
      }
      if ( effects.length ) this.recordEvent({type: "effect", target, effects});
    }
  }
};

/* -------------------------------------------- */

HOOKS.armorCrusher = {
  async roll(target) {
    const RESULTS = game.system.api.dice.AttackRoll.RESULT_TYPES;
    if ( this.actor.system.resources.focus.value <= 0 ) return;
    const events = this.eventsByActor.get(target);
    if ( !events ) return;
    for ( const event of events.roll ) {
      if ( event.roll?.data?.result !== RESULTS.GLANCE ) continue;
      const dmg = event.roll.data.damage;
      if ( !dmg ) continue;
      dmg.bonus += this.actor.system.abilities.toughness.value;
      dmg.total = crucible.api.models.CrucibleAction.computeDamage(dmg);
      event.resources.push({resource: "focus", delta: -1});
      return;
    }
  }
};

/* -------------------------------------------- */

HOOKS.assessStrength = {
  configure() {
    const target = this.targets.values().next().value?.actor;
    if ( !target ) return;
    const targetCategory = SYSTEM.ACTOR.CREATURE_CATEGORIES[target.system.details.taxonomy?.category];
    if ( !targetCategory ) return;
    const {skill, knowledge} = targetCategory;
    SYSTEM.ACTION.TAGS[skill]?.initialize.call(this);
    this.usage.dc = SYSTEM.PASSIVE_BASE + target.level;
    if ( this.actor.hasKnowledge(knowledge) ) {
      const knowledgeLabel = crucible.CONFIG.knowledge[knowledge].label;
      this.usage.boons.assessStrength = {label: _loc("ACTOR.KnowledgeSpecific", {knowledge: knowledgeLabel}), number: 2};
    }
  },
  async roll(target) {
    const skill = this.usage.skillId;
    if ( !skill ) return;
    await SYSTEM.ACTION.TAGS[skill]?.roll.call(this, target);
  }
};

/* -------------------------------------------- */

// TODO: Consider refactoring this talent to instead be a maintained action
HOOKS.beastShapeRevert = {
  async confirm(reverse) {
    const effect = this.actor.effects.get(SYSTEM.EFFECTS.getEffectId("beastShape"));
    await effect.delete();
  }
};

/* -------------------------------------------- */

HOOKS.berserkStrike = {
  prepare() {
    const health = this.actor.resources.health;
    const pct = health.value / health.max;
    let damageBonus = 0;
    if ( pct < 0.25 ) damageBonus = 3;
    else if ( pct < 0.5 ) damageBonus = 2;
    else if ( pct < 0.75 ) damageBonus = 1;
    const weapon = this.usage.strikes[0];
    if ( weapon.config.category.hands === 2 ) damageBonus *= 2;
    if ( damageBonus ) {
      this.usage.bonuses.damageBonus ||= 0;
      this.usage.bonuses.damageBonus += damageBonus;
    }
  }
};

/* -------------------------------------------- */

HOOKS.bindArmament = {
  canUse() {
    const boundArmamentId = this.actor.getFlag("crucible", this.id);
    const mainhandId = this.actor.equipment.weapons.mainhand.id;
    if ( !mainhandId ) throw new Error(_loc("SPELL.WARNINGS.BindArmamentNoMainhand"));
    else if ( mainhandId === boundArmamentId ) throw new Error(_loc("SPELL.WARNINGS.BindArmamentAlreadyBound"));
  },
  preActivate() {
    const mainhandId = this.actor.equipment.weapons.mainhand.id;
    if ( !mainhandId ) return;
    foundry.utils.mergeObject(this.selfUpdateEvent.actorUpdates, {
      [`flags.crucible.${this.id}`]: mainhandId
    });
  }
};

/* -------------------------------------------- */

HOOKS.blastFlask = {
  prepare() {
    this.target.size = {shoddy: 3, standard: 4, fine: 6, superior: 8, masterwork: 10}[this.item.system.quality];
  }
};

/* -------------------------------------------- */

HOOKS.bodyBlock = {
  canUse() {
    const targetAction = ChatMessage.implementation.getLastAction();
    const myEvents = targetAction.eventsByActor.get(this.actor);
    if ( !myEvents ) return;
    if ( !targetAction.tags.has("melee") ) {
      throw new Error(_loc("ACTION.WARNINGS.SPECIFIC.BODY_BLOCK.MeleeOnly"));
    }
    if ( targetAction.message.flags.crucible.confirmed ) {
      throw new Error(_loc("ACTION.WARNINGS.SPECIFIC.BODY_BLOCK.AlreadyConfirmed"));
    }
    const results = game.system.api.dice.AttackRoll.RESULT_TYPES;
    for ( const event of myEvents.roll ) {
      if ( [results.ARMOR, results.GLANCE].includes(event.roll.data.result) ) {
        this.usage.targetAction = targetAction.message.id;
        return true;
      }
    }
    throw new Error(_loc("ACTION.WARNINGS.SPECIFIC.BODY_BLOCK.InvalidOutcome"));
  }
};

/* -------------------------------------------- */

HOOKS.causticPhial = {
  prepare() {
    const tiers = {
      shoddy: {turns: 2, amount: 2},
      standard: {turns: 3, amount: 3},
      fine: {turns: 4, amount: 4},
      superior: {turns: 5, amount: 6},
      masterwork: {turns: 6, amount: 8}
    };
    const corroding = SYSTEM.EFFECTS.corroding(this.actor, tiers[this.item.system.quality]);
    foundry.utils.mergeObject(this.effects[0], corroding);
  }
};

/* -------------------------------------------- */

HOOKS.chokingAmpoule = {
  preActivate() {
    const damage = {shoddy: 2, standard: 6, fine: 12, superior: 20, masterwork: 30};
    const poisoned = SYSTEM.EFFECTS.poisoned(this.actor, {turns: 3, amount: damage[this.item.system.quality]});
    poisoned.system.dot[0].resource = "morale";
    foundry.utils.mergeObject(this.effects[0], poisoned);
  },
  postActivate() {
    for ( const [target, events] of this.eventsByTarget ) {
      const critEvent = events.roll.find(e => e.roll.isCriticalSuccess);
      if ( critEvent?.effects.length ) critEvent.effects[0].statuses.push("silenced");
    }
  }
};

/* -------------------------------------------- */

HOOKS.clarifyIntent = {
  postActivate() {
    for ( const [target, events] of this.eventsByTarget ) {
      const rollEvent = events.roll[0];
      if ( !rollEvent ) continue;
      if ( rollEvent.roll.isSuccess ) {
        rollEvent.roll.data.damage.multiplier = 0;
        rollEvent.roll.data.damage.base = rollEvent.roll.data.damage.total = 1;
        rollEvent.roll.data.damage.resource = "focus";
      }
      const effect = rollEvent.effects[0];
      if ( !effect ) continue;
      effect.system.changes ||= [];
      effect.system.changes.push(
        {key: "system.rollBonuses.boons.clarifyIntent.number", type: "override", value: 1},
        {key: "system.rollBonuses.boons.clarifyIntent.label", type: "override", value: this.name}
      );
    }
  }
};

/* -------------------------------------------- */

HOOKS.conjureArmament = {
  canUse() {
    const boundArmamentId = this.actor.getFlag("crucible", this.id);
    const weapon = this.items.get(boundArmamentId);
    if ( !weapon || weapon.equipped ) return false;
    this.canEquipWeapon(weapon);
  }
};

/* -------------------------------------------- */

HOOKS.counterspell = {
  initialize() {
    Object.assign(this.usage.context, {
      label: _loc("SPELL.COUNTERSPELL.Tags"),
      icon: "fa-solid fa-sparkles",
      tags: {}
    });
    if ( this.composition === 0 ) return;
    const none = _loc("None");
    this.usage.context.tags.rune = _loc("SPELL.COMPONENTS.RuneSpecific", {rune: this.rune?.name ?? none});
    this.usage.context.tags.gesture = _loc("SPELL.COMPONENTS.GestureSpecific", {gesture: this.gesture?.name ?? none});
  },
  async roll(target) {
    if ( this.usage.targetAction.message ) return;
    const dc = this.usage.dc;
    const rollData = {
      actorId: this.actor.id,
      banes: {...this.actor.system.rollBonuses.banes, ...this.usage.banes},
      boons: {...this.actor.system.rollBonuses.boons, ...this.usage.boons},
      dc,
      ability: this.usage.bonuses.ability,
      skill: this.usage.bonuses.skill,
      enchantment: this.usage.bonuses.enchantment
    };
    this.actor.callActorHooks("prepareStandardCheck", rollData);
    const roll = await new crucible.api.dice.StandardCheck(rollData).evaluate();
    if ( roll ) this.recordEvent({type: "check", target, roll});
  },
  async confirm(reverse) {
    const targetEvents = [...this.eventsByActor].find(([actor]) => actor !== this.actor)?.[1];
    if ( !targetEvents ) return;
    const isSuccess = targetEvents.roll[0]?.roll.isSuccess;
    if ( !isSuccess ) return;
    // TODO: Fetch this ID from action instead of message flag
    const targetMessage = game.messages.get(this.message?.getFlag("crucible", "targetMessageId"));
    if ( !targetMessage ) return;
    if ( targetMessage.getFlag("crucible", "confirmed") !== reverse ) {
      const desiredChange = _loc(`DICE.${reverse ? "Reverse" : "Confirm"}`);
      const problemState = _loc(`ACTION.${reverse ? "Unconfirmed" : "Confirmed"}`);
      const errorText = _loc("SPELL.COUNTERSPELL.WARNINGS.CannotConfirm", {change: desiredChange, state: problemState});
      ui.notifications.warn(errorText);
      throw new Error(errorText);
    }
    const setNegated = () => targetMessage.setFlag("crucible", "isNegated", !reverse);
    if ( !reverse ) await setNegated();
    await crucible.api.models.CrucibleAction.confirmMessage(targetMessage, {reverse});
    if ( reverse ) await setNegated();
  }
};

/* -------------------------------------------- */

HOOKS.decisiveAction = {
  postActivate() {
    const amount = Math.ceil(this.actor.abilities.intellect.value / 2);
    const activation = this.events.find(e => e.type === "activation");
    if ( activation ) activation.resources.push({resource: "action", delta: amount});
  }
};

/* -------------------------------------------- */

HOOKS.delay = {
  canUse() {
    if ( game.combat?.combatant?.actor !== this.actor ) {
      throw new Error(_loc("ACTION.WARNINGS.SPECIFIC.DELAY.WrongTurn"));
    }
    if ( this.actor.flags.crucible?.delay ) {
      throw new Error(_loc("ACTION.WARNINGS.SPECIFIC.DELAY.AlreadyDelayed"));
    }
  },
  // TODO refactor to roll()?
  async preActivate() {
    const combatant = game.combat.getCombatantByActor(this.actor);
    const maximum = combatant.getDelayMaximum();
    const response = await foundry.applications.api.DialogV2.prompt({
      window: { title: "ACTION.DelayTitle" },
      content: `<form class="delay-turn" autocomplete="off">
            <div class="form-group">
                <label>${_loc("ACTION.DelayLabel")}</label>
                <input name="initiative" type="number" min="1" value="${maximum - 1}" max="${maximum}" step="1">
                <p class="hint">${_loc("ACTION.DelayHint", {maximum})}</p>
            </div>
        </form>`,
      ok: {
        label: this.name,
        callback: (event, button, dialog) => button.form.elements.initiative.valueAsNumber
      },
      rejectClose: false
    });
    if ( response ) this.metadata.initiativeDelay = response;
  },
  async confirm() {
    const initiative = this.metadata.initiativeDelay;
    if ( !Number.isInteger(initiative) ) throw new Error("Delay action requires an integer initiativeDelay value");
    return this.actor.delay(initiative);
  }
};

/* -------------------------------------------- */

HOOKS.distract = {
  postActivate() {
    for ( const event of this.events ) {
      if ( !event.roll?.isSuccess || !event.roll.data.damage ) continue;
      event.roll.data.damage.multiplier = 0;
      event.roll.data.damage.base = event.roll.data.damage.total = 1;
      event.roll.data.damage.resource = "focus";
    }
  }
};

/* -------------------------------------------- */

HOOKS.feintingStrike = {
  async roll(target) {
    const targetEvents = this.eventsByActor.get(target);
    if ( !targetEvents ) return;
    const [feintEvent, deceptionEvent] = targetEvents.roll;
    if ( !(feintEvent && deceptionEvent ) ) return;
    const feintIndex = this.events.indexOf(feintEvent);
    const deceptionIndex = this.events.indexOf(deceptionEvent);

    // Remove the deception roll's damage
    const deception = deceptionEvent?.roll;
    if ( deception?.data.damage ) deception.data.damage.total = 0;

    // Follow-up offhand attack with bonuses if deception succeeded
    const options = {defenseType: "physical"};
    if ( deception?.isSuccess ) {
      options.boons = {feintingStrike: {label: this.name, number: 2}};
      options.damageBonus = 6;
    }
    const offhand = this.actor.equipment.weapons.offhand;
    const roll = await this.actor.weaponAttack(this, offhand, target, options);
    const weapon = offhand.snapshot();
    const strike = this.recordEvent({type: "strike", target, roll, weapon}, {temporary: true});

    // Reorder event stream chronology so that the offhand strike immediately follows the deception event
    this.events[feintIndex] = deceptionEvent;
    this.events[deceptionIndex] = strike;
    this._eventsDirty = true;
  }
};

/* -------------------------------------------- */

HOOKS.fontOfLife = {
  postActivate() {
    const amount = this.actor.abilities.wisdom.value;
    for ( const [target, events] of this.eventsByTarget ) {
      const effectEvent = events.all.find(e => e.effects.length);
      if ( !effectEvent ) continue;
      effectEvent.effects[0].system.dot = [{amount, resource: "health", restoration: true}];
      effectEvent.resources.push({resource: "health", delta: amount});
    }
  }
};

/* -------------------------------------------- */

HOOKS.healingElixir = {
  postActivate() {
    const quality = this.usage.consumable.config.quality;
    let amount = 6;
    for ( let i = 1; i <= (quality.bonus + 1); i++ ) amount *= 2;
    for ( const target of this.targets ) {
      this.recordEvent({target, resources: [{resource: "health", delta: amount}]});
    }
  }
};

/* -------------------------------------------- */

HOOKS.healingTonic = {
  postActivate() {
    const quality = this.usage.consumable.config.quality;
    let amount = 2;
    for ( let i = 1; i <= (quality.bonus + 1); i++ ) amount *= 2;
    for ( const [target, events] of this.eventsByTarget ) {
      const effectEvent = events.all.find(e => e.effects.length);
      if ( !effectEvent ) continue;
      effectEvent.effects[0]._id = SYSTEM.EFFECTS.getEffectId(this.id);
      effectEvent.effects[0].system.dot = [{amount, resource: "health", restoration: true}];
      effectEvent.resources.push({resource: "health", delta: amount});
    }
  }
};

/* -------------------------------------------- */

HOOKS.inspireHeroism = {
  preActivate() {
    const effect = this.effects[0];
    effect.system.changes ||= [];
    effect.system.changes.push(
      {key: "system.rollBonuses.boons.inspireHeroism.number", type: "override", value: 1},
      {key: "system.rollBonuses.boons.inspireHeroism.label", type: "override", value: this.name}
    );
  }
};

/* -------------------------------------------- */

HOOKS.intuitWeakness = {
  configure() {
    const target = this.targets.values().next().value?.actor;
    if ( !target ) return;
    const targetCategory = SYSTEM.ACTOR.CREATURE_CATEGORIES[target.system.details.taxonomy?.category];
    if ( !targetCategory ) return;
    const {skill, knowledge} = targetCategory;
    SYSTEM.ACTION.TAGS[skill]?.initialize.call(this);
    this.usage.dc = SYSTEM.PASSIVE_BASE + target.level;
    if ( this.actor.hasKnowledge(knowledge) ) {
      const knowledgeLabel = crucible.CONFIG.knowledge[knowledge].label;
      this.usage.boons.intuitWeakness = {label: _loc("ACTOR.KnowledgeSpecific", {knowledge: knowledgeLabel}), number: 2};
    }
  },
  async roll(target) {
    const skill = this.usage.skillId;
    if ( !skill ) return;
    await SYSTEM.ACTION.TAGS[skill]?.roll.call(this, target);
  }
};

/* -------------------------------------------- */

HOOKS.laughingMatter = {
  postActivate() {
    for ( const [target, events] of this.eventsByTarget ) {
      const effectEvent = events.all.find(e => e.effects.length);
      if ( !effectEvent ) continue;
      effectEvent.effects[0].system.changes ||= [];
      effectEvent.effects[0].system.changes.push(
        {key: "system.rollBonuses.banes.laughingMatter.number", type: "override", value: 1},
        {key: "system.rollBonuses.banes.laughingMatter.label", type: "override", value: this.name}
      );
    }
  }
};

/* -------------------------------------------- */

HOOKS.lastStand = {
  postActivate() {
    const selfEvents = this.selfEvents;
    const health = this.actor.abilities.toughness.value * 2;
    const activation = selfEvents?.activation;
    if ( activation ) activation.resources.push({resource: "health", delta: health});
    const effectEvent = selfEvents?.all.find(e => e.effects.length);
    if ( !effectEvent ) return;
    effectEvent.effects[0].system.changes ||= [];
    effectEvent.effects[0].system.changes.push({key: "system.defenses.wounds.bonus", type: "add", value: 2});
  }
};

/* -------------------------------------------- */

HOOKS.lifebloom = {
  postActivate() {
    const wisdom = this.actor.system.abilities.wisdom.value;
    const lifebloomEffect = {
      _id: "lifebloom0000000",
      name: this.name,
      img: this.img,
      origin: this.actor.uuid,
      duration: {value: 6, units: "rounds", expiry: "turnEnd"},
      system: {
        dot: [{
          amount: wisdom,
          resource: "health",
          restoration: true
        }, {
          amount: wisdom,
          resource: "morale",
          restoration: true
        }]
      }
    };
    for ( const target of this.eventsByActor.keys() ) {
      this.recordEvent({type: "effect", target, effects: [lifebloomEffect]});
    }
  }
};

/* -------------------------------------------- */

HOOKS.executionersStrike = {
  prepare() {
    const weapon = this.actor.equipment.weapons.mainhand;
    const bleeding = SYSTEM.EFFECTS.bleeding(this.actor, {
      ability: "strength",
      damageType: weapon.system.damageType
    });
    this.effects[0] = foundry.utils.mergeObject(bleeding, this.effects[0]);
  }
};

/* -------------------------------------------- */

HOOKS.extollDeeds = {
  postActivate() {
    const morale = Math.ceil(this.actor.system.abilities.presence.value / 2);
    for ( const target of this.targets ) {
      this.recordEvent({target, resources: [{resource: "morale", delta: morale}]});
    }
  }
};

/* -------------------------------------------- */

HOOKS.headbutt = {
  prepare() {
    const cls = getDocumentClass("Item");
    const weaponData = foundry.utils.deepClone(SYSTEM.WEAPON.UNARMED_DATA);
    weaponData.name = this.name;
    const weapon = new cls(weaponData, {parent: this.actor});
    weapon.system.prepareEquippedData();
    this.usage.weapon = weapon;
    foundry.utils.mergeObject(this.usage.bonuses, weapon.system.actionBonuses);
    foundry.utils.mergeObject(this.usage.context, {
      type: "weapons",
      label: "Weapon Tags",
      icon: "fa-solid fa-swords",
      hasDice: true
    });
  },
  preActivate() {
    for ( const [target] of this.targets ) {
      const ac = this.actor.combatant;
      const tc = target.combatant;
      if ( ac?.initiative > tc?.initiative ) {
        this.usage.boons[this.id] = {label: this.name, number: 1};
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.hamstring = {
  canUse() {
    const mh = this.actor.equipment.weapons.mainhand;
    const oh = this.actor.equipment.weapons.offhand;
    if ( ![mh.system.damageType, oh?.system.damageType].includes("slashing") ) {
      throw new Error(_loc("ACTION.WARNINGS.RequiresSlashingMelee", {action: this.name}));
    }
  },
  preActivate() {
    if ( this.usage.weapon.system.damageType !== "slashing" ) {
      throw new Error(_loc("ACTION.WARNINGS.RequiresSlashingMelee", {action: this.name}));
    }
  }
};

/* -------------------------------------------- */

HOOKS.intercept = {
  prepare() {
    if ( this.actor ) {
      this.range.maximum = this.actor.system.movement.stride;
    }
  }
};

/* -------------------------------------------- */

HOOKS.interpose = {
  canUse() {
    const targetAction = ChatMessage.implementation.getLastAction();
    if ( !targetAction?.tags.has("strike") ) {
      throw new Error(_loc("ACTION.WARNINGS.SPECIFIC.INTERPOSE.RequiresStrike"));
    }
    this.usage.priorAction = targetAction;
  },
  preActivate() {
    const targetAction = this.usage.priorAction;
    const targetActors = [...targetAction.eventsByTarget.keys()];
    if ( targetActors.length !== 1 ) {
      throw new Error(_loc("ACTION.WARNINGS.SPECIFIC.INTERPOSE.SingleTarget"));
    }
    const [ally] = this.targets.keys();
    if ( targetActors[0] !== ally ) {
      throw new Error(_loc("ACTION.WARNINGS.SPECIFIC.INTERPOSE.AllyMustBeTarget"));
    }
    const allyEvents = targetAction.eventsByActor.get(ally);
    const RESULTS = game.system.api.dice.AttackRoll.RESULT_TYPES;
    const wasHit = allyEvents?.roll.some(e => e.roll?.data?.result >= RESULTS.GLANCE);
    if ( !wasHit ) {
      throw new Error(_loc("ACTION.WARNINGS.SPECIFIC.INTERPOSE.AttackMissed"));
    }
    this.metadata.targetMessageId = targetAction.message.id;
  },
  async confirm(reverse) {
    const targetMessageId = this.metadata.targetMessageId;
    const targetMessage = game.messages.get(targetMessageId);
    if ( !targetMessage ) return;
    if ( reverse ) await HOOKS.interpose._reverse.call(this, targetMessage);
    else await HOOKS.interpose._rewrite.call(this, targetMessage);
  },
  /**
   * Rewrite the original action to target the interposing actor instead of the original ally.
   * Negates the original action, re-evaluates each strike against the interposer's defenses,
   * and posts a new confirmed chat message with the rewritten results.
   * @param {ChatMessage} targetMessage    The chat message of the original action being interposed
   * @this {CrucibleAction}
   * @internal
   */
  async _rewrite(targetMessage) {
    const CrucibleAction = crucible.api.models.CrucibleAction;

    // Negate and reverse the original action
    const wasConfirmed = !!targetMessage.getFlag("crucible", "confirmed");
    await targetMessage.setFlag("crucible", "isNegated", true);
    if ( wasConfirmed ) await CrucibleAction.confirmMessage(targetMessage, {reverse: true});

    // Reconstruct original action and clone it for the rewrite
    const originalAction = CrucibleAction.fromChatMessage(targetMessage);
    const rewrittenAction = originalAction.clone({}, {message: null, lazy: true});
    const interposer = this.actor;
    rewrittenAction.targets = new Map([[interposer, {
      actor: interposer, token: this.token, name: interposer.name, uuid: interposer.uuid
    }]]);

    // Rewrite the event stream, re-evaluating strikes against the interposer's defenses
    for ( const event of originalAction.events ) {
      if ( (event.type === "strike") && event.roll ) {
        const roll = HOOKS.interpose._cloneRoll(event.roll);
        HOOKS.interpose._rewriteStrike(rewrittenAction, roll, event.weapon, interposer);
      }
      else if ( (event.type === "activation") || (event.type === "actorUpdate") ) {
        rewrittenAction.recordEvent({type: event.type, resources: event.resources,
          actorUpdates: event.actorUpdates, itemSnapshots: event.itemSnapshots}, {start: true});
      }
      else {
        rewrittenAction.recordEvent({target: interposer, resources: event.resources, effects: event.effects});
      }
    }

    // Post rewritten action as confirmed
    const rewrittenMessage = await rewrittenAction.toMessage({confirmed: true});
    await this.message.setFlag("crucible", "rewrittenMessageId", rewrittenMessage.id);
  },
  /**
   * Create a shallow copy of a Roll that has its own independent data property.
   * Preserves the prototype chain (methods, getters) while preventing mutation of the original.
   * @param {AttackRoll} roll     The original roll to clone
   * @returns {AttackRoll}        A roll copy with deep-cloned data
   * @internal
   */
  _cloneRoll(roll) {
    const clone = Object.create(roll);
    clone.data = foundry.utils.deepClone(roll.data);
    return clone;
  },
  /**
   * Re-evaluate a strike against the interposing actor's defenses and record it on the rewritten action.
   * Preserves the original roll total but recomputes the defense result and damage.
   * @param {CrucibleAction} action              The rewritten action to record events on
   * @param {AttackRoll} roll                    A cloned roll with independent data
   * @param {CrucibleItemSnapshot} weapon        The weapon snapshot from the original event
   * @param {CrucibleActor} interposer           The actor interposing to receive the attack
   * @internal
   */
  _rewriteStrike(action, roll, weapon, interposer) {
    const CrucibleAction = crucible.api.models.CrucibleAction;
    const RESULTS = game.system.api.dice.AttackRoll.RESULT_TYPES;

    // Re-evaluate defense with the interposer's physical defense
    roll.data.dc = interposer.system.defenses.physical.total;
    roll.data.result = interposer.testDefense("physical", roll);

    // Recompute damage for hits and glances, or clear damage if the interposer's defense causes a miss
    if ( (roll.data.result >= RESULTS.GLANCE) && roll.data.damage ) {
      const dmg = roll.data.damage;
      dmg.overflow = roll.overflow;
      dmg.resistance = interposer.getResistance(dmg.resource, dmg.type, dmg.restoration);
      dmg.total = CrucibleAction.computeDamage(dmg);
    } else {
      roll.data.damage = undefined;
    }
    interposer.callActorHooks("receiveAttack", action, roll);
    action.recordEvent({type: "strike", target: interposer, roll, weapon});
  },
  /**
   * Reverse a previously confirmed Interpose. Reverses the rewritten action and removes
   * the negation from the original action. The GM must manually re-confirm the original.
   * @param {ChatMessage} targetMessage    The chat message of the original action
   * @this {CrucibleAction}
   * @internal
   */
  async _reverse(targetMessage) {
    const CrucibleAction = crucible.api.models.CrucibleAction;
    const rewrittenMessageId = this.message?.getFlag("crucible", "rewrittenMessageId");
    const rewrittenMessage = game.messages.get(rewrittenMessageId);
    if ( rewrittenMessage?.getFlag("crucible", "confirmed") ) {
      await CrucibleAction.confirmMessage(rewrittenMessage, {reverse: true});
    }
    await targetMessage.setFlag("crucible", "isNegated", false);
  }
};

/* -------------------------------------------- */

HOOKS.medicinalCompound = {
  preActivate() {
    const target = this.targets.values().next().value.actor;
    const defenses = target.system.defenses;
    this.usage.defenseType = defenses.wounds.total >= defenses.madness.total ? "wounds" : "madness";
  },
  postActivate() {
    for ( const [target, events] of this.eventsByTarget ) {
      const rollEvent = events.roll[0];
      if ( !rollEvent?.roll.isSuccess ) continue;
      const dmg = rollEvent.roll.data.damage.total;
      rollEvent.resources.push({resource: "health", delta: dmg});
      const amount = Math.ceil(dmg / 2);
      if ( rollEvent.effects.length ) rollEvent.effects[0].system.dot.push(
        {amount, resource: "health", restoration: true},
        {amount, resource: "morale", restoration: true}
      );
    }
  }
};

/* -------------------------------------------- */

HOOKS.oozeMultiply = {
  postActivate() {
    const selfEvents = this.selfEvents;
    const activation = selfEvents?.activation;
    if ( activation ) activation.resources.push({resource: "health", delta: this.actor.abilities.toughness.value});
    const actorUpdateEvent = selfEvents?.actorUpdate;
    if ( actorUpdateEvent ) {
      const newSizeBonus = this.actor.system.movement.sizeBonus + 1;
      foundry.utils.setProperty(actorUpdateEvent.actorUpdates, "system.movement.sizeBonus", newSizeBonus);
    }
  }
};

/* -------------------------------------------- */

HOOKS.oozeSubdivide = {
  prepare() {
    const newHealth = Math.ceil(this.actor.system.resources.health.value / 2);
    const newSize = this.actor.system.movement.sizeBonus - 1;
    const systemData = {
      advancement: {
        rank: this.actor.system.advancement.rank === "minion" ? "minion" : "normal"
      },
      movement: {
        sizeBonus: newSize
      },
      resources: {
        health: {
          value: newHealth
        }
      }
    };

    // Configure summon
    this.usage.summons = [{
      actorUuid: this.actor.uuid,
      tokenData: {
        width: this.actor.size - 1,
        height: this.actor.size - 1,
        delta: {
          system: systemData
        }
      },
      permanent: true
    }];

    // Actor change
    foundry.utils.mergeObject(this.usage.actorUpdates, {system: systemData});
  },
  canUse() {
    if ( this.actor.size < 3 ) throw new Error(_loc("ACTION.WARNINGS.MinimumSize", {size: 3, action: this.name}));
  }
};

/* -------------------------------------------- */

HOOKS.paralyticIngest = {
  preActivate() {
    const poison = this.effects[0];
    const turns = {shoddy: 1, standard: 2, fine: 4, superior: 8, masterwork: null};
    const turnCount = turns[this.item.system.quality];
    poison.duration = turnCount !== null
      ? {value: turnCount, units: "rounds", expiry: "turnEnd"}
      : {value: null, units: "seconds", expiry: null};
    poison.system.dot.length = 0;
  }
};

/* -------------------------------------------- */

HOOKS.poisonIngest = {
  preActivate() {
    const tiers = {
      shoddy: {amount: 2, turns: 4},
      standard: {amount: 4, turns: 6},
      fine: {amount: 6, turns: 8},
      superior: {amount: 8, turns: 10},
      masterwork: {amount: 10, turns: 12}
    };
    const poisoned = SYSTEM.EFFECTS.poisoned(this.actor, tiers[this.item.system.quality]);
    foundry.utils.mergeObject(this.effects[0], poisoned);
  }
};

/* -------------------------------------------- */

HOOKS.rallyingCry = {
  postActivate() {
    const amount = this.actor.abilities.presence.value;
    for ( const target of this.targets ) {
      this.recordEvent({target, resources: [{resource: "morale", delta: amount}]});
    }
  }
};

/* -------------------------------------------- */

HOOKS.rallyingElixir = {
  postActivate() {
    const quality = this.usage.consumable.config.quality;
    let amount = 6;
    for ( let i = 1; i <= (quality.bonus + 1); i++ ) amount *= 2;
    for ( const target of this.targets ) {
      this.recordEvent({target, resources: [{resource: "morale", delta: amount}]});
    }
  }
};

/* -------------------------------------------- */

HOOKS.rallyingTonic = {
  postActivate() {
    const quality = this.usage.consumable.config.quality;
    let amount = 2;
    for ( let i = 1; i <= (quality.bonus + 1); i++ ) amount *= 2;
    for ( const [target, events] of this.eventsByTarget ) {
      const effectEvent = events.all.find(e => e.effects.length);
      if ( !effectEvent ) continue;
      effectEvent.effects[0]._id = SYSTEM.EFFECTS.getEffectId(this.id);
      effectEvent.effects[0].system.dot = [{amount, resource: "morale", restoration: true}];
      effectEvent.resources.push({resource: "morale", delta: amount});
    }
  }
};

/* -------------------------------------------- */

HOOKS.reactiveStrike = {
  canUse() {
    for ( const s of ["unaware", "flanked"] ) {
      if ( this.actor.statuses.has(s) ) {
        const statusLabel = _loc(CONFIG.statusEffects[s]?.name ?? s);
        throw new Error(_loc("ACTION.WARNINGS.BadStatus", {action: this.name, status: statusLabel}));
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.readScroll = {
  prepare() {
    this.name = `Read ${this.item.name}`;
  },
  canUse() {
    const {runes, gestures, inflections} = this.item.system.scroll;
    if ( !runes.size && !gestures.size && !inflections.size ) {
      throw new Error(_loc("CONSUMABLE.SCROLL.NoComponents"));
    }
  },
  postActivate() {
    const selfEvents = this.selfEvents;
    const effectEvent = selfEvents?.all.find(e => e.effects.length);
    if ( !effectEvent ) return;
    const {runes, gestures, inflections} = this.item.system.scroll;
    const changes = [];
    for ( const rune of runes ) {
      changes.push({key: "system.grimoire.runeIds", type: "add", value: rune});
      changes.push({key: `system.training.${rune}`, type: "upgrade", value: 1});
    }
    for ( const gesture of gestures ) {
      changes.push({key: "system.grimoire.gestureIds", type: "add", value: gesture});
    }
    for ( const inflection of inflections ) {
      changes.push({key: "system.grimoire.inflectionIds", type: "add", value: inflection});
    }
    Object.assign(effectEvent.effects[0], {
      origin: this.item.uuid,
      duration: {value: 600, units: "seconds", expiry: null},
      system: {changes}
    });
  }
};

/* -------------------------------------------- */

HOOKS.investiture = {
  canUse() {
    return this.actor.items.some(i => i.system.requiresInvestment && i.system.equipped);
  },
  preActivate() {
    const updateEvent = this.selfUpdateEvent;
    for ( const item of this.actor.items ) {
      if ( !item.system.requiresInvestment ) continue;
      const invested = item.system.equipped;
      if ( item.system.invested === invested ) continue;
      updateEvent.itemSnapshots.push(item.snapshot());
      updateEvent.actorUpdates.items.push({_id: item.id, system: {invested}});
    }
  },
  async prepareMessage(element) {
    const updates = this.selfUpdateEvent?.actorUpdates?.items ?? [];
    const invested = [];
    const divested = [];
    for ( const update of updates ) {
      if ( !("invested" in (update.system ?? {})) ) continue;
      const item = this.actor.items.get(update._id);
      if ( !item ) continue;
      (update.system.invested ? invested : divested).push(item.name);
    }
    if ( !invested.length && !divested.length ) return;
    const html = await foundry.applications.handlebars.renderTemplate(
      "systems/crucible/templates/dice/partials/investiture-summary.hbs", {invested, divested});
    const summary = foundry.utils.parseHTML(html);
    if ( summary ) element.appendChild(summary);
  }
};

/* -------------------------------------------- */

HOOKS.recover = {
  async confirm() {
    await this.actor.recover();
  }
};

/* -------------------------------------------- */

HOOKS.refocus = {
  postActivate() {
    const talisman = this.usage.weapon;
    const rollEvent = this.selfEvents?.roll[0];
    const r = rollEvent?.roll;
    let focus = 0;
    if ( r?.isSuccess ) focus += talisman.config.category.hands;
    if ( r?.isCriticalSuccess ) focus += 1;
    if ( focus ) this.recordEvent({resources: [{resource: "focus", delta: focus}]});
  }
};

/* -------------------------------------------- */

HOOKS.reload = {
  prepare() {
    const a = this.actor;
    const {reloaded} = a.system.status;
    if ( a.talentIds.has("pistoleer0000000") && !reloaded ) this.cost.action = 0; // TODO generalize
    this.usage.actorStatus.reloaded = true;
  }
};

/* -------------------------------------------- */

HOOKS.repercussiveBlock = {
  postActivate() {
    for ( const [target, events] of this.eventsByTarget ) {
      if ( !events.allSuccess ) continue;
      const {mainhand} = target.equipment.weapons; // TODO - react to the prior action?
      if ( !mainhand?.id || mainhand.properties.has("natural") ) continue;
      this.recordEvent({type: "actorUpdate", target,
        actorUpdates: {items: [{_id: mainhand.id, system: {dropped: true, equipped: false}}]},
        itemSnapshots: [mainhand.snapshot()],
        statusText: [{text: "Disarmed!", fontSize: 64}]});
    }
  }
};

/* -------------------------------------------- */

HOOKS.rest = {
  async confirm() {
    await this.actor.rest();
  }
};

/* -------------------------------------------- */

HOOKS.restrainingChomp = {
  postActivate() {
    for ( const [target, events] of this.eventsByTarget ) {
      if ( target.size > this.actor.size ) {
        for ( const event of events.all ) event.effects.length = 0;
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.revive = {
  acquireTargets(targets) {
    for ( const target of targets ) {
      if ( !target.actor.system.isDead ) target.error ??= `${this.name} requires a Dead target.`;
    }
  },
  postActivate() {
    for ( const [target, events] of this.eventsByTarget ) {
      const rollEvent = events.roll[0];
      if ( !rollEvent?.roll.isSuccess ) continue;
      SYSTEM.ACTION.TAGS.harmless.postActivate.call(this);
      this.recordEvent({target, resources: [{resource: "wounds", delta: -this.actor.system.abilities.wisdom.value}]});
    }
  }
};

/* -------------------------------------------- */

HOOKS.ruthlessMomentum = {
  prepare() {
    if ( this.actor ) this.range.maximum = this.actor.system.movement.stride;
  }
};

/* -------------------------------------------- */

HOOKS.secondWind = {
  postActivate() {
    const health = this.actor.system.abilities.toughness.value;
    this.recordEvent({resources: [{resource: "health", delta: health}]});
  }
};

/* -------------------------------------------- */

HOOKS.selfRepair = {
  postActivate() {
    const activation = this.events.find(e => e.type === "activation");
    if ( activation ) activation.resources.push({resource: "health", delta: this.actor.abilities.toughness.value});
  }
};

/* -------------------------------------------- */

HOOKS.affixActivating = {
  postActivate() {
    const activation = this.events.find(e => e.type === "activation");
    if ( activation ) activation.resources.push({resource: "action", delta: this.affix.system.tier.value});
  }
};

/* -------------------------------------------- */

HOOKS.affixFocusing = {
  postActivate() {
    const amount = 2 + (2 * this.affix.system.tier.value);
    const activation = this.events.find(e => e.type === "activation");
    if ( activation ) activation.resources.push({resource: "focus", delta: amount});
  }
};

/* -------------------------------------------- */

HOOKS.tailSweep = {
  canUse() {
    return this.usage.weapon.system.identifier === "tail";
  },
  initialize() {
    this.usage.weapon = this.actor.equipment.weapons.natural.find(w => w.system.identifier === "tail");
  }
};

/* -------------------------------------------- */

HOOKS.thrash = {
  acquireTargets(targets) {
    for ( const target of targets ) {
      if ( !target.actor.statuses.has("restrained") ) target.error ??= `You can only perform ${this.name} against a target that you have Restrained.`;
    }
  }
};

/* -------------------------------------------- */

HOOKS.threadTheNeedle = {
  configure() {
    // Grant flanked boons for ranged attacks (normally only melee gets flanking)
    for ( const [actor] of this.targets ) {
      if ( !actor.statuses.has("flanked") ) continue;
      const ae = actor.effects.get(SYSTEM.EFFECTS.getEffectId("flanked"));
      this.usage.boons.flanked = {label: _loc("ACTIVE_EFFECT.STATUSES.Flanked"), number: ae?.system.flanked ?? 1};
      break; // Single target action
    }
  }
};

/* -------------------------------------------- */

HOOKS.steelJawTrigger = {
  prepare() {
    const tiers = {shoddy: 1, standard: 2, fine: 4, superior: 8, masterwork: 16};
    this.usage.bonuses.damageBonus = tiers[this.item.system.quality];
  }
};

/* -------------------------------------------- */

HOOKS.tramplingCharge = {
  prepare() {
    this.target.size = this.actor.size;
    this.range.maximum = this.actor.system.movement.stride * 2;
  },
  postActivate() {
    const halfSize = Math.ceil(this.actor.size / 2);
    for ( const [target, events] of this.eventsByTarget ) {
      if ( target.size > halfSize ) {
        for ( const event of events.all ) event.effects.length = 0;
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.tuskCharge = {
  prepare() {
    this.range.maximum = this.actor.system.movement.stride;
  }
};

/* -------------------------------------------- */

HOOKS.unshakeablePoise = {
  postActivate() {
    const activation = this.events.find(e => e.type === "activation");
    if ( activation ) activation.resources.push({resource: "focus", delta: this.actor.abilities.wisdom.value});
  }
};

/* -------------------------------------------- */

HOOKS.uppercut = {
  acquireTargets(targets) {
    const lastAction = this.actor.lastConfirmedAction;
    for ( const target of targets ) {
      if ( !lastAction?.targets?.has(target.actor) ) target.error ??= `${this.name} must attack the same target as the Strike which it follows.`;
    }
  }
};

/* -------------------------------------------- */

HOOKS.vampiricBite = {
  prepare() {
    const cls = getDocumentClass("Item");
    const biteData = foundry.utils.deepClone(SYSTEM.WEAPON.VAMPIRE_BITE);
    biteData.name = _loc(biteData.name);
    const bite = new cls(biteData, {parent: this.actor});
    bite.system.prepareEquippedData();
    this.usage.weapon = bite;
    this.usage.context.tags.vampiricBite = this.name;
    foundry.utils.mergeObject(this.usage.bonuses, bite.system.actionBonuses);
    foundry.utils.mergeObject(this.usage.context, {
      type: "weapons",
      label: "Weapon Tags",
      icon: "fa-solid fa-swords",
      hasDice: true
    });
  },
  postActivate() {
    const health = this.actor.system.abilities.toughness.value;
    for ( const [target, events] of this.eventsByTarget ) {
      if ( events.isSuccess ) {
        this.recordEvent({resources: [{resource: "health", delta: health}]});
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.wildStrike = {
  acquireTargets(targets) {
    const lastAction = this.actor.lastConfirmedAction;
    for ( const target of targets ) {
      if ( !lastAction?.targets?.has(target.actor) ) target.error ??= `${this.name} must attack the same target as the Strike which it follows.`;
    }
    // TODO somehow require this to use a different weapon than the prior confirmed strike
  }
};

/* -------------------------------------------- */

export default HOOKS;

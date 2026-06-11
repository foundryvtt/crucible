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

HOOKS.amplifyAffix = {
  async preActivate() {
    // Enumerate equipped affixes that are below their maximum tier
    const choices = {};
    for ( const item of this.actor.items ) {
      if ( !item.system.equipped || !item.system.affixes ) continue;
      for ( const [id, affix] of Object.entries(item.system.affixes) ) {
        const t = affix.system.tier;
        if ( t.value >= Math.min(t.max, 3) ) continue;
        choices[`${item.id}.${id}`] = `${item.name}: ${affix.name} (${t.value} → ${t.value + 1})`;
      }
    }
    if ( foundry.utils.isEmpty(choices) ) throw new Error(_loc("ACTIONS.AmplifyAffix.NoAffixes"));

    // Prompt for the affix to amplify
    const field = new foundry.data.fields.StringField({required: true, blank: false, choices,
      label: _loc("ACTIONS.AmplifyAffix.Label")});
    const target = await foundry.applications.api.DialogV2.prompt({
      window: {title: _loc("ACTIONS.AmplifyAffix.Title"), icon: "fa-solid fa-arrow-up-right-dots"},
      content: field.toFormGroup({}, {name: "target"}).outerHTML,
      ok: {label: this.name, callback: (event, button) => button.form.elements.target.value},
      rejectClose: false
    });
    if ( !target ) throw new Error(_loc("ACTIONS.AmplifyAffix.Required"));
    this.metadata.amplify = target;
  },
  async confirm(reverse) {
    const target = this.metadata.amplify;
    if ( !target ) return;
    const effectId = SYSTEM.EFFECTS.getEffectId("Amplify Affix");

    // A single replaceable marker records which affix is amplified; the Artificer prepare hook reads it
    if ( this.actor.effects.has(effectId) ) await this.actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
    if ( reverse ) return;
    const dot = target.indexOf(".");
    const amplify = {itemId: target.slice(0, dot), affixId: target.slice(dot + 1)};
    await this.actor.createEmbeddedDocuments("ActiveEffect", [{
      _id: effectId,
      name: _loc("ACTIONS.AmplifyAffix.Effect"),
      img: this.img,
      flags: {crucible: {amplify}}
    }], {keepId: true});
  }
};

/* -------------------------------------------- */

HOOKS.antitoxin = {
  postActivate() {
    const tiers = {shoddy: 3, standard: 5, fine: 7, superior: 9, masterwork: 11};
    const neutralizeAmount = tiers[this.item.system.quality];
    for ( const [target] of this.targets ) {
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

HOOKS.aqueousTransmission = {
  prepare() {
    this.cost.action = 0;
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
    if ( targetAction?.message.flags.crucible.confirmed ) {
      throw new Error(_loc("ACTION.WARNINGS.AlreadyConfirmed"));
    }
    const {RESULT_TYPES, RESULT_TYPE_LABELS} = game.system.api.dice.AttackRoll;
    const validResultTypes = [RESULT_TYPES.GLANCE, RESULT_TYPES.ARMOR];
    const listFormatter = new Intl.ListFormat(game.i18n.lang, {style: "long", type: "disjunction"});
    const validDefenses = listFormatter.format(validResultTypes.map(r => _loc(RESULT_TYPE_LABELS[r])));
    const invalidError = _loc("ACTION.WARNINGS.MustFollowMeleeDefense", {action: this.name, defense: validDefenses});
    if ( !targetAction?.tags.has("melee") ) {
      throw new Error(invalidError);
    }
    const myEvents = targetAction.eventsByActor.get(this.actor);
    for ( const event of myEvents?.roll ?? [] ) {
      if ( validResultTypes.includes(event.roll.data.result) ) {
        this.usage.targetAction = targetAction.message.id;
        return true;
      }
    }
    throw new Error(invalidError);
  }
};

/* -------------------------------------------- */

HOOKS.bullrush = {
  prepare() {
    this.usage.movement.ignoreTokens = true;
  }
};

/* -------------------------------------------- */

/**
 * Shared helper for checking eligibility of an action based on the result of the most recent action
 * @param {CrucibleAction} action
 * @param {object} options
 * @param {number} options.requiredResult
 * @throws {Error}
 */
function _canUsePostDefend(action, {requiredResult}) {
  const lastAction = ChatMessage.implementation.getLastAction();
  const rolls = lastAction?.eventsByTarget.get(action.actor)?.roll ?? [];
  if ( !lastAction?.tags.has("melee") || !rolls.some(r => r.roll.data.result === requiredResult) ) {
    const resultLabel = _loc(crucible.api.dice.AttackRoll.RESULT_TYPE_LABELS[requiredResult]);
    throw new Error(_loc("ACTION.WARNINGS.MustFollowMeleeDefense", {action: action.name, defense: resultLabel}));
  }
}

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

HOOKS.challenge = {
  postActivate() {
    const [rival] = this.targets.keys();
    const effect = this.selfEvents?.all.find(e => e.type === "effect")?.effects[0];
    if ( !rival || !effect ) return;
    effect._id = crucible.api.hooks.talent.champion00000000._DOMINANCE_ID;
    effect.origin = rival.uuid;
    effect.showIcon = CONST.ACTIVE_EFFECT_SHOW_ICON.NEVER;
    foundry.utils.setProperty(effect, "flags.crucible.dominance", {round: 0, stage: 0});
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

HOOKS.coldFocus = {
  postActivate() {
    const h = this.actor.system.resources.health;
    const missing = h.max > 0 ? (1 - (h.value / h.max)) : 0;
    this.selfEvents.activation.resources.push({resource: "focus", delta: Math.min(5, 1 + Math.floor(missing * 4))});
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

HOOKS.counterEvade = {
  canUse() {
    _canUsePostDefend(this, {requiredResult: crucible.api.dice.AttackRoll.RESULT_TYPES.DODGE});
  }
};

/* -------------------------------------------- */

HOOKS.counterRiposte = {
  canUse() {
    _canUsePostDefend(this, {requiredResult: crucible.api.dice.AttackRoll.RESULT_TYPES.PARRY});
  }
};

/* -------------------------------------------- */

HOOKS.counterStrike = {
  canUse() {
    _canUsePostDefend(this, {requiredResult: crucible.api.dice.AttackRoll.RESULT_TYPES.BLOCK});
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
  canUse() {
    if ( this.tags.has("noncombat") ) return;
    const lastAction = ChatMessage.implementation.getLastAction();
    const wasSpell = lastAction && (lastAction.tags.has("composed") || lastAction.tags.has("iconicSpell"));
    if ( !wasSpell ) throw new Error(_loc("SPELL.COUNTERSPELL.WARNINGS.BadTarget"));
  },
  configure() {
    this.usage.targetAction ??= ChatMessage.implementation.getLastAction();
  },
  async roll(target) {
    if ( this.usage.targetAction.message ) return;

    // Must remove the spell attack added by the `spell` tag's _roll hook in the case of a non-combat counterspell
    this.events.findSplice(e => e.type === "spell");
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

HOOKS.coveringFire = {
  canUse() {
    if ( this.actor.system.status.coveringFire ) {
      throw new Error(_loc("ACTION.WARNINGS.OncePerRound", {action: this.name}));
    }
  },
  prepare() {
    this.usage.actorStatus.coveringFire = true;
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

HOOKS.defensiveRoll = {
  prepare() {
    this.range.maximum = this.actor.system.movement.size;
  },
  canUse() {
    _canUsePostDefend(this, {requiredResult: crucible.api.dice.AttackRoll.RESULT_TYPES.DODGE});
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
  async preActivate() {
    const maximum = game.combat.combatant.initiative - 1;
    const hint = await CONFIG.ux.TextEditor.enrichHTML(_loc("ACTION.DelayHint", {maximum}));
    const response = await foundry.applications.api.DialogV2.prompt({
      window: { title: "ACTION.DelayTitle" },
      content: `<form class="delay-turn" autocomplete="off">
            <div class="form-group">
                <label>${_loc("ACTION.DelayLabel")}</label>
                <input name="initiative" type="number" min="1" value="${maximum - 1}" max="${maximum}" step="1">
                <p class="hint">${hint}</p>
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

HOOKS.electrochargeAmpoule = {
  prepare() {
    this.target.size = {shoddy: 3, standard: 4, fine: 6, superior: 8, masterwork: 10}[this.item.system.quality];
  }
};

/* -------------------------------------------- */

// TODO: Currently this will consume free movement. Determine how to make that not the case while still properly
// showing 0 cost on the token ruler
HOOKS.evasiveShot = {
  prepare() {
    this.range.maximum = Math.round(this.actor.system.movement.stride / 2);
    this.cost.action = 0;
  },
  canUse() {
    const lastAction = this.actor.lastConfirmedAction;
    if ( !lastAction?.tags.has("ranged") ) {
      throw new Error(_loc("ACTION.WARNINGS.MustFollowRanged", {action: this.name}));
    }
  }
};

/* -------------------------------------------- */

HOOKS.estocade = {
  acquireTargets(targets) {
    for ( const t of targets ) {
      const a = t.actor;
      if ( !a ) continue;
      const opened = ["exposed", "prone", "slowed", "staggered", "paralyzed"].some(s => a.statuses.has(s))
        || !!a.equipment.weapons.dropped?.mainhand;
      if ( !opened ) t.error ??= _loc("ACTION.WARNINGS.SPECIFIC.ESTOCADE.RequiresOpening");
    }
  }
};

/* -------------------------------------------- */

HOOKS.fall = {
  suppressFromSheet: true,
  canUse() {
    if ( !this.actor.statuses.has("falling") ) return false;
    if ( Number.isFinite(this.usage.fallDistance) && (this.usage.fallDistance <= 0) ) return false;
  },
  prepare() {
    this.usage.damageType = "bludgeoning";
    this.usage.bonuses.base = 1;
  },
  // Use the acquireTargets hook to compute the parameters of the fall because it happens prior to action use dialog
  acquireTargets(targets) {
    const surface = this.token?._findSupportingSurface();
    const distance = surface ? (this.token._source.elevation - surface.elevation) : 0;
    this.usage.fall = {distance, elevation: surface?.elevation};
    if ( (distance <= 0) || !surface ) return;
    this.name = _loc("ACTION.DEFAULT_ACTIONS.Fall.NameDistance", {distance});
    this.usage.bonuses.ability = distance;

    // Short Falls: harmless for 10ft and below, otherwise Reflex defense
    if ( distance <= 30 ) {
      this.usage.defenseType = "reflex";
      if ( distance <= 10 ) {
        this.tags.delete("generic");
        this.tags.add("harmless");
      } else {
        this.tags.add("reflex");
      }
    }

    // Long Falls: Fortitude defense and severe damage
    else {
      this.usage.defenseType = "fortitude";
      this.tags.add("fortitude");
      this.tags.add("severe");
    }
  },
  async postActivate() {
    const {distance, elevation} = this.usage.fall;
    if ( !distance ) return;
    const movement = await crucible.api.canvas.movement.createMovementPlan(this.token, [{action: "fall", elevation}],
      {animate: false});
    if ( !movement ) return;
    Object.defineProperty(this, "movement", { value: movement, configurable: true });
    const {origin} = movement;
    this.recordEvent({type: "movement", target: this.actor,
      movement: {id: movement.id, origin: {x: origin.x, y: origin.y, elevation: origin.elevation}}});
  },
  configureVFX(vfxConfig) {
    return crucible.api.canvas.vfx.landing.configureLandingVFXEffect(this) ?? vfxConfig;
  },
  finalizeVFX(vfxEffect, references) {
    crucible.api.canvas.vfx.landing.finalizeLandingVFXEffect(this, vfxEffect, references);
  }
};

/* -------------------------------------------- */

HOOKS.fallGlide = {
  suppressFromSheet: true,
  canUse() {
    if ( !this.actor.statuses.has("falling") ) return false;
  },
  acquireTargets(targets) {
    if ( !this.movement ) return;
    const origin = this.movement.origin?.elevation ?? 0;
    const end = this.movement.waypoints?.at(-1)?.elevation ?? origin;
    if ( end >= origin ) for ( const t of targets ) t.error = _loc("ACTIONS.Glide.MustDescend");
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

HOOKS.fieldStudy = {
  async preActivate() {
    const choices = Object.fromEntries(Object.entries(crucible.CONFIG.knowledge)
      .map(([k, v]) => [k, _loc(v.label)]));
    const field = new foundry.data.fields.StringField({
      required: true, blank: false, choices, label: _loc("ACTIONS.FieldStudy.Label")
    });
    const content = field.toFormGroup({}, {name: "knowledge"}).outerHTML;
    const knowledge = await foundry.applications.api.DialogV2.prompt({
      window: {title: "ACTIONS.FieldStudy.Title"},
      content,
      ok: {label: this.name, callback: (event, button) => button.form.elements.knowledge.value},
      rejectClose: false
    });
    if ( !knowledge ) throw new Error(_loc("ACTIONS.FieldStudy.Required"));
    this.metadata.knowledge = knowledge;
  },
  postActivate() {
    const k = this.metadata.knowledge;
    if ( !k ) return;
    const effectEvent = this.selfEvents?.all.find(e => e.effects.length);
    if ( !effectEvent ) return;

    // Encode the chosen Knowledge as add-changes; a single fixed id means a new study replaces the previous one
    const effect = effectEvent.effects[0];
    effect._id = SYSTEM.EFFECTS.getEffectId("Field Study");
    effect.name = _loc("ACTIONS.FieldStudy.Effect", {knowledge: _loc(crucible.CONFIG.knowledge[k].label)});
    effect.system.changes = [
      {key: "system.details.background.knowledge", type: "add", value: k},
      {key: "system.details.knowledge", type: "add", value: k}
    ];
  }
};

/* -------------------------------------------- */

HOOKS.flashBrilliance = {
  prepare() {
    // Can be used once per rest outside of combat
    if ( !this.actor.inCombat && !this.actor.flags.crucible?.flashOfBrillianceRested ) {
      this.cost.heroism = 0;
      this.usage.actorFlags.flashOfBrillianceRested = true;
    }
  },
  postActivate() {
    const effectEvent = this.selfEvents?.all.find(e => e.effects.length);
    if ( !effectEvent ) return;

    // Grant every Knowledge for the effect's duration
    const changes = [];
    for ( const k in crucible.CONFIG.knowledge ) {
      changes.push({key: "system.details.background.knowledge", type: "add", value: k});
      changes.push({key: "system.details.knowledge", type: "add", value: k});
    }
    effectEvent.effects[0].system.changes = changes;
  }
};

/* -------------------------------------------- */

HOOKS.flyingKick = {
  prepare() {
    this.range.maximum = this.actor.system.movement.stride;
  }
};

/* -------------------------------------------- */

HOOKS.frostFlask = {
  prepare() {
    this.target.size = {shoddy: 3, standard: 4, fine: 6, superior: 8, masterwork: 10}[this.item.system.quality];
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

// TODO: Mote and Wanderer flame elemental tiers do not yet exist; remap Standard quality to Sprite and Masterwork
//  quality to Visitor until those creatures are authored.
HOOKS.gemOfConjuredFlame = {
  canUse() {
    if ( this.item.system.quality === "shoddy" ) {
      throw new Error(_loc("HOOKS.WARNINGS.GemConjuredFlameShoddy"));
    }
  },
  prepare() {
    const sprite = "Compendium.crucible.summons.Actor.RuNh1bFGiHKdHeKI";
    const visitor = "Compendium.crucible.summons.Actor.AlwoqQKoL1BnnZjd";
    const actorUuid = {
      standard: sprite,
      fine: sprite,
      superior: visitor,
      masterwork: visitor
    }[this.item.system.quality];
    if ( !actorUuid ) return;
    this.usage.summons = [{actorUuid, effectId: SYSTEM.EFFECTS.getEffectId(this.id)}];
  },
  postActivate() {
    const summonEvent = this.events.find(e => e.type === "summon");
    if ( !summonEvent ) return;
    summonEvent.effects.push({
      _id: summonEvent.summon.effectId,
      img: this.img,
      name: this.name,
      duration: {rounds: 6},
      system: {}
    });
  }
};

/* -------------------------------------------- */

HOOKS.grapple = {
  _GRAPPLED_EFFECT_ID: "grappled00000000",
  _GRAPPLING_EFFECT_ID: "grappling0000000",
  _canGrapple(actor, target) {
    return (actor.size + actor.system.movement.grappleBonus) >= (target.size + target.system.movement.grappleBonus);
  },
  prepare() {
    for ( const effect of this.effects ) {
      if ( effect.scope === SYSTEM.ACTION.TARGET_SCOPES.SELF ) effect._id = HOOKS.grapple._GRAPPLING_EFFECT_ID;
      else effect._id = HOOKS.grapple._GRAPPLED_EFFECT_ID;
    }
  },
  acquireTargets(targets) {
    const grappling = this.actor.effects.get(HOOKS.grapple._GRAPPLING_EFFECT_ID);
    for ( const target of targets ) {
      const grappled = target.actor.effects.get(HOOKS.grapple._GRAPPLED_EFFECT_ID);
      const grappledByMe = grappled?.origin === this.actor.uuid;
      if ( grappled && !grappledByMe ) {
        target.error ??= _loc("ACTIONS.Grapple.AlreadyGrappled", {name: target.actor.name});
        continue;
      }
      if ( grappling && !grappledByMe ) {
        target.error ??= _loc("ACTIONS.Grapple.AlreadyGrappling");
        continue;
      }
      if ( !HOOKS.grapple._canGrapple(this.actor, target.actor) ) {
        target.error ??= _loc("ACTIONS.Grapple.TooLarge", {name: target.actor.name});
      }
    }
  },
  postActivate() {
    const captive = this.targets.keys().next().value;
    if ( !captive ) return;
    for ( const event of this.events ) {
      const grappling = event.effects.find(e => e._id === HOOKS.grapple._GRAPPLING_EFFECT_ID);
      if ( grappling ) {
        grappling.origin = captive.uuid;
        return;
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.healingElixir = {
  postActivate() {
    const quality = this.usage.consumable.config.quality;
    let amount = 6;
    for ( let i = 1; i <= (quality.bonus + 1); i++ ) amount *= 2;
    for ( const [target] of this.targets ) {
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

HOOKS.horrificCritical = {
  canUse() {
    const lastAction = this.actor.lastConfirmedAction;
    if ( !lastAction?.tags.has("melee") || !lastAction?.events.some(e => (e.type === "strike") && e.isCriticalSuccess) ) {
      throw new Error(_loc("ACTION.WARNINGS.LastNotMeleeCrit", {action: this.name}));
    }
  }
};

/* -------------------------------------------- */

HOOKS.imbueAffix = {
  async preActivate() {
    const fields = foundry.data.fields;
    const itemField = new fields.DocumentUUIDField({type: "Item", required: true, blank: false,
      label: _loc("ACTIONS.ImbueAffix.ItemLabel")});
    const affixField = new fields.DocumentUUIDField({type: "ActiveEffect", required: true, blank: false,
      label: _loc("ACTIONS.ImbueAffix.AffixLabel")});
    const content = document.createElement("div");
    content.append(
      itemField.toFormGroup({}, {name: "itemUuid"}),
      affixField.toFormGroup({}, {name: "affixUuid"})
    );
    const data = await foundry.applications.api.DialogV2.prompt({
      window: {title: _loc("ACTIONS.ImbueAffix.Title"), icon: "fa-solid fa-wand-magic-sparkles"},
      content,
      ok: {label: this.name,
        callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object},
      rejectClose: false
    });
    if ( !data?.itemUuid || !data?.affixUuid ) throw new Error(_loc("ACTIONS.ImbueAffix.Required"));

    // Validate the dropped item is an affixable physical item that this actor owns
    const item = await fromUuid(data.itemUuid);
    if ( (item?.actor !== this.actor) || !SYSTEM.ITEM.AFFIXABLE_ITEM_TYPES.has(item.type) ) {
      throw new Error(_loc("ACTIONS.ImbueAffix.InvalidItem"));
    }

    // Validate the dropped affix can be applied at Tier 1 to this item type
    const affix = await fromUuid(data.affixUuid);
    if ( affix?.type !== "affix" ) throw new Error(_loc("ACTIONS.ImbueAffix.InvalidAffix"));
    if ( affix.system.tier.min > 1 ) throw new Error(_loc("ACTIONS.ImbueAffix.TierTooHigh"));
    if ( affix.system.itemTypes.size && !affix.system.itemTypes.has(item.type) ) {
      throw new Error(_loc("ACTIONS.ImbueAffix.Incompatible"));
    }

    // The item must have an open affix slot in the chosen affix's prefix/suffix category
    if ( !(item.system.affixCapacity?.[affix.system.affixType]?.available >= 1) ) {
      throw new Error(_loc("ACTIONS.ImbueAffix.NoCapacity"));
    }
    this.metadata.imbue = {itemUuid: item.uuid, affixUuid: affix.uuid};
  },
  async confirm(reverse) {
    const imbue = this.metadata.imbue;
    if ( !imbue ) return;

    // A single imbue persists at a time; clear any prior imbued affix across the actor's items
    for ( const item of this.actor.items ) {
      const prior = item.effects.find(e => e.getFlag("crucible", "imbued"));
      if ( prior ) await item.deleteEmbeddedDocuments("ActiveEffect", [prior.id]);
    }
    if ( reverse ) return;

    // Inscribe the chosen affix onto the target item at Tier 1
    const item = await fromUuid(imbue.itemUuid);
    const affix = await fromUuid(imbue.affixUuid);
    if ( !item || !affix ) return;
    const ae = affix.toObject();
    delete ae._id;
    ae.system.tier.value = 1;
    foundry.utils.setProperty(ae, "flags.crucible.imbued", true);
    await item.createEmbeddedDocuments("ActiveEffect", [ae]);
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
  prepare() {
    this.usage.hasDice = false;
  },
  postActivate() {
    const selfEvents = this.selfEvents;
    const health = this.actor.abilities.toughness.value * 2;
    const activation = selfEvents?.activation;
    if ( activation ) activation.resources.push({resource: "health", delta: health});
    const effectEvent = selfEvents?.all.find(e => e.effects.length);
    if ( !effectEvent ) return;
    effectEvent.effects[0].system.changes ||= [];
    effectEvent.effects[0].system.changes.push({key: "system.defenses.wounds.bonus", type: "subtract", value: 2});
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
  },
  preActivate() {
    const target = this.targets.keys().next().value;
    const {health} = target.resources;
    if ( health.value < (health.max / 2) ) return;
    this.effects = [];
    this.tags.delete("deadly");
    this.usage.bonuses.multiplier -= 1;
  }
};

/* -------------------------------------------- */

HOOKS.extollDeeds = {
  postActivate() {
    const morale = Math.ceil(this.actor.system.abilities.presence.value / 2);
    for ( const [target] of this.targets ) {
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
      throw new Error(_loc("ACTION.WARNINGS.MustReactStrike", {action: this.name}));
    }
    const targetActors = [...targetAction.eventsByTarget.keys()];
    if ( targetActors.length !== 1 ) {
      throw new Error(_loc("ACTION.WARNINGS.MustReactSingleTarget", {action: this.name}));
    }
    const targetEvents = targetAction.eventsByTarget.get(targetActors[0]);
    const {RESULT_TYPES} = game.system.api.dice.AttackRoll;
    const wasHit = targetEvents.roll?.some(e => e.roll?.data?.result >= RESULT_TYPES.GLANCE);
    if ( !wasHit ) {
      throw new Error(_loc("ACTION.WARNINGS.MustReactHit", {action: this.name}));
    }
    this.usage.priorAction = targetAction;
  },
  acquireTargets(targets) {
    const targetAction = this.usage.priorAction;
    const [target] = [...targetAction.eventsByTarget.keys()];
    if ( targets.length && (targets[0]?.actor !== target) ) {
      targets[0].error = _loc("ACTION.WARNINGS.MustTargetTarget", {action: this.name});
    }
  },
  preActivate() {
    this.metadata.targetMessageId = this.usage.priorAction.message.id;
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

HOOKS.offhandStrike = {
  canUse() {
    const lastAction = this.actor.lastConfirmedAction;
    if ( lastAction.events.find(e => e.type === "strike")?.weapon.system.slot !== SYSTEM.WEAPON.SLOTS.MAINHAND ) {
      throw new Error(_loc("ACTION.WARNINGS.MustFollowMainhandStrike", {action: this.name}));
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

HOOKS.omniglotDecoction = {
  preActivate() {
    const minutes = {shoddy: 10, standard: 60, fine: 240, superior: 720, masterwork: 1440}[this.item.system.quality];
    if ( this.effects[0] ) this.effects[0].duration.value = minutes;
  }
};

/* -------------------------------------------- */

HOOKS.overrun = {
  prepare() {
    this.target.size = this.actor.size;
    this.range.maximum = this.actor.system.movement.stride * 2;
    // You bowl through any creature you could Grapple; exempt them from collision so your charge halts at the first
    // creature too massive to overpower. Evaluated lazily on the polygon's near-path candidates, not the whole scene.
    this.usage.movement.excludeTokenTest = t => HOOKS.grapple._canGrapple(this.actor, t.actor);
  },
  postActivate() {
    // Only creatures you could Grapple are bowled over; one too massive to overpower halts you and is unaffected
    for ( const [target, events] of this.eventsByTarget ) {
      if ( (target === this.actor) || HOOKS.grapple._canGrapple(this.actor, target) ) continue;
      for ( const event of events.all ) {
        event.effects.length = 0;
        if ( event.roll?.data.damage ) event.roll.data.damage.base = event.roll.data.damage.total = 0;
      }
    }
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
    for ( const [target] of this.targets ) {
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
    for ( const [target] of this.targets ) {
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
    const actor = this.actor;

    // A Champion may strike their Challenged rival even while Flanked
    const target = [...game.user.targets][0]?.actor;
    const dominanceId = crucible.api.hooks.talent.champion00000000._DOMINANCE_ID;
    const championBypass = actor.talentIds.has("champion00000000")
      && (actor.effects.get(dominanceId)?.origin === target?.uuid);

    for ( const s of ["unaware", "flanked"] ) {
      if ( (s === "flanked") && championBypass ) continue;
      if ( actor.statuses.has(s) ) {
        const statusLabel = _loc(CONFIG.statusEffects[s]?.name ?? s);
        throw new Error(_loc("ACTION.WARNINGS.BadStatus", {action: this.name, status: statusLabel}));
      }
    }
  },
  prepare() {
    const actor = this.actor;
    if ( !actor.talentIds.has("champion00000000") ) return;
    const target = [...game.user.targets][0]?.actor;
    const dominanceId = crucible.api.hooks.talent.champion00000000._DOMINANCE_ID;
    const isRival = actor.effects.get(dominanceId)?.origin === target?.uuid;

    // Champion vs rival: trade Action for 1 Focus. Done in prepare (after the strike tag folds in weapon AP) so the
    // discounted cost precedes _canUse's affordability gate, which would otherwise reject on the full weapon AP.
    if ( isRival && (actor.resources.focus.value >= 1) ) {
      this.cost.action = 0;
      this.cost.focus = 1;
    }
  }
};

/* -------------------------------------------- */

HOOKS.readScroll = {
  prepare() {
    this.name = _loc("ITEM.ACTIONS.Read", {item: this.item.name});
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
  canUse() {
    if ( this.actor.system.isDead || this.actor.system.isInsane ) {
      throw new Error(_loc("HOOKS.WARNINGS.RestRecoverIncapacitated"));
    }
  },
  postActivate() {
    _restRecoverPostActivate(this, {
      expirationSeconds: SYSTEM.TIME.recoverSeconds,
      deletePassiveEffects: false,
      reduceWoundMadness: false
    });
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
  canUse() {
    const targetAction = ChatMessage.implementation.getLastAction();
    if ( targetAction?.message.flags.crucible.confirmed ) {
      throw new Error(_loc("ACTION.WARNINGS.AlreadyConfirmed"));
    }
    _canUsePostDefend(this, {requiredResult: crucible.api.dice.AttackRoll.RESULT_TYPES.BLOCK});
    this.usage.targetAction = targetAction.message.id;
  }
};

/* -------------------------------------------- */

HOOKS.rest = {
  canUse() {
    if ( this.actor.system.isDead || this.actor.system.isInsane ) {
      throw new Error(_loc("HOOKS.WARNINGS.RestRecoverIncapacitated"));
    }
  },
  postActivate() {
    _restRecoverPostActivate(this, {
      expirationSeconds: SYSTEM.TIME.restSeconds,
      deletePassiveEffects: true,
      reduceWoundMadness: true
    });
  }
};

/**
 * Shared event recorder used by the rest and recover action postActivate hooks.
 * @param {CrucibleAction} action
 * @param {object} options
 * @param {number} options.expirationSeconds        ActiveEffects with a duration <= this many seconds expire
 * @param {boolean} options.deletePassiveEffects    Also cull effects that have no defined duration
 * @param {boolean} options.reduceWoundMadness      Reduce hero wounds and madness
 */
function _restRecoverPostActivate(action, {expirationSeconds, deletePassiveEffects, reduceWoundMadness}) {
  const actor = action.actor;

  // Resource recovery deltas
  const activationEvent = action.selfEvents.activation;
  for ( const [id, resource] of Object.entries(actor.system.resources) ) {
    const cfg = SYSTEM.RESOURCES[id];
    if ( !cfg || (cfg.type === "reserve") ) continue;
    if ( id === "heroism" ) {
      if ( resource.value > 0 ) activationEvent.resources.push({resource: "heroism", delta: -resource.value});
      continue;
    }
    const delta = resource.max - resource.value;
    if ( delta > 0 ) activationEvent.resources.push({resource: id, delta});
  }

  // Hero-only wounds and madness reduction (rest only); clamped to current value so reversal restores exactly
  if ( reduceWoundMadness && (actor.type === "hero") ) {
    const {wounds, madness} = actor.system.resources;
    const woundsDelta = -Math.min(actor.level, wounds.value);
    const madnessDelta = -Math.min(actor.level, madness.value);
    if ( woundsDelta < 0 ) activationEvent.resources.push({resource: "wounds", delta: woundsDelta});
    if ( madnessDelta < 0 ) activationEvent.resources.push({resource: "madness", delta: madnessDelta});
  }

  // Expire ActiveEffects via a dedicated deletion event
  const effects = [];
  for ( const effect of actor.effects ) {
    const s = effect.duration.seconds;
    if ( (effect.id === "weakened00000000") || (effect.id === "broken0000000000") ) {
      effects.push({_id: effect.id, _action: "delete"});
    }
    else if ( s ? (s <= expirationSeconds) : deletePassiveEffects ) {
      effects.push({_id: effect.id, _action: "delete"});
    }
  }
  if ( effects.length ) action.recordEvent({type: "effect", effects});

  // Divest unequipped invested items via the self actorUpdate event with snapshots for reversal
  const updateEvent = action.selfUpdateEvent;
  for ( const item of actor.items ) {
    if ( !item.system.requiresInvestment ) continue;
    if ( !item.system.invested || item.system.equipped ) continue;
    updateEvent.actorUpdates.items.push({_id: item.id, system: {invested: false}});
    updateEvent.itemSnapshots.push(item.snapshot());
  }
}

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
      if ( !target.actor.system.isDead ) target.error ??= _loc("ACTION.WARNINGS.SPECIFIC.REVIVE.RequiresDead");
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
  },
  canUse() {
    const lastAction = ChatMessage.implementation.getLastAction({confirmed: true, actor: this.actor});
    if ( (lastAction?.actor !== this.actor) || !lastAction.tags.has("melee")
      || !lastAction.events.some(e => (e.type === "strike") && e.target.isIncapacitated) ) {
      throw new Error(_loc("ACTION.WARNINGS.MustFollowMeleeKill", {action: this.name}));
    }
  }
};

/* -------------------------------------------- */

HOOKS.secondWind = {
  prepare() {
    this.usage.hasDice = false;
  },
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

HOOKS.shieldCharge = {
  prepare() {
    this.usage.movement.ignoreTokens = true;
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

HOOKS.lightLantern = {
  preActivate() {
    // Validate that the actor has Lantern Oil to consume
    const oil = this.actor.items.find(i => (i.system.identifier === "lanternOil") && (i.system.quantity > 0));
    if ( !oil ) throw new Error(_loc("HOOKS.WARNINGS.NoLanternOil"));

    // Scale ignition duration with the quality of the consumed oil
    const hours = {shoddy: 1, standard: 4, fine: 12, superior: 24, masterwork: 48}[oil.system.quality] ?? 4;
    if ( this.effects[0] ) {
      Object.assign(this.effects[0], {
        _id: "lanternBurning00",
        showIcon: 0 // Never
      });
      this.effects[0].duration.value = hours;
    }

    // Queue oil consumption with a snapshot for reversal
    const updateEvent = this.selfUpdateEvent;
    updateEvent.itemSnapshots.push(oil.snapshot());
    updateEvent.actorUpdates.items.push({_id: oil.id, system: {quantity: oil.system.quantity - 1}});
  }
};

/* -------------------------------------------- */

HOOKS.lightTorch = {
  preActivate() {
    if ( this.effects[0] ) {
      Object.assign(this.effects[0], {
        _id: "torchBurning0000",
        showIcon: 0 // Never
      });
    }
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

HOOKS.throw = {
  _getCaptive() {
    const grappling = this.actor.effects.get(HOOKS.grapple._GRAPPLING_EFFECT_ID);
    const captive = grappling?.origin ? fromUuidSync(grappling.origin) : null;
    return captive?.getActiveTokens(true, true)[0] ?? null;
  },
  prepare() {
    const captive = HOOKS.throw._getCaptive.call(this);
    if ( captive ) this.target.size = Math.ceil(captive.actor.size / 2);
    this.range.maximum = (this.actor.abilities.strength.value * 2) + Math.ceil(this.actor.size / 2);
  },
  canUse() {
    if ( !HOOKS.throw._getCaptive.call(this) ) throw new Error(_loc("ACTIONS.Throw.NotGrappling"));
  },
  acquireTargets(targets) {
    targets.length = 0; // Target the grapple captive, not who was inside the blast
    const captive = HOOKS.throw._getCaptive.call(this);
    if ( captive ) targets.push({token: captive, actor: captive.actor, uuid: captive.actor.uuid,
      name: captive.name});
  },
  async postActivate() {
    const grapple = HOOKS.grapple;
    const captive = this.targets.keys().next().value;
    if ( captive ) {
      this.recordEvent({type: "effect", target: captive,
        effects: [{_id: grapple._GRAPPLED_EFFECT_ID, _action: "delete"}]});
      this.recordEvent({type: "effect", target: this.actor,
        effects: [{_id: grapple._GRAPPLING_EFFECT_ID, _action: "delete"}]});
    }

    // Hurl the target to the placed blast center, only on a successful throw
    const center = this.region?.shapes[0];
    if ( !center ) return;
    const {movement} = crucible.api.canvas;
    const excludeTokens = this.token ? [this.token.id] : undefined;
    for ( const [target, events] of this.eventsByTarget ) {
      if ( (target === this.actor) || !events.isSuccess ) continue;
      const targetToken = this.targets.get(target)?.token?.object;
      if ( !targetToken ) continue;
      const ray = new foundry.canvas.geometry.Ray(targetToken.center, center);
      const plan = await movement.planForcedMovement(targetToken.document, ray,
        {excludeTokens, animationSpeedMultiplier: 2});
      if ( plan ) {
        if ( !plan.collided ) {
          for ( const event of events.all ) {
            if ( event.roll?.data.damage ) event.roll.data.damage.base = event.roll.data.damage.total = 0;
          }
        }
        const {x, y, elevation} = plan.origin;
        this.recordEvent({type: "movement", target, movement: {id: plan.id, origin: {x, y, elevation}}});
      }
    }
  }
};

/* -------------------------------------------- */

HOOKS.tramplingCharge = {
  prepare() {
    this.target.size = this.actor.size;
    this.range.maximum = this.actor.system.movement.stride * 2;
    this.usage.movement.ignoreTokens = true;
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

HOOKS.tumble = {
  prepare() {
    this.usage.movement.ignoreTokens = true;
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

HOOKS.vaultingSweep = {
  prepare() {
    const reach = this.actor.equipment.weapons.mainhand?.system.range ?? 1;
    this.range.maximum = this.actor.system.movement.stride + reach;
    this.target.size = Math.ceil(this.actor.size / 2) + reach;
  },
  async preActivate() {
    const center = this.region?.shapes[0];
    if ( !this.token || !center ) return;
    const gridSize = canvas.grid.size;
    const waypoint = {
      x: center.x - ((this.token.width * gridSize) / 2),
      y: center.y - ((this.token.height * gridSize) / 2),
      action: "jump"
    };
    const plan = await crucible.api.canvas.movement.createMovementPlan(this.token, [waypoint],
      {constrainOptions: {crucible: {ignoreTokens: true}}});
    if ( !plan ) return;
    plan.cost = 0;
    // The movement event's `movement` must be {id, origin}; confirm-time enactment reads event.movement.id
    const {x, y, elevation} = plan.origin;
    this.recordEvent({type: "movement", target: this.actor, movement: {id: plan.id, origin: {x, y, elevation}}});
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
/*  Primalist Elemental Stances                 */
/* -------------------------------------------- */

// Thin shims keyed to each Stance's canonical Rune; validation and effect-stream logic live on the talent hook
// (crucible.api.hooks.talent.primalist0000000)
HOOKS.stormStance = {
  canUse() { return crucible.api.hooks.talent.primalist0000000._canUseStance(this, "lightning"); },
  preActivate() { crucible.api.hooks.talent.primalist0000000._activateStance(this, "lightning"); }
};

HOOKS.cinderStance = {
  canUse() { return crucible.api.hooks.talent.primalist0000000._canUseStance(this, "flame"); },
  preActivate() { crucible.api.hooks.talent.primalist0000000._activateStance(this, "flame"); }
};

HOOKS.waterStance = {
  canUse() { return crucible.api.hooks.talent.primalist0000000._canUseStance(this, "frost"); },
  preActivate() { crucible.api.hooks.talent.primalist0000000._activateStance(this, "frost"); }
};

HOOKS.stoneStance = {
  canUse() { return crucible.api.hooks.talent.primalist0000000._canUseStance(this, "earth"); },
  preActivate() { crucible.api.hooks.talent.primalist0000000._activateStance(this, "earth"); }
};

/* -------------------------------------------- */

export default HOOKS;

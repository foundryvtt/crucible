import AttackRoll from "../dice/attack-roll.mjs";
import CrucibleAction from "../models/action.mjs";
import CrucibleSpellAction from "../models/spell-action.mjs";
const {DialogV2} = foundry.applications.api;

/**
 * @import {TRAINING_TYPES} from "../const/talents.mjs";
 */

/**
 * @typedef {Object}   ActorRoundStatus
 * @property {boolean} hasMoved
 * @property {boolean} hasAttacked
 * @property {boolean} wasAttacked
 */

/**
 * The Actor document subclass in the Crucible system which extends the behavior of the base Actor class.
 */
export default class CrucibleActor extends Actor {
  constructor(...args) {
    super(...args);
    this.#updateCachedResources();
  }

  /**
   * The Actions which this Actor has available to use.
   */
  get actions() {
    return this.system.actions;
  }

  /**
   * The ancestry of the Actor.
   * @returns {*}
   */
  get ancestry() {
    return this.system.details.ancestry;
  }

  /**
   * The prepared object of actor attributes
   * @type {object}
   */
  get abilities() {
    return this.system.abilities;
  }

  /**
   * The background of the Actor.
   * @returns {*}
   */
  get background() {
    return this.system.details.background;
  }

  /**
   * If this Actor has a singular Combatant in the current Combat encounter, return it.
   * @type {Combatant|null}
   */
  get combatant() {
    const combatants = game.combat?.getCombatantsByActor(this);
    return combatants.length === 1 ? combatants[0] : null;
  }

  /**
   * The prepared object of actor defenses
   * @type {object}
   */
  get defenses() {
    return this.system.defenses;
  }

  /**
   * Current equipment state for the Actor.
   */
  get equipment() {
    return this.system.equipment;
  }

  /**
   * Known spells and spellcraft components for the Actor.
   */
  get grimoire() {
    return this.system.grimoire;
  }

  /**
   * Actor resources.
   * @returns {Record<string, {value: number, max: number}>}
   */
  get resources() {
    return this.system.resources;
  }

  /** @inheritDoc */
  get inCombat() {
    return super.inCombat && game.combat.started;
  }

  /**
   * Is this actor currently "level zero"
   * @returns {boolean}
   */
  get isL0() {
    return this.system.advancement.level === 0;
  }

  /**
   * Is this Actor incapacitated and unable to act?
   * @type {boolean}
   */
  get isIncapacitated() {
    return this.system.isIncapacitated;
  }

  /**
   * A convenience reference to the Actor level.
   * @type {number}
   */
  get level() {
    return this.system.advancement.level;
  }

  /**
   * Adjusted threat level of this Actor.
   * @type {number}
   */
  get threat() {
    return this.system.advancement.threat;
  }


  get points() {
    return this.system.points;
  }

  /**
   * The prepared object of actor resistances
   * @returns {object}
   */
  get resistances() {
    return this.system.resistances;
  }

  /**
   * The prepared object of actor skills
   * @returns {object}
   */
  get skills() {
    return this.system.skills;
  }

  /**
   * A convenience reference to the size of the Actor.
   * @type {number}
   */
  get size() {
    return this.system.movement.size;
  }

  /**
   * The prepared object of actor status data
   * @returns {ActorRoundStatus}
   */
  get status() {
    return this.system.status;
  }

  /**
   * The IDs of purchased talents.
   * A convenience reference to CrucibleBaseActor#talentIds
   */
  get talentIds() {
    return this.system.talentIds;
  }

  /**
   * The tracked action history for this Actor.
   * The array is ordered with most-recent first.
   * @returns {CrucibleActionHistoryEntry[]}
   */
  get actionHistory() {
    return this.flags.crucible?.actionHistory || [];
  }

  /**
   * The last confirmed action used by this Actor.
   * @type {CrucibleAction|null}
   */
  get lastConfirmedAction() {
    const history = this.flags.crucible?.actionHistory || [];
    for ( const record of history ) {
      const message = game.messages.get(record.messageId);
      if ( !message ) continue;
      const {action, confirmed} = message.flags.crucible;
      if ( action && confirmed ) {
        if ( this.#lastConfirmedAction.messageId !== message.id ) {
          this.#lastConfirmedAction.messageId = message.id;
          this.#lastConfirmedAction
           = {messageId: message.id, action: CrucibleAction.fromChatMessage(message)};
        }
        return this.#lastConfirmedAction.action;
      }
    }
    return null;
  }

  #lastConfirmedAction = {messageId: null, action: null};

  /**
   * Track any groups that this Actor belongs to.
   * This is populated during data preparation of group actors.
   * @type {Set<CrucibleActor>}
   * @internal
   */
  _groups = new Set();

  /**
   * Prior resource values that can be used to establish diffs.
   * This is stored on the Actor because the system data object is reconstructed each time preparation occurs.
   * @type {Record<string, number|boolean>}
   * @internal
   */
  _cachedResources = {};

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritdoc */
  applyActiveEffects() {
    // Before applying active effects, apply data based on prepared embedded Item documents
    const items = this.itemTypes;
    this.system.prepareItems(items);
    super.applyActiveEffects();
  };

  /* -------------------------------------------- */
  /*  Talent Hooks                                */
  /* -------------------------------------------- */

  /**
   * Call all actor hooks registered for a certain event name.
   * Each registered function is called in sequence.
   * @param {string} hook     The hook name to call.
   * @param {...*} args       Arguments passed to the hooked function
   */
  callActorHooks(hook, ...args) {
    const hookConfig = SYSTEM.ACTOR.HOOKS[hook];
    if ( !hookConfig ) throw new Error(`Invalid Actor hook function "${hook}"`);
    const hooks = this.system.actorHooks[hook] ||= [];
    for ( const {item, fn} of hooks ) {
      if ( CONFIG.debug.crucibleHooks ) console.debug(`Calling ${hook} hook for Item ${item.name}`);
      try {
        fn.call(this, item, ...args);
      } catch(err) {
        const msg = `The "${hook}" hook defined by Item "${item.uuid}" failed evaluation in Actor [${this.id}]`;
        console.error(msg, err);
      }
    }
  }

  /* -------------------------------------------- */
  /*  Dice Rolling Methods                        */
  /* -------------------------------------------- */

  /**
   * Compute the ability score bonus for a given scaling mode.
   * @param {string|string[]} scaling   How is the ability bonus computed?
   * @param {number} [divisor=2]        The divisor that determines the bonus
   * @returns {number}                  The ability bonus
   */
  getAbilityBonus(scaling, divisor=2) {
    if ( typeof scaling === "string" ) scaling = scaling.split(".");
    const abilities = this.system.abilities;
    return Math.round(scaling.reduce((x, t) => x + abilities[t].value, 0) / (scaling.length * divisor));
  }

  /* -------------------------------------------- */

  /**
   * Configure a standard set of boons and banes conditional on the actor of an Action.
   * @param {CrucibleAction} action
   * @param {CrucibleActionOutcome} outcome
   * @internal
   */
  _configureActorOutcome(action, outcome) {
    const {boons, banes} = outcome.usage;
    const {isAttack=false} = action.usage;

    // Global conditions
    if ( this.statuses.has("broken") ) banes.broken = {label: "Broken", number: 2};

    // Attack-related conditions
    if ( isAttack ) {
      if ( this.statuses.has("blinded") ) banes.blind = {label: "Blinded", number: 2};
      if ( this.statuses.has("prone") ) banes.prone = {label: "Prone", number: 1};
      if ( this.statuses.has("restrained") ) banes.restrained = {label: "Restrained", number: 2};
    }

    // Temporary boons and banes stored as Actor rollBonuses
    const rollBonuses = this.system.rollBonuses;
    for ( const [id, boon] of Object.entries(rollBonuses.boons) ) {
      if ( id in boons ) boons[id].number = Math.max(boons[id].number, boon.number);
      else boons[id] = boon;
    }
    for ( const [id, bane] of Object.entries(rollBonuses.banes) ) {
      if ( id in banes ) banes[id].number = Math.max(banes[id].number, bane.number);
      else banes[id] = bane;
    }
  }

  /* -------------------------------------------- */

  /**
   * Configure a standard set of boons and banes conditional on the target of an Action.
   * @param {CrucibleAction} action
   * @param {CrucibleActionOutcome} outcome
   * @internal
   */
  _configureTargetOutcome(action, outcome) {
    const {boons, banes} = outcome.usage;
    const {isAttack=false, isRanged=false} = action.usage;

    // Attack-related conditions
    if ( isAttack ) {
      if ( this.statuses.has("blinded") ) boons.blind = {label: "Blinded", number: 2};
      if ( this.statuses.has("guarded") ) banes.guarded = {label: "Guarded", number: 1};
      if ( this.statuses.has("prone") ) {
        if ( isRanged ) banes.prone = {label: "Prone", number: 1};
        else boons.prone = {label: "Prone", number: 1};
      }
      if ( this.statuses.has("flanked") && !isRanged ) {
        const ae = this.effects.get(SYSTEM.EFFECTS.getEffectId("flanked"));
        boons.flanked = {label: "Flanked", number: ae?.getFlag("crucible", "flanked") ?? 1};
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Get a creature's effective resistance against a certain damage type dealt to a certain resource.
   * @param {string} resource       The resource targeted in SYSTEM.RESOURCES
   * @param {string} damageType     The damage type dealt in SYSTEM.DAMAGE_TYPES
   * @param {boolean} [restoration=false] Does the ability cause restoration?
   */
  getResistance(resource, damageType, restoration=false) {
    if ( restoration ) return 0;
    let r = this.resistances[damageType]?.total ?? 0;
    switch ( resource ) {
      case "health":
        if ( this.statuses.has("invulnerable") ) r = Infinity
        break;
      case "morale":
        if ( this.statuses.has("resolute") || this.statuses.has("asleep") ) r = Infinity;
        break;
    }
    return r;
  }

  /* -------------------------------------------- */

  /**
   * Get the action cost of performing a certain movement.
   * @param {number} costFeet     The cost of the movement in feet, inclusive of difficult terrain and other modifiers.
   * @param {object} options      Options which modify cost calculation
   * @param {boolean} [options.useFreeMove] Consume a free move, if available
   * @returns {{cost: number, useFreeMove: boolean}}
   */
  getMovementActionCost(costFeet, {useFreeMove=true}={}) {
    if ( costFeet <= 0 ) return {distance: costFeet, cost: 0, useFreeMove: false};
    const stride = this.system.movement.stride ?? 8;
    let ap = Math.ceil(costFeet / stride);
    const useFree = useFreeMove && this.system.hasFreeMove;
    if ( useFree ) ap -= 1;
    return {distance: costFeet, cost: ap, useFreeMove: useFree};
  }

  /* -------------------------------------------- */

  /**
   * Use the Movement action to travel a certain measured distance.
   * @param {number} costFeet     The cost of the movement in feet, inclusive of difficult terrain and other modifiers.
   * @param {CrucibleActionUsageOptions} options  Options passed to CrucibleAction#use
   * @param {boolean} [options.useFreeMove]       Consume a free move, if available
   * @param {TokenMovementOperation} [options.movement] A recorded movement ID in Token movement history
   * @param {Set<string>} [options.actions]       The movement actions used as part of this move
   * @returns {CrucibleAction}    The performed Action
   */
  async useMove(costFeet, {useFreeMove=true, movement, actions, ...useOptions}={}) {

    // Annotate movement actions.
    actions ||= new Set(["walk"]);
    const actionLabels = [];
    const actionDescriptions = [];
    for ( const a of actions ) {
      const cfg = CONFIG.Token.movement.actions[a];
      if ( !cfg ) continue;
      const label = game.i18n.localize(cfg.label);
      const desc = game.i18n.localize(`TOKEN.MOVEMENT.ACTIONS.${a}.description`);
      actionLabels.push(label);
      actionDescriptions.push(`<p><strong>${label}:</strong> ${desc}</p>`);
    }

    // Record movement usage
    const usage = {
      id: movement?.id || null,
      actions,
      ...this.getMovementActionCost(costFeet, {useFreeMove})
    };

    // Adjust action name and description
    const move = this.actions.move;
    const action = move.clone({
      name: `${move._source.name} (${actionLabels.join(", ")})`,
      description: `<p>${move._source.description}</p>${actionDescriptions.join("")}`
    });
    action.usage.movement = usage;
    await action.use(useOptions);
  }

  /* -------------------------------------------- */

  /**
   * Create a skill check for the Actor.
   * @param {string} skillId
   * @param {object} options
   * @param [options.banes]
   * @param [options.boons]
   * @param [options.dc]
   * @param [options.passive]
   * @returns {PassiveCheck|StandardCheck}
   */
  getSkillCheck(skillId, {banes=0, boons=0, dc=20, passive=false}={}) {
    const skill = this.system.skills[skillId];
    if ( !skill ) throw new Error(`Invalid skill ID ${skillId}`);
    const {boons: systemBoons={}, banes: systemBanes={}} = this.system.rollBonuses;

    // Prepare check data
    const rollData = {
      passive,
      actorId: this.id,
      banes: {...systemBanes},
      boons: {...systemBoons},
      dc: dc,
      ability: skill.abilityBonus,
      skill: skill.skillBonus,
      enchantment: skill.enchantmentBonus,
      type: skillId
    };
    if ( boons ) rollData.boons.special = {label: "Special", number: boons};
    if ( banes ) rollData.banes.special = {label: "Special", number: banes};

    // Apply talent hooks
    this.callActorHooks("prepareStandardCheck", rollData);
    this.callActorHooks("prepareSkillCheck", skill, rollData);

    // Create Roll
    const rollCls = passive ? crucible.api.dice.PassiveCheck : crucible.api.dice.StandardCheck;
    return new rollCls(rollData);
  }

  /* -------------------------------------------- */

  /**
   * Test whether an Actor has a specific knowledge type.
   * @param {string} knowledgeId
   * @returns {boolean}
   */
  hasKnowledge(knowledgeId) {
    if ( this.type !== "hero" ) return false; // Relax this assumption eventually?
    return this.system.details.background.knowledge.has(knowledgeId);
  }

  /* -------------------------------------------- */

  /**
   * Roll a skill check for a given skill ID.
   *
   * @param {string} skillId      The ID of the skill to roll a check for, for example "stealth"
   * @param {number} [banes]      A number of special banes applied to the roll, default is 0
   * @param {number} [boons]      A number of special boons applied to the roll, default is 0
   * @param {number} [dc]         A known target DC
   * @param {string} [rollMode]   The roll visibility mode to use, default is the current dropdown choice
   * @param {boolean} [dialog]    Display a dialog window to further configure the roll. Default is false.
   *
   * @return {StandardCheck}      The StandardCheck roll instance which was produced.
   */
  async rollSkill(skillId, {banes=0, boons=0, dc, rollMode, dialog=false}={}) {
    const check = this.getSkillCheck(skillId, {banes, boons, dc, passive: false});

    // Prompt the user with a roll dialog
    const flavor = game.i18n.format("SKILL.RollFlavor", {name: this.name, skill: SYSTEM.SKILLS[skillId].label});
    if ( dialog ){
      const response = await check.dialog({flavor, rollMode});
      if ( response === null ) return null;
    }

    // Execute the roll to chat
    await check.toMessage({flavor, flags: {crucible: {skill: skillId}}});
    return check;
  }

  /* -------------------------------------------- */

  /**
   * Test the Actor's defense, determining which defense type is used to avoid an attack.
   * @param {string} defenseType      The defense type to test
   * @param {AttackRoll} roll         The AttackRoll instance
   * @returns {AttackRoll.RESULT_TYPES}
   */
  testDefense(defenseType, roll) {
    const d = this.system.defenses;
    const s = this.system.skills;
    if ( (defenseType !== "physical") && !(defenseType in d) && !(defenseType in s) ) {
      throw new Error(`Invalid defense type "${defenseType}" passed to Actor#testDefense`);
    }
    if ( !(roll instanceof AttackRoll) ) {
      throw new Error("You must pass an AttackRoll instance to Actor#testDefense");
    }
    const results = AttackRoll.RESULT_TYPES;
    let dc;

    // Physical Defense
    if ( defenseType === "physical" ) {
      dc = d.physical.total;

      // Hit
      if ( roll.total > dc ) return results.HIT;

      // Dodge
      const r = foundry.dice.MersenneTwister.random() * d.physical.total;
      const dodge = d.dodge.total;
      if ( r <= dodge ) return results.DODGE;

      // Parry
      const parry = dodge + d.parry.total;
      if ( r <= parry ) return results.PARRY;

      // Block
      const block = dodge + d.block.total;
      if ( r <= block ) return results.BLOCK;

      // Armor
      return roll.isCriticalFailure ? results.ARMOR : results.GLANCE;
    }

    // Other Defenses
    if ( defenseType in s ) dc = s[defenseType].passive;
    else dc = d[defenseType].total;
    if ( roll.total > dc ) return AttackRoll.RESULT_TYPES.HIT;
    else return AttackRoll.RESULT_TYPES.RESIST;
  }

  /* -------------------------------------------- */

  /**
   * Use an available Action.
   * @param {string} actionId     The action to use
   * @param {object} [options]    Options which configure action usage
   * @returns {Promise<Roll[]>}
   */
  async useAction(actionId, options={}) {
    const action = this.actions[actionId];
    if ( !action ) throw new Error(`Action ${actionId} does not exist in Actor ${this.id}`);
    return action.use({dialog: true, ...options, token: this.token});
  }

  /* -------------------------------------------- */

  /**
   * A wrapper around CrucibleActor#useAction which encapsulates some Macro hotbar behaviors.
   * @param {CrucibleActor} actor   The Actor which should take action
   * @param {string} actionId       The Action ID to be performed
   * @returns {Promise<void>}
   */
  static async macroAction(actor, actionId) {
    if ( !actor ) return ui.notifications.warn("You must have a Token controlled to use this Macro");
    let action = actor.actions[actionId];
    if ( !action && actionId.startsWith("spell.") ) action = CrucibleSpellAction.fromId(actionId, {actor});
    if ( !action ) return ui.notifications.warn(`Actor "${actor.name}" does not have the action "${actionId}"`);
    await action.use();
  }

  /* -------------------------------------------- */

  /**
   * Perform a spell attack as part of an action outcome.
   * @param {CrucibleSpellAction} spell
   * @param {CrucibleActionOutcome} outcome
   * @returns {Promise<AttackRoll|null>}
   */
  async spellAttack(spell, outcome) {
    if ( !spell.usage.hasDice ) return null;
    const target = outcome.target;
    if ( !(target instanceof CrucibleActor) ) throw new Error("You must define a target Actor for the spell.");

    // TODO get rid of action.usage here in favor of outcome.usage
    const boons = {...spell.usage.boons, ...outcome.usage.boons};
    const banes = {...spell.usage.banes, ...outcome.usage.banes};
    const defenseType = outcome.usage.defenseType || spell.defense;

    // Prepare Roll Data
    const rollData = {
      actorId: this.id,
      spellId: spell.id,
      target: target.uuid,
      ability: this.getAbilityBonus(spell.scaling),
      skill: 0,
      enchantment: 0,
      banes, boons,
      defenseType,
      dc: target.defenses[defenseType].total
    }

    // Call talent hooks
    this.callActorHooks("prepareStandardCheck", rollData);
    this.callActorHooks("prepareSpellAttack", spell, target, rollData);
    target.callActorHooks("defendAttack", spell, this, rollData);

    // Create the Attack Roll instance
    const roll = new AttackRoll(rollData);

    // Evaluate the result and record the result
    await roll.evaluate();
    const r = roll.data.result = target.testDefense(defenseType, roll);

    // Structure damage
    if ( r < AttackRoll.RESULT_TYPES.GLANCE ) return roll;
    roll.data.damage = {
      overflow: roll.overflow,
      multiplier: spell.damage.multiplier ?? 1,
      base: spell.damage.base,
      bonus: (spell.damage.bonus ?? 0) + (this.system.rollBonuses.damage?.[spell.damage.type] ?? 0),
      resistance: target.getResistance(spell.rune.resource, spell.damage.type, spell.damage.restoration),
      resource: spell.rune.resource,
      type: spell.damage.type,
      restoration: spell.damage.restoration
    };
    roll.data.damage.total = CrucibleAction.computeDamage(roll.data.damage);
    target.callActorHooks("receiveAttack", spell, roll);
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Cause this Actor to be the recipient of an environmental hazard attack.
   * @param {object} hazardData
   * @returns {Promise<CrucibleAction>}
   */
  async hazardAttack(hazardData) {
    const action = CrucibleAction.createHazard(this, hazardData);
    return action.use();
  }

  /* -------------------------------------------- */

  /**
   * Cause this actor to receive the effects of an Action.
   * This is used for cases like environmental hazards where the incoming action is not caused by a specific Actor.
   * @param {CrucibleAction} action
   * @returns {Promise<AttackRoll>}
   */
  async receiveAttack(action) {
    if ( !(action instanceof CrucibleAction) ) throw new Error("The provided action must be a CrucibleAction instance");
    const {bonuses, damageType, defenseType, resource} = action.usage;
    const roll = new AttackRoll({
      actorId: this.id,
      target: this.uuid,
      ability: bonuses.ability,
      skill: bonuses.skill,
      enchantment: bonuses.enchantment,
      defenseType,
      dc: this.defenses[defenseType].total
    });
    await roll.evaluate();

    // Structure damage result
    const r = roll.data.result = this.testDefense(defenseType, roll);
    if ( r < AttackRoll.RESULT_TYPES.GLANCE ) return roll;
    roll.data.damage = {
      overflow: roll.overflow,
      multiplier: 1,
      base: 0,
      bonus: 0,
      resistance: this.getResistance(resource, damageType),
      type: damageType,
      resource: resource,
      restoration: false
    };
    roll.data.damage.total = CrucibleAction.computeDamage(roll.data.damage);
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Perform a Skill Attack targeting a specific creature.
   * @param {CrucibleAction} action           The Skill Attack action being performed
   * @param {CrucibleActionOutcome} outcome   The outcome this attack belongs to
   * @returns {Promise<AttackRoll|null>}      A created AttackRoll instance or null
   */
  async skillAttack(action, outcome) {
    const target = outcome.target;

    // TODO get rid of action.usage here in favor of outcome.usage
    let {bonuses, damageType, restoration, resource, skillId} = action.usage;
    const boons = {...action.usage.boons, ...outcome.usage.boons};
    const banes = {...action.usage.banes, ...outcome.usage.banes};
    let defenseType = outcome.usage.defenseType || action.usage.defenseType;
    let dc;
    if ( defenseType in target.defenses ) dc = target.defenses[defenseType].total;
    else {
      defenseType = skillId;
      dc = action.usage.dc ?? target.skills[skillId].passive;
    }

    // Prepare Roll data
    const rollData = Object.assign({}, bonuses, {
      actorId: this.id,
      type: skillId,
      target: target.uuid,
      boons,
      banes,
      defenseType,
      dc
    });

    // Apply talent hooks
    this.callActorHooks("prepareStandardCheck", rollData);
    this.callActorHooks("prepareSkillAttack", action, target, rollData);
    target.callActorHooks("defendAttack", action, this, rollData);

    // Create and evaluate the skill attack roll
    const roll = new game.system.api.dice.AttackRoll(rollData);
    await roll.evaluate();
    roll.data.result = target.testDefense(defenseType, roll);

    // Create resulting damage
    if ( roll.data.result === AttackRoll.RESULT_TYPES.HIT ) {
      roll.data.damage = {
        overflow: roll.overflow,
        multiplier: bonuses.multiplier,
        base: bonuses.skill + (bonuses.base ?? 0),
        bonus: bonuses.damageBonus,
        resistance: target.getResistance(resource, damageType, restoration),
        type: damageType,
        resource: resource,
        restoration
      };
      roll.data.damage.total = CrucibleAction.computeDamage(roll.data.damage);
    }
    target.callActorHooks("receiveAttack", action, roll);
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Perform an Action which makes an attack using a Weapon.
   * @param {CrucibleAction} action         The action being performed
   * @param {CrucibleItem} [weapon]         The weapon used in the attack
   * @param {CrucibleActionOutcome} outcome The action outcome this attack belongs to
   * @returns {Promise<AttackRoll|null>}    An evaluated attack roll, or null if no attack is performed
   */
  async weaponAttack(action, weapon, outcome) {
    if ( !(weapon instanceof crucible.api.documents.CrucibleItem) || (weapon?.type !== "weapon") ) {
      throw new Error(`Weapon attack Action "${action.name}" did not specify which weapon is used in the attack`);
    }
    const target = outcome.target;
    // TODO get rid of action.usage here in favor of outcome.usage
    const boons = {...action.usage.boons, ...outcome.usage.boons};
    const banes = {...action.usage.banes, ...outcome.usage.banes};
    const defenseType = outcome.usage.defenseType || action.usage.defenseType || "physical";

    // Compose roll data
    const {ability, skill, enchantment} = weapon.system.actionBonuses;
    const rollData = {
      actorId: this.id,
      itemId: weapon.id,
      target: target.uuid,
      ability,
      skill,
      enchantment,
      banes, boons,
      defenseType,
      dc: target.defenses[defenseType].total,
      criticalSuccessThreshold: weapon.system.properties.has("keen") ? 4 : 6,
      criticalFailureThreshold: weapon.system.properties.has("reliable") ? 4 : 6
    }

    // Call talent hooks
    this.callActorHooks("prepareStandardCheck", rollData);
    this.callActorHooks("prepareWeaponAttack", action, target, rollData);
    target.callActorHooks("defendAttack", action, this, rollData);

    // Create and evaluate the AttackRoll instance
    const roll = new AttackRoll(rollData);
    await roll.evaluate();
    const r = roll.data.result = target.testDefense(defenseType, roll);

    // Structure damage
    if ( r < AttackRoll.RESULT_TYPES.GLANCE ) return roll;
    roll.data.damage = weapon.system.getDamage(this, action, target, roll);
    roll.data.damage.total = CrucibleAction.computeDamage(roll.data.damage);

    // Finalize the attack and return
    target.callActorHooks("receiveAttack", action, roll);
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Delay your turn in combat, dropping to a lower initiative value
   * @param {number} initiative       The target initiative to which the actor is delaying
   * @param {object} actorUpdates     Additional actor updates that should be persisted as part of the delay action
   * @returns {Promise<void>}
   */
  async delay(initiative, actorUpdates={}) {
    const combatant = this.combatant;
    if ( !combatant ) throw new Error(`Actor [${this.id}] does not have a single Combatant in the current Combat.`);
    const maximum = combatant.getDelayMaximum();
    if ( !initiative || !Number.isInteger(initiative) || !initiative.between(1, maximum) ) {
      throw new Error(`You may only delay to an initiative value between 1 and ${maximum}`);
    }
    await this.update(foundry.utils.mergeObject(actorUpdates, {"flags.crucible.delay": {
        round: game.combat.round,
        from: combatant.initiative,
        to: initiative
      }
    }));
    await game.combat.update({turn: game.combat.turn, combatants: [{_id: combatant.id, initiative}]}, {diff: false});
  }

  /* -------------------------------------------- */

  /**
   * Perform the Recover action, restoring resource pools.
   * @param {object} [updateData={}]      Additional update data to include in the recover operation
   * @param {object} [options={}]         Options which modify the recover
   * @param {boolean} [options.allowDead=false]   Allow dead actors to recover?
   * @returns {Promise<void>}
   */
  async recover(updateData={}, {allowDead=false}={}) {
    if ( (this.system.isDead || this.system.isInsane) && !allowDead ) return;

    // Expire Active Effects
    const toDeleteEffects = this.effects.reduce((arr, effect) => {
      const s = effect.duration.seconds;
      if ( effect.id === "weakened00000000" ) arr.push(effect.id);
      else if ( effect.id === "broken0000000000" ) arr.push(effect.id);
      else if ( s && (s <= SYSTEM.TIME.recoverSeconds) ) arr.push(effect.id);
      return arr;
    }, []);
    await this.deleteEmbeddedDocuments("ActiveEffect", toDeleteEffects);

    // Recover Resources
    await this.update(foundry.utils.mergeObject(this.#getRecoveryData(), updateData));
  }

  /* -------------------------------------------- */

  /**
   * Restore all resource pools to their maximum value.
   * @param {object} [updateData={}]      Additional update data to include in the rest operation
   * @param {object} [options={}]         Options which modify the rest
   * @param {boolean} [options.allowDead=false]   Allow dead actors to rest?
   * @returns {Promise<void>}
   */
  async rest(updateData={}, {allowDead=false}={}) {
    if ( (this.system.isDead || this.system.isInsane) && !allowDead ) return;

    // Prepare Rest data
    const restData = this.#getRecoveryData();
    if ( this.type === "hero" ) {
      const {wounds, madness} = this.system.resources;
      restData.system.resources.wounds = {value: Math.max(wounds.value - this.level, 0)};
      restData.system.resources.madness = {value: Math.max(madness.value - this.level, 0)};
    }

    // Expire Active Effects
    const toDeleteEffects = this.effects.reduce((arr, effect) => {
      const s = effect.duration.seconds;
      if ( effect.id === "weakened00000000" ) arr.push(effect.id);
      else if ( effect.id === "broken0000000000" ) arr.push(effect.id);
      else if ( !s || (s <= SYSTEM.TIME.restSeconds) ) arr.push(effect.id);
      return arr;
    }, []);
    await this.deleteEmbeddedDocuments("ActiveEffect", toDeleteEffects);

    // Recover Resources
    await this.update(foundry.utils.mergeObject(restData, updateData));
  }

  /* -------------------------------------------- */

  /**
   * Prepare an object that replenishes all resource pools to their current maximum level
   * @returns {object}
   */
  #getRecoveryData() {
    const updates = {system: {resources: {}, status: null}};
    for ( let [id, resource] of Object.entries(this.system.resources) ) {
      const cfg = SYSTEM.RESOURCES[id];
      if ( !cfg || (cfg.type === "reserve") ) continue;
      updates.system.resources[id] = {value: resource.max};
    }
    updates.system.resources.heroism = {value: 0};
    return updates;
  }

  /* -------------------------------------------- */

  /**
   * Alter the resource pools of the actor using an object of change data
   * @param {Object<string, number>} deltas       Changes where the keys are resource names and the values are deltas
   * @param {object} [updates]                    Other Actor updates to make as part of the same transaction
   * @param {object} [options]                    Options which are forwarded to the update method
   * @param {boolean} [options.reverse]             Reverse the direction of change?
   * @param {object[]} [options.statusText]         Custom status text displayed alongside the update
   * @returns {Promise<CrucibleActor>}            The updated Actor document
   */
  async alterResources(deltas, updates={}, {reverse=false, statusText}={}) {
    const r = this.system.resources;

    // Apply resource updates
    const changes = {};
    for ( let [resourceName, delta] of Object.entries(deltas) ) {
      if ( !(resourceName in r) ) continue;
      if ( !(resourceName in changes) ) changes[resourceName] = {value: 0};
      if ( reverse ) delta *= -1;
      let resource = r[resourceName];

      // Handle Infinity
      if ( delta === Infinity ) {
        changes[resourceName] = {value: 999999};
        continue;
      }
      else if ( delta === -Infinity ) {
        changes[resourceName] = {value: -999999};
        continue;
      }

      // Frightened and Diseased
      switch ( resourceName ) {
        case "action":
          if ( this.isIncapacitated ) delta = Math.min(delta, 0);
          break;
        case "health":
          if ( this.statuses.has("diseased") ) delta = Math.min(delta, 0);
          break;
        case "morale":
          if ( this.statuses.has("frightened") ) delta = Math.min(delta, 0);
      }

      // Handle overflow
      const uncapped = resource.value + delta;
      const overflow = Math.min(uncapped, 0);

      // Health overflows into Wounds
      if ( (resourceName === "health") && (overflow !== 0) && ("wounds" in r) ) {
        changes.wounds ||= {value: r.wounds.value};
        changes.wounds.value -= overflow;
      }

      // Morale overflows into Madness
      else if ( (resourceName === "morale") && (overflow !== 0) && ("madness" in r) ) {
        changes.madness ||= {value: r.madness.value};
        changes.madness.value -= overflow;
      }

      // Regular updates
      changes[resourceName].value = uncapped;
    }

    // Constrain and merge changes
    for ( const [id, obj] of Object.entries(changes) ) {
      obj.value = Math.clamp(obj.value, 0, r[id].max);
    }
    updates = foundry.utils.mergeObject(updates, {"system.resources": changes});
    return this.update(updates, {statusText});
  }

  /* -------------------------------------------- */

  /**
   * Toggle a named status active effect for the Actor
   * @param {string} statusId     The status effect ID to toggle
   * @param {boolean} active      Should the effect be active?
   * @param {boolean} overlay     Should the effect be an overlay?
   * @returns {Promise<ActiveEffect|undefined>}
   */
  async toggleStatusEffect(statusId, {active=true, overlay=false}={}) {
    const effectData = CONFIG.statusEffects.find(e => e.id === statusId);
    if ( !effectData ) return;
    const existing = this.effects.find(e => e.statuses.has(effectData.id));

    // No changes needed
    if ( !active && !existing ) return;
    if ( active && existing ) return existing.update({"flags.core.overlay": overlay});

    // Remove an existing effect
    if ( !active && existing ) return existing.delete();

    // Add a new effect
    else if ( active ) {
      const createData = foundry.utils.mergeObject(effectData, {
        _id: SYSTEM.EFFECTS.getEffectId(statusId),
        name: game.i18n.localize(effectData.name),
        statuses: [statusId]
      }, {inplace: false});
      if ( overlay ) createData["flags.core.overlay"] = true;
      await ActiveEffect.create(createData, {parent: this, keepId: true});
    }
  }

  /* -------------------------------------------- */
  /*  Action Outcome Management                   */
  /* -------------------------------------------- */

  /**
   * Deal damage to a target. This method requires ownership of the target Actor.
   * Applies resource changes to both the initiating Actor and to affected Targets.
   * @param {CrucibleAction} action             The Action being applied
   * @param {CrucibleActionOutcome} outcome     The Action outcome
   * @param {object} [options]                  Options which affect how damage is applied
   * @param {boolean} [options.reverse]           Reverse damage instead of applying it
   */
  async applyActionOutcome(action, outcome, {reverse=false}={}) {
    const wasWeakened = this.system.isWeakened;
    const wasBroken = this.system.isBroken;
    const wasIncapacitated = this.isIncapacitated;

    // Call outcome confirmation actor hooks
    this.callActorHooks("confirmAction", action, outcome, {reverse});

    // Apply changes to the Actor
    await this.alterResources(outcome.resources, outcome.actorUpdates, {reverse, statusText: outcome.statusText});
    await this.#applyOutcomeEffects(outcome, reverse);

    // Record target state changes
    if ( this.system.isWeakened && !wasWeakened ) outcome.weakened = true;
    if ( this.system.isBroken && !wasBroken ) outcome.broken = true;
    if ( this.isIncapacitated && !wasIncapacitated ) outcome.incapacitated = true;
  }

  /* -------------------------------------------- */

  /**
   * Apply or reverse ActiveEffect changes occurring through an action outcome.
   * @param {CrucibleActionOutcome} outcome     The action outcome
   * @param {boolean} reverse                   Reverse the effects instead of applying them?
   * @returns {Promise<void>}
   */
  async #applyOutcomeEffects(outcome, reverse=false) {

    // Reverse effects
    if ( reverse ) {
      const deleteEffectIds = outcome.effects.reduce((arr, e) => {
        if ( this.effects.has(e._id) ) arr.push(e._id);
        return arr;
      }, []);
      await this.deleteEmbeddedDocuments("ActiveEffect", deleteEffectIds);
      return;
    }

    // Create new effects or update existing ones
    const toCreate = [];
    const toUpdate = [];
    const toDelete = [];
    for ( const effectData of outcome.effects ) {
      const existing = this.effects.get(effectData._id);
      if ( existing && effectData._delete ) toDelete.push(effectData._id);
      else if ( existing ) toUpdate.push(effectData);
      else toCreate.push(effectData);
    }
    await this.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    await this.updateEmbeddedDocuments("ActiveEffect", toUpdate);
    await this.createEmbeddedDocuments("ActiveEffect", toCreate, {keepId: true});
  }

  /* -------------------------------------------- */

  /**
   * Additional steps taken when this Actor deals damage to other targets.
   * @param {CrucibleAction} action                The action performed
   * @param {CrucibleActionOutcomes} outcomes      The action outcomes that occurred
   */
  onDealDamage(action, outcomes) {
    const self = outcomes.get(this);
    for ( const outcome of outcomes.values() ) {
      if ( outcome === self ) continue;
      if ( outcome.criticalSuccess ) {
        this.callActorHooks("applyCriticalEffects", action, outcome, self);
      }
    }
  }

  /* -------------------------------------------- */
  /*  Combat Encounters and Turn Order            */
  /* -------------------------------------------- */

  /**
   * Actions that occur at the beginning of an Actor's turn in Combat.
   * This method is only called for one User who has ownership permission over the Actor.
   *
   * Turn start workflows proceed in the following order:
   * 1. Damage-Over-Time effects are applied
   * 2. Active Effects are expired or gained
   * 3. Resource recovery occurs
   * @returns {Promise<void>}
   */
  async onStartTurn() {

    // Re-prepare data and re-render the actor sheet
    this.reset();
    this._sheet?.render(false);

    // Skip cases where the actor delayed, and it is now their turn again
    const {round, from, to} = this.flags.crucible?.delay || {};
    if ( from && (round === game.combat.round) && (game.combat.combatant?.initiative === to) ) return;

    // Plan actor changes
    const statusText = [];
    const resourceRecovery = {action: Infinity};
    if ( this.statuses.has("unaware") ) statusText.push({
      text: game.i18n.localize("ACTIVE_EFFECT.STATUSES.Unaware"),
      fillColor: SYSTEM.RESOURCES.action.color.css
    });
    const actorUpdates = {
      system: {status: null},
      flags: {
        crucible: {
          actionHistory: []
        }
      }
    };

    // Identify expiring effects
    const effectChanges = {toCreate: [], toUpdate: [], toDelete: []};
    this.#updateStartTurnEffects(effectChanges);

    // Actor turn start configuration hook
    const turnStartConfig = {resourceRecovery, actorUpdates, effectChanges, statusText};
    this.callActorHooks("startTurn", turnStartConfig);

    // Apply damage-over-time
    await this.applyDamageOverTime().catch(cause => { // TODO integrate this with resourceRecovery?
      console.error(new Error(`Failed to apply turn start damage-over-time effects for Actor ${this.id}.`, {cause}));
    });

    // Remove round-based Active Effects which expire at the start of a turn
    await this.#applyActiveEffectChanges(effectChanges).catch(cause => {
      console.error(new Error(`Failed to apply turn start ActiveEffect changes for Actor ${this.id}.`, {cause}));
    });

    // Recover resources
    await this.alterResources(resourceRecovery, actorUpdates, {statusText}).catch(cause => {
      console.error(new Error(`Failed to apply turn start resource recovery for Actor ${this.id}.`, {cause}));
    });

    // TODO log a turn start summary of resource changes and their sources?
  }

  /* -------------------------------------------- */

  /**
   * Actions that occur at the end of an Actor's turn in Combat.
   * This method is only called for one User who has ownership permission over the Actor.
   *
   * Turn end workflows proceed in the following order:
   * 1. Active Effects are expired or gained
   * 2. Resource recovery occurs
   * @returns {Promise<void>}
   */
  async onEndTurn() {

    // Re-prepare data and re-render the actor sheet
    this.reset();
    this._sheet?.render(false);

    // Skip cases where the turn is over because the actor delayed
    const {round, from, to} = this.flags.crucible?.delay || {};
    if ( from && (round === game.combat.round) && (game.combat.combatant?.initiative > to) ) return;

    // Plan actor changes
    const resourceRecovery = {};
    const actorUpdates = {};
    if ( this.flags.crucible?.delay ) foundry.utils.mergeObject(actorUpdates, {"flags.crucible.-=delay": null});

    // Identify expiring effects
    const effectChanges = {toCreate: [], toUpdate: [], toDelete: []};
    this.#updateEndTurnEffects(effectChanges);

    // Actor turn start configuration hook
    const statusText = [];
    const turnEndConfig = {resourceRecovery, actorUpdates, effectChanges, statusText};
    this.callActorHooks("endTurn", turnEndConfig);

    // Remove active effects which expire at the end of a turn
    await this.#applyActiveEffectChanges(effectChanges).catch(cause => {
      console.error(new Error(`Failed to apply turn end ActiveEffect changes for Actor ${this.id}.`, {cause}));
    });

    // Recover resources
    await this.alterResources(resourceRecovery, actorUpdates, {statusText}).catch(cause => {
      console.error(new Error(`Failed to apply turn end resource recovery for Actor ${this.id}.`, {cause}));
    });

    // TODO turn end summary of resource changes and their sources?
  }

  /* -------------------------------------------- */

  /**
   * Actions that occur when this Actor leaves a Combat encounter.
   * @returns {Promise<void>}
   */
  async onLeaveCombat() {

    // Clear turn delay flags
    if ( this.flags.crucible?.delay ) await this.update({"flags.crucible.-=delay": null});

    // Re-prepare data and re-render the actor sheet
    this.reset();
    this._sheet?.render(false);
  }

  /* -------------------------------------------- */

  /**
   * Apply damage over time effects which are currently active on the Actor.
   * Positive damage-over-time is applied as damage and is mitigated by resistance or amplified by vulnerability.
   * Negative damage-over-time is applied as healing and is unaffected by resistances or vulnerabilities.
   * @returns {Promise<void>}
   */
  async applyDamageOverTime() {
    for ( const effect of this.effects ) {
      const dot = effect.flags.crucible?.dot;
      if ( !dot ) continue;

      // Categorize damage
      const damage = {};
      for ( const r of Object.keys(SYSTEM.RESOURCES) ) {
        let v = dot[r];
        if ( !v ) continue;
        if (  v > 0 ) v = Math.clamp(v - this.resistances[dot.damageType].total, 0, 2 * v);
        damage[r] ||= 0;
        damage[r] -= v;
      }
      const status = {text: effect.label, fillColor: SYSTEM.RESOURCES.health.color.high.css};
      await this.alterResources(damage, {}, {statusText: [status]});
    }
  }

  /* -------------------------------------------- */

  /**
   * Expire active effects whose durations have concluded at the end of the Actor's turn.
   * @param {{toCreate: object[], toUpdate: object[], toDelete: string[]}} [effectChanges]
   * @returns {Promise<void>}
   */
  async #applyActiveEffectChanges({toCreate, toUpdate, toDelete}) {
    if ( toDelete?.length ) await this.deleteEmbeddedDocuments("ActiveEffect", toDelete);
    if ( toUpdate?.length ) await this.updateEmbeddedDocuments("ActiveEffect", toUpdate);
    if ( toCreate?.length ) await this.createEmbeddedDocuments("ActiveEffect", toCreate);
  }

  /* -------------------------------------------- */

  /**
   * Identify changes to ActiveEffects which occur at the start of a Combatant's turn.
   * Effects with a duration specified in Rounds expire at the beginning of the Actor's turn on the subsequent round.
   * @param {{toCreate: object[], toUpdate: object[], toDelete: string[]}} [effectChanges]
   */
  #updateStartTurnEffects(effectChanges) {
    for ( const effect of this.effects ) {
      const {startRound, rounds} = effect.duration;
      if ( !Number.isNumeric(rounds) ) continue; // Must have duration in rounds
      const elapsed = game.combat.round - startRound;
      if ( elapsed > rounds ) effectChanges.toDelete.push(effect.id);
    }
  }

  /* -------------------------------------------- */

  /**
   * Identify changes to ActiveEffects which occur at the start of a Combatant's turn.
   * Effects with a duration specified in Turns expire at the end of the Actor's turn once the duration has elapsed.
   * @param {{toCreate: object[], toUpdate: object[], toDelete: string[]}} [effectChanges]
   */
  #updateEndTurnEffects(effectChanges) {
    for ( const effect of this.effects ) {
      const {startRound, turns} = effect.duration;
      if ( !Number.isNumeric(turns) ) continue; // Must have duration in turns
      const elapsed = game.combat.previous.round - startRound; // Important to reference the previous round
      if ( elapsed >= turns ) effectChanges.toDelete.push(effect.id);
      // Workaround until unaware is more automated - it can only ever last one round
      else if ( effect.id === "unaware000000000" ) effectChanges.toDelete.push(effect.id);
    }
  }

  /* -------------------------------------------- */
  /*  Character Creation Methods                  */
  /* -------------------------------------------- */

  /**
   * Test whether an Actor is able to learn a new Iconic Spell.
   * @param {CrucibleItem} spell    The spell desired to know
   * @throws {Error}                An error if the Actor cannot learn the spell
   */
  canLearnIconicSpell(spell) {
    const {iconicSpells, iconicSlots} = this.grimoire;
    if ( iconicSpells.length >= iconicSlots ) {
      throw new Error(`Actor ${this.name} does not have any available Iconic Spell slots.`)
    }
    if ( this.items.get(spell._id) ) {
      throw new Error(`Actor ${this.name} already knows the ${spell.name} Iconic Spell.`);
    }
    if ( !spell.system.canKnowSpell(this.system.grimoire) ) {
      throw new Error(`Actor ${this.name} does not satisfy the knowledge requirements to learn the ${spell.name} Iconic Spell.`);
    }
  }

  /* -------------------------------------------- */

  /**
   * Toggle display of the Talent Tree.
   */
  async toggleTalentTree(active) {
    if ( this.type !== "hero" ) return;
    const tree = game.system.tree;
    if ( (tree.actor === this) && (active !== true) ) return game.system.tree.close();
    else if ( active !== false ) return game.system.tree.open(this);
  }

  /* -------------------------------------------- */

  /**
   * Reset all Talents for the Actor.
   * @param {object} [options]        Options which modify how talents are reset
   * @param {boolean} [options.dialog]    Present the user with a confirmation dialog?
   * @returns {Promise<void>}         A Promise which resolves once talents are reset or the dialog is declined
   */
  async resetTalents({dialog=true}={}) {

    // Prompt for confirmation
    if ( dialog ) {
      const confirm = await DialogV2.confirm({
        window: {
          title: `Reset Talents: ${this.name}`,
          icon: "fa-solid fa-undo"
        },
        content: `<p>Are you sure you wish to reset all Talents?</p>`,
        yes: {
          default: true
        }
      });
      if ( !confirm ) return;
    }

    // Remove all non-permanent talents
    const deleteIds = this.items.reduce((arr, i) => {
      if ( (i.type === "talent") && !this.system.permanentTalentIds.has(i.id) ) arr.push(i.id);
      return arr;
    }, []);
    await this.deleteEmbeddedDocuments("Item", deleteIds);
  }

  /* -------------------------------------------- */

  /**
   * Re-sync all Talent data on this actor with updated source data.
   * @returns {Promise<void>}
   */
  async syncTalents() {
    const toCreate = [];
    const toUpdate = [];
    const toDelete = [];
    const packs = [];
    const migrations = SYSTEM.TALENT.TALENT_ID_MIGRATIONS;
    for ( const packId of crucible.CONFIG.packs.talent ) {
      const pack = game.packs.get(packId);
      if ( pack ) packs.push(pack);
    }

    // Identify updates to perform
    for ( const item of this._source.items ) {
      if ( item.type !== "talent" ) continue;
      let talent;

      // Known talent ID migration
      if ( item._id in migrations ) talent = await fromUuid(migrations[item._id]);

      // Search for the talent ID in a source pack
      for ( const pack of packs ) {
        if ( pack.index.has(item._id) ) talent = await pack.getDocument(item._id);
      }

      // Search for the upstream talent from its compendium source
      if ( !talent && item._stats.compendiumSource ) talent = await fromUuid(item._stats.compendiumSource);
      if ( !talent ) continue;

      // Either update or delete+create
      if ( talent.id === item._id ) toUpdate.push(this._cleanItemData(talent));
      else {
        toDelete.push(item._id);
        toCreate.push(this._cleanItemData(talent));
      }
    }

    // Create, update, and delete talents
    if ( toDelete.length ) await this.deleteEmbeddedDocuments("Item", toDelete);
    if ( toUpdate.length ) await this.updateEmbeddedDocuments("Item", toUpdate,
      {diff: false, recursive: false, noHook: true});
    if ( toCreate.length ) await this.createEmbeddedDocuments("Item", toCreate, {keepId: true});
    await this.update({"_stats.systemVersion": game.system.version});
  }

  /* -------------------------------------------- */

  /**
   * Handle requests to add a new Talent to the Actor.
   * Confirm that the Actor meets the requirements to add the Talent, and if so create it on the Actor
   * @param {CrucibleItem} talent     The Talent item to add to the Actor
   * @param {object} [options]        Options which configure how the Talent is added
   * @param {boolean} [options.dialog]        Prompt the user with a confirmation dialog?
   * @param {boolean} [options.warnUnusable]  Warn the user in-dialog if the talent would be currently unusable
   * @returns {Promise<CrucibleItem|null>} The created talent Item or null if no talent was added
   */
  async addTalent(talent, {dialog=false, warnUnusable=false}={}) {

    // Confirm that the Actor meets the requirements to add the Talent
    try {
      talent.system.assertPrerequisites(this);
    } catch(err) {
      ui.notifications.warn(err.message);
      return null;
    }

    // Confirmation dialog
    if ( dialog ) {
      let content = game.i18n.format("TALENT.Purchase", {name: talent.name});
      try {
        const canUse = this.canUtilizeTalent(talent);
        if ( (canUse === false) && warnUnusable ) {
          content += `<div class="notification warning">You cannot use this talent.</div>`;
        }
      } catch(err) {
        if ( warnUnusable ) {
          content += `<div class="notification warning">${err.message}</div>`;
        }
      }
      const confirm = await foundry.applications.api.DialogV2.confirm({
        window: {title: `Purchase Talent: ${talent.name}`},
        content,
        yes: {default: true},
        no: {default: false}
      });
      if ( !confirm ) return null;

      // Re-confirm after the dialog has been submitted to prevent queuing up multiple additions
      try {
        talent.system.assertPrerequisites(this);
      } catch(err) {
        ui.notifications.warn(err.message);
        return null;
      }
    }

    // Add temporarily to an ephemeral Actor
    const talentData = this._cleanItemData(talent);
    if ( !this._id ) {
      const talentCopy = talent.constructor.fromSource(talentData, {parent: this});
      this.items.set(talentCopy.id, talentCopy);
      this.reset();
      if ( crucible.tree.actor === this ) crucible.tree.refresh();
      return talentCopy;
    }

    // Add permanently to a persisted Actor
    return talent.constructor.create(talentData, {parent: this, keepId: true});
  }

  /* -------------------------------------------- */

  /**
   * Remove a Talent from this Actor.
   * @param {CrucibleItem} talent     The Talent item to remove from the Actor
   * @param {object} [options]        Options which configure how the Talent is added
   * @param {boolean} [options.dialog]    Prompt the user with a confirmation dialog?
   * @returns {Promise<CrucibleItem|null>} The removed talent Item or null
   */
  async removeTalent(talent, {dialog=false}={}) {
    const ownedTalent = this.items.get(talent.id);
    if ( !ownedTalent ) throw new Error(`Talent "${ownedTalent.id}" is not owned by Actor "${this.id}"`);
    if ( dialog ) {
      const confirm = await foundry.applications.api.DialogV2.confirm({
        window: {title: `Remove Talent: ${ownedTalent.name}`},
        content: `<p>Remove talent <strong>${ownedTalent.name}</strong>, reclaiming 1 Talent Point?</p>`,
        yes: {default: true},
        no: {default: false}
      });
      if ( !confirm ) return null;
    }

    // Remove temporarily from an ephemeral Actor
    if ( !this._id ) {
      this.items.delete(ownedTalent.id);
      this.reset();
      if ( crucible.tree.actor === this ) crucible.tree.refresh();
    }

    // Remove permanently from a persisted Actor
    else await ownedTalent.delete();
    return ownedTalent;
  }

  /* -------------------------------------------- */

  /**
   * Test whether this Actor would be able to use a Talent once purchased
   * @param {CrucibleItem} talent   The Talent item
   * @returns {boolean}             Whether the Talent would be usable
   */
  canUtilizeTalent(talent) {
    // Can't use a Gesture or Inflection without a Rune
    if ( (talent.system.gesture || talent.system.inflection) && !this.items.find(i => (i.type === "talent" && i.system.rune)) ) {
      throw new Error(game.i18n.localize(`TALENT.WARNINGS.RequiresRune${talent.system.inflection ? "Inflection" : "Gesture"}`));
    }

    return true;
  }

  /* -------------------------------------------- */

  /**
   * Advance the Actor a certain number of levels (or decrease level with a negative delta).
   * When advancing in level, resources are restored and advancement progress is reset.
   * @param {number} delta                The number of levels to advance or decrease
   * @returns {Promise<CrucibleActor>}    The modified Actor
   */
  async levelUp(delta=1) {
    if ( delta === 0 ) return;

    // Confirm that character creation is complete
    if ( this.isL0 ) {
      const steps = [
        this.system.details.ancestry?.name,
        this.system.details.background?.name,
        !this.points.ability.requireInput,
        !this.points.talent.available
      ];
      if ( !steps.every(k => k) ) return ui.notifications.warn("WALKTHROUGH.LevelZeroIncomplete", {localize: true});
    }

    // Commit the update
    const level = Math.clamp(this.level + delta, 0, 24);
    const update = {"system.advancement.level": level};
    return this.update(update);
  }

  /* -------------------------------------------- */

  /**
   * Purchase an ability score increase or decrease for the Actor
   * @param {string} ability      The ability id to increase
   * @param {number} delta        A number in [-1, 1] for the direction of the purchase
   * @return {Promise}
   */
  async purchaseAbility(ability, delta=1) {
    delta = Math.sign(delta);
    const a = this.system.abilities[ability];
    if ( !a || !delta ) return;

    // Can the ability be purchased?
    if ( !this.canPurchaseAbility(ability, delta) ) {
      return ui.notifications.warn(`WARNING.AbilityCannot${delta > 0 ? "Increase" : "Decrease"}`, {localize: true});
    }

    // Modify the ability
    let update;
    if ( this.isL0 ) update = {[`system.abilities.${ability}.base`]: Math.max(a.base + delta, 0)};
    else update = {[`system.abilities.${ability}.increases`]: a.increases + delta};

    // Temporary modification for ephemeral Actor
    if ( !this._id ) this.updateSource(update);
    else await this.update(update);
  }

  /* -------------------------------------------- */

  /**
   * Test whether this Actor can modify an ability score in a certain direction.
   * @param {string} ability      A value in ABILITIES
   * @param {number} delta        A number in [-1, 1] for the direction of the purchase
   * @returns {boolean}           Can the ability score be changed?
   */
  canPurchaseAbility(ability, delta=1) {
    if ( !this.system.points ) return false;
    delta = Math.sign(delta);
    const points = this.points.ability;
    const a = this.system.abilities[ability];
    if ( !a || !delta ) return false;

    // Case 1 - Point Buy
    if ( this.isL0 ) {
      if ( (delta > 0) && ((a.base === 3) || (points.pool < 1)) ) return false;
      else if ( (delta < 0) && (a.base === 0) ) return false;
      return true;
    }

    // Case 2 - Regular Increase
    else {
      if ( (delta > 0) && ((a.value === 12) || (points.available < 1)) ) return false;
      else if ( (delta < 0) && (a.increases === 0) ) return false;
      return true;
    }
  }

  /* -------------------------------------------- */


  /**
   * Apply actor detail data.
   * This is an internal helper method not intended for external use.
   * @param {CrucibleItem|null} item          An Item document, object of Item data, or null to clear data
   * @param {object} [options]                Options which affect how details are applied
   * @param {string} [options.type]             Assert a particular type of detail item. Required when clearing
   * @param {boolean} [options.canApply]        Allow new detail data to be applied?
   * @param {boolean} [options.canClear]        Allow the prior data to be cleared if null is passed?
   * @param {boolean} [options.local=false]     Apply the item locally without saving changes to the database
   * @param {boolean} [options.notify=true]     Display a notification about the application result?
   * @returns {Promise<void>}
   * @internal
   */
  async _applyDetailItem(item, {type, canApply=true, canClear=false, local=false, notify=true, skillTalents=true}={}) {
    type ??= item?.type;
    if ( item ) {
      if ( !canApply ) throw new Error(`You are not allowed to apply ${type} data to Actor ${this.name}`);
      const validType = (type === item.type) && (type in this.system.details);
      if ( !validType ) throw new Error(`Incorrect detail item type ${type} for Actor type ${this.type}`);
    }
    else {
      if ( !type ) throw new Error("You must specify the type of detail item to clear.");
      if ( !canClear ) throw new Error(`You are not allowed to clear the ${type} item from Actor ${this.name}`);
    }

    // Remove existing talents
    const existing = this.system.details[type];
    let deleteItemIds = new Set();
    for ( const uuid of (existing?.talents || []) ) {
      const talentId = foundry.utils.parseUuid(uuid)?.documentId;
      if ( this.items.has(talentId) ) deleteItemIds.add(talentId);
    }

    // Remove existing equipment
    for ( const {item: uuid} of (existing?.equipment || []) ) {
      const itemId = foundry.utils.parseUuid(uuid)?.documentId;
      if ( this.items.has(itemId) ) deleteItemIds.add(itemId);
    }

    // Remove skill talents
    if ( skillTalents ) {
      for ( const skillId of (existing?.skills || []) ) {
        const uuid = SYSTEM.SKILLS[skillId]?.talents[1];
        const talentId = foundry.utils.parseUuid(uuid)?.documentId;
        if ( this.items.has(talentId) ) deleteItemIds.add(talentId);
      }
    }

    // Clear the detail data
    const key = `system.details.==${type}`;
    const updateData = {};
    let message;
    if ( !item ) {
      updateData[key] = null;
      message = game.i18n.format("ACTOR.ClearedDetailItem", {type, actor: this.name});
    }

    // Add new detail data
    else {
      const itemData = item.toObject();
      const detail = updateData[key] = Object.assign(itemData.system, {name: itemData.name, img: itemData.img});
      const updateItems = [];

      // Grant Talents
      const talentUuids = [
        ...(detail.talents || []),
        ...(skillTalents ? (detail.skills || []).map(skillId => SYSTEM.SKILLS[skillId]?.talents[1]) : [])
      ];
      for ( const uuid of talentUuids ) {
        const talent = await fromUuid(uuid);
        if ( !talent ) continue;
        if ( this.items.has(talent.id) ) deleteItemIds.delete(talent.id); // Talent already owned
        else updateItems.push(this._cleanItemData(talent));               // Add new Talent
      }

      // Grant Equipment
      for ( const {item: uuid, quantity, equipped} of (detail.equipment || []) ) {
        const item = await fromUuid(uuid);
        if ( !item ) continue;
        const itemData = this._cleanItemData(item);
        Object.assign(itemData.system, {quantity, equipped});
        if ( item.system.requiresInvestment && equipped ) itemData.system.invested = true;
        updateItems.push(itemData); // Always update equipment, even if already owned
      }

      // Include granted items in Actor update
      if ( updateItems.length ) updateData.items = updateItems;
      message = game.i18n.format("ACTOR.AppliedDetailItem", {name: detail.name, type, actor: this.name});
    }

    // Update locally (for example during character creation)
    if ( local ) {
      for ( const itemId of deleteItemIds ) this.items.delete(itemId);
      this.updateSource(updateData);
      return;
    }

    // Commit the update
    await this.deleteEmbeddedDocuments("Item", Array.from(deleteItemIds));
    await this.update(updateData, {keepEmbeddedIds: true});
    if ( message && notify ) ui.notifications.info(message);
  }

  /* -------------------------------------------- */

  /**
   * View actor detail data as an editable item.
   * This is an internal helper method not intended for external use.
   * @param {string} type         The data type, either "archetype" or "taxonomy"
   * @param {object} [options]    Options that configure how the data is viewed
   * @param {boolean} [options.editable]    Is the detail item editable?
   * @returns {Promise<void>}
   * @internal
   */
  async _viewDetailItem(type, {editable=false}={}) {
    if ( !(type in this.system.details) ) {
      throw new Error(`Incorrect detail item type ${type} for Actor type ${this.type}`);
    }
    const data = this.toObject().system.details[type];

    // View current data
    if ( data?.name ) {
      const cls = getDocumentClass("Item");
      const item = new cls({
        name: data.name,
        img: data.img,
        type: type,
        system: foundry.utils.deepClone(data)
      }, {parent: this});
      item.sheet.render(true, {editable});
      return;
    }

    // Browse compendium pack
    if ( this.isL0 || !data?.name ) {
      const pack = game.packs.get(SYSTEM.COMPENDIUM_PACKS[type]);
      pack.render(true);
    }
  }

  /* -------------------------------------------- */

  /**
   * Clean data for an Item that is being added to this Actor.
   * @param {CrucibleItem} item
   * @internal
   */
  _cleanItemData(item) {
    const itemData = game.items.fromCompendium(item, {clearFolder: true, clearOwnership: true, keepId: true});
    delete itemData.ownership;
    return itemData;
  }

  /* -------------------------------------------- */
  /*  Equipment Management Methods                */
  /* -------------------------------------------- */

  /**
   * @typedef CrucibleEquipItemOptions
   * @property {boolean} [dropped]          Has the Item been dropped?
   * @property {boolean} [equipped]         Whether the Item should be equipped (true) or unequipped (false)
   * @property {number} [slot]              A specific equipment slot in SYSTEM.WEAPON.SLOTS
   */

  /**
   * A generic wrapper around various equip methods.
   * @param {CrucibleItem|string} item      The owned Item id to equip
   * @param {CrucibleEquipItemOptions} [options] Options which configure how the Item is equipped
   * @return {Promise}                      A Promise which resolves once the Item has been equipped or un-equipped
   * @throws {Error}                        An Error if the Item cannot be equipped
   */
  async equipItem(item, {slot, dropped=false, equipped=true}={}) {
    if ( typeof item === "string" ) item = this.items.get(item);
    if ( !(item instanceof foundry.documents.Item) || (item.parent !== this) ) {
      throw new Error(`Invalid Item "${item?.uuid}" cannot be equipped`);
    }

    // Verify whether equipment can occur
    const result = this.canEquipItem(item, {slot, dropped, equipped});
    if ( result.equipped === item.system.equipped ) return; // No change needed

    // Configure and use the equipItem action
    slot = equipped ? this.canEquipItem(item, slot) : undefined;
    const action = equipped ? this.#equipItemAction(item, slot) : this.#unequipItemAction(item, dropped);
    if ( this.inCombat ) await action.use();
    else if ( action.usage.actorUpdates.items.length ) {
      await this.updateEmbeddedDocuments("Item", action.usage.actorUpdates.items);
    }
  }

  /* -------------------------------------------- */

  /**
   * Perform an action to un-equip or drop a weapon.
   * @param {CrucibleItem} item         An item being equipped
   * @param {boolean} [dropped]         Has the weapon been dropped?
   * @returns {CrucibleAction|null}
   */
  #unequipItemAction(item, dropped) {
    if ( !item.system.equipped ) return null;
    let ap = dropped ? 0 : 1;
    if ( item.system.properties.has("ambush") ) ap = Math.max(ap - 1, 0);
    const typeLabel = game.i18n.localize(CONFIG.Item.typeLabels[item.type]);
    const action = new CrucibleAction({
      id: "equipItem",
      name: dropped ? `Drop ${typeLabel}` : `Un-equip ${typeLabel}`,
      img: item.img,
      cost: {action: ap},
      description: `${dropped ? "Drop" : "Un-equip"} the ${item.name}.`,
      target: {type: "self", scope: 1}
    }, {actor: this});

    const update = {_id: item.id, system: {equipped: false}};
    if ( dropped ) update.system.dropped = true;
    if ( item.type === "weapon" ) Object.assign(action.usage.actorStatus, {unequippedWeapon: true});
    Object.assign(action.usage.actorUpdates, {items: [update]});
    return action;
  }

  /* -------------------------------------------- */

  /**
   * Perform an action to equip or recover an Item.
   * @param {CrucibleItem} item       An item being equipped
   * @param {number|null} [slot]      A requested equipment slot in SYSTEM.WEAPON.SLOTS or null for natural weapons
   * @returns {CrucibleAction|null}
   */
  #equipItemAction(item, slot) {
    let ap = 1;
    if ( !item.system.dropped && item.system.properties.has("ambush") ) ap -= 1;

    // Create the action
    const typeLabel = game.i18n.localize(CONFIG.Item.typeLabels[item.type]);
    const action = new CrucibleAction({
      id: "equipItem",
      name: item.system.dropped ? `Recover ${typeLabel}` : `Equip ${typeLabel}`,
      img: item.img,
      cost: {action: ap},
      description: `${item.system.dropped ? "Recover the dropped" : "Equip the"} ${item.name}.`,
      target: {type: "self", scope: 1},
      tags: ["freehand"]
    }, {actor: this});

    // Equip the weapon as a follow-up actor update
    action.usage.actorUpdates ||= {};
    action.usage.actorUpdates.items ||= [];
    const update = {_id: item.id, system: {dropped: false, equipped: true}}
    if ( slot !== undefined ) update.slot = slot;
    action.usage.actorUpdates.items.push(update);
    return action;
  }

  /* -------------------------------------------- */

  /**
   * Test whether the Actor is able to equip a certain Item.
   * @param {CrucibleItem} item           The Item to be equipped, unequipped, or dropped
   * @param {CrucibleEquipItemOptions} [options] Options which configure how the Item is equipped
   * @returns {CrucibleEquipItemOptions}  The configured equipment result
   * @throws {Error}                      An error explaining why the weapon cannot be equipped
   */
  canEquipItem(item, {equipped=true, dropped=false, slot}={}) {
    if ( dropped ) equipped = false;
    const result = {equipped, dropped, slot};
    if ( equipped === item.system.equipped ) return result;
    if ( !SYSTEM.ITEM.EQUIPABLE_ITEM_TYPES.has(item.type) ) return false;
    switch ( item.type ) {
      case "weapon":
        if ( item.system.properties.has("natural") ) result.dropped = false;
        if ( equipped ) result.slot = this.#getAvailableWeaponSlot(item, slot);
        return result;
      case "armor":
        const {armor} = this.equipment;
        if ( equipped && armor.id ) {
          throw new Error(game.i18n.format("WARNING.CannotEquipSlotInUse", {
            actor: this.name,
            item: item.name,
            type: game.i18n.localize("TYPES.Item.armor")
          }));
        }
        if ( this.inCombat ) {
          throw new Error(game.i18n.format("WARNING.CannotEquipInCombat", {
            actor: this.name,
            item: item.name
          }));
        }
        result.slot = null;
        return result;
      case "accessory":
        const {accessories, accessorySlots} = this.equipment;
        if ( equipped && (accessories.length >= accessorySlots) ) {
          throw new Error(game.i18n.format("WARNING.CannotEquipSlotInUse", {
            actor: this.name,
            item: item.name,
            type: game.i18n.localize("TYPES.Item.accessory")
          }));
        }
        result.slot = null;
        return result;
      case "consumable":
      case "tool":
        const {toolbelt, toolbeltSlots} = this.equipment;
        if ( equipped && (toolbelt.length === toolbeltSlots) ) {
          throw new Error(game.i18n.format("WARNING.CannotEquipSlotInUse", {
            actor: this.name,
            item: item.name,
            type: game.i18n.localize(`TYPES.Item.${item.type}`)
          }));
        }
        result.slot = null;
        return result;
      default:
        throw new Error(`Items with type "${item.type}" are not equippable.`);
    }
  }

  /* -------------------------------------------- */

  /**
   * Assert that the Actor is able to currently equip a certain Weapon.
   * @param {CrucibleItem} weapon     A weapon being equipped
   * @param {number} slot             A requested equipment slot in SYSTEM.WEAPON.SLOTS
   * @returns {number|null}           A numbered slot in SYSTEM.WEAPON.SLOTS where the weapon can be equipped.
   * @throws {Error}                  An error explaining why the weapon cannot be equipped
   */
  #getAvailableWeaponSlot(weapon, slot) {
    const category = weapon.config.category;
    const slots = SYSTEM.WEAPON.SLOTS;
    const {mainhand, offhand} = this.equipment.weapons;

    // Natural weapons don't require any slot
    if ( weapon.system.properties.has("natural") ) return null;

    // Identify the target equipment slot
    if ( slot === undefined ) {
      if ( category.hands === 2 ) slot = slots.TWOHAND;
      else if ( category.main ) slot = mainhand.id && category.off ? slots.OFFHAND : slots.MAINHAND;
      else if ( category.off ) slot = slots.OFFHAND;
    }

    // Confirm the target slot is available
    let occupied;
    switch ( slot ) {
      case slots.TWOHAND:
        if ( mainhand?.id ) occupied = mainhand;
        else if ( offhand?.id ) occupied = offhand;
        break;
      case slots.MAINHAND:
        if ( mainhand?.id ) occupied = mainhand;
        break;
      case slots.OFFHAND:
        if ( offhand?.id ) occupied = offhand;
        else if ( mainhand.config.category.hands === 2 ) occupied = mainhand;
        break;
    }

    // Throw an error if equipment is not possible
    if ( occupied ) throw new Error(game.i18n.format("WARNING.CannotEquipSlotInUse", {
      actor: this.name,
      item: weapon.name,
      type: game.i18n.localize(slots.label(slot))
    }));
    return slot;
  }

  /* -------------------------------------------- */
  /*  Flanking and Engagement                     */
  /* -------------------------------------------- */

  /**
   * Update the Flanking state of this Actor given a set of engaged Tokens.
   * @param {CrucibleTokenEngagement} engagement      The enemies and allies which this Actor currently has engaged.
   */
  async commitFlanking(engagement) {
    engagement ||= {flanked: 0};
    const flankedId = SYSTEM.EFFECTS.getEffectId("flanked");
    const flankedStage = engagement.flanked;
    const current = this.effects.get(flankedId);
    if ( flankedStage === current?.flags.crucible.flanked ) return;

    // Add flanked effect
    if ( flankedStage > 0 ) {
      const flankedData = {
        _id: flankedId,
        name: `${game.i18n.localize("ACTIVE_EFFECT.STATUSES.Flanked")} ${flankedStage}`,
        description: game.i18n.localize("ACTIVE_EFFECT.STATUSES.FlankedDescription"),
        icon: "systems/crucible/icons/statuses/flanked.svg",
        statuses: ["flanked"],
        flags: {
          crucible: {
            engagedEnemies: engagement.enemies.size,
            engagedAllies: engagement.allies.size,
            flanked: flankedStage
          }
        }
      }
      if ( current ) {
        if ( flankedData.name !== current.name ) {
          await current.update(flankedData);
          current._displayScrollingStatus(true);
        }
      }
      else await this.createEmbeddedDocuments("ActiveEffect", [flankedData], {keepId: true});
    }

    // Remove flanked effect
    else if ( current )  await current.delete();
  }

  /* -------------------------------------------- */
  /*  Currency Management                         */
  /* -------------------------------------------- */

  /**
   * Convert an amount of currency expressed in configured denominations into a numeric amount for data storage.
   * @param {Record<keyof crucible.CONFIG.currency, number>} amounts
   * @returns {number}
   */
  static convertCurrency(amounts={}) {
    if ( typeof amounts !== "object" ) {
      throw new Error("The amounts passed to CrucibleActor#convertCurrency must be an object");
    }
    let amount = 0;
    for ( const [k, v] of Object.entries(amounts) ) {
      const d = crucible.CONFIG.currency[k];
      if ( !d ) continue;
      amount += Math.round(v * d.multiplier);
    }
    return amount;
  }

  /* -------------------------------------------- */

  /**
   * Allocate an amount of currency into configured denominations, favoring larger denominations over smaller.
   * This function does not guarantee that the entire input amount is allocated. Depending on the configured
   * denominations which are available, there might be some unallocated remainder.
   * @param {number} amount
   * @returns {Record<keyof crucible.CONFIG.currency, number>}
   */
  static allocateCurrency(amount=0) {
    const allocated = {};
    const ds = Object.entries(crucible.CONFIG.currency).toSorted((a, b) => b[1].multiplier - a[1].multiplier);
    for ( const [k, v] of ds ) {
      allocated[k] = Math.floor(amount / v.multiplier);
      amount = (amount % v.multiplier);
    }
    return allocated;
  }

  /* -------------------------------------------- */

  /**
   * Modify the amount of currency owned by this actor by a certain amount.
   * The input amount can be provided either as a raw integer or as an object of currency denominations.
   * Returns the amount of currency that was added or subtracted.
   * @param {number|Record<keyof crucible.CONFIG.currency, number>} amounts
   * @returns {number}
   */
  async modifyCurrency(amounts) {
    const priorAmount = this.system.currency;
    const delta = typeof amounts === "number" ? amounts : this.constructor.convertCurrency(amounts);
    const currency = Math.max(priorAmount + delta, 0);
    await this.update({system: {currency}});
    return currency - priorAmount;
  }

  /* -------------------------------------------- */
  /*  Database Workflows                          */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    const updates = {};

    // Populate initial resource data
    if ( this.system.schema.has("resources") ) this.updateSource(this.#getRecoveryData());

    // Begin Character Creation
    if ( !this.pack && (this.type === "hero") && (this.level === 0) ) {
      foundry.utils.setProperty(updates, "flags.core.sheetClass", `crucible.${crucible.CONFIG.heroCreationSheet.name}`);
    }

    // Automatic Prototype Token configuration
    updates.prototypeToken = {bar1: {attribute: "resources.health"}, bar2: {attribute: "resources.morale"}};
    switch ( data.type ) {
      case "hero":
        Object.assign(updates.prototypeToken, {sight: {enabled: true}, actorLink: true, disposition: 1});
        break;
      case "adversary":
        Object.assign(updates.prototypeToken, {sight: {enabled: false}, actorLink: false, disposition: -1});
        break;
    }
    this.updateSource(updates);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preUpdate(data, options, user) {
    await super._preUpdate(data, options, user);
    if ( !["hero", "adversary"].includes(this.type) ) return;

    // Level changes
    const adv0 = this._source.system.advancement;
    const adv1 = data.system?.advancement;
    const levelChangeKeys = this.type === "hero" ? ["level"] : ["level", "rank"];
    const levelChange = !!adv1 && levelChangeKeys.some(k => (k in adv1) && (adv1[k] !== adv0[k]));

    // Ability score changes
    const abl1 = data.system?.abilities;
    const abilityChange = !!abl1 && Object.keys(SYSTEM.ABILITIES).some(k => !foundry.utils.isEmpty(abl1[k]));

    // Simulate changes on a cloned actor?
    const simulate = (levelChange || abilityChange) && (options.characterCreation || (options.recursive !== false));
    if ( simulate ) {
      let clone;
      try {
        clone = this.clone({}, {keepId: true, save: false});
        const simulateData = foundry.utils.mergeObject(data, {
          system: {
            resources: {
              health: {value: 1}, // Clear weakened
              morale: {value: 1}  // Clear broken
            }
          }
        }, {inplace: false});
        clone.updateSource(simulateData);
      } finally {
        if ( !clone ) return;
      }

      // Replenish resources
      if ( !this.inCombat ) foundry.utils.mergeObject(data, clone.#getRecoveryData());

      // Constrain milestones
      if ( levelChange && (this.type === "hero") ) {
        const l = SYSTEM.ACTOR.LEVELS[clone.level];
        if ( adv1.level > adv0.level ) adv1.milestones = l.milestones.start;
        else if ( adv1.level < adv0.level ) adv1.milestones = l.milestones.next - 1;
      }
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onUpdate(data, options, userId) {
    super._onUpdate(data, options, userId);

    // Locally display scrolling status updates
    this.#displayUpdateScrollingStatus(data, options.statusText);

    // Apply follow-up database changes only as the initiating user
    if ( game.userId === userId ) {
      this.#updateSize(data, options);
      this.#updatePace(data, options);
      this.#applyResourceStatuses(data);
    }

    // Update flanking
    if ( this._cachedResources ) {
      const {wasIncapacitated, wasBroken} = this._cachedResources || {};
      if ( (this.isIncapacitated !== wasIncapacitated) || (this.system.isBroken !== wasBroken) ) {
        const tokens = this.getActiveTokens(true);
        const activeGM = game.users.activeGM;
        const commit = (activeGM === game.user) && (activeGM?.viewedScene === canvas.id);
        for ( const token of tokens ) token.refreshFlanking(commit);
      }
      this.#updateCachedResources();
      this.#updateGroups();
    }

    // Refresh display of the active talent tree
    const tree = game.system.tree;
    if ( tree.actor === this ) {
      const talentChange = foundry.utils.hasProperty(data, "system.advancement.level") ||
        foundry.utils.hasProperty(data, "system.advancement.talentNodes") || ("items" in data);
      if ( talentChange ) tree.refresh();
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onCreateDescendantDocuments(...args) {
    super._onCreateDescendantDocuments(...args);
    const tree = game.system.tree;
    if ( tree.actor === this ) tree.refresh();
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onDeleteDescendantDocuments(...args) {
    super._onDeleteDescendantDocuments(...args);
    const tree = game.system.tree;
    if ( tree.actor === this ) tree.refresh();
  }

  /* -------------------------------------------- */

  /**
   * Display status text updates above each Token for this Actor upon update.
   * @param {Partial<ActorData>} changed      Data for the Actor which changed
   * @param {Array<object>} statusText        Status text passed as part of updates
   */
  #displayUpdateScrollingStatus(changed, statusText) {
    const resources = changed.system?.resources || {};
    if ( !this._cachedResources ) return;
    const texts = [];

    // Display resource changes
    for ( let [resourceName, prior] of Object.entries(this._cachedResources ) ) {
      if ( resources[resourceName]?.value === undefined ) continue;
      const resource = SYSTEM.RESOURCES[resourceName];
      const attr = this.system.resources[resourceName];
      const delta = attr.value - prior;
      if ( delta === 0 ) continue;
      const text = `${delta.signedString()} ${resource.label}`;
      const pct = Math.clamp(Math.abs(delta) / attr.max, 0, 1);
      const fontSize = 32 + (64 * pct); // Range between [32, 64]
      const healSign = resource.type === "active" ? 1 : -1;
      const colorVariant = Math.sign(delta) === healSign ? "heal" : "high";
      const fillColor = resource.color instanceof Color ? resource.color : resource.color[colorVariant];
      texts.push({text, fontSize, fillColor});
    }

    // Add custom messages last
    if ( Array.isArray(statusText) ) texts.push(...statusText);
    else if ( statusText ) texts.push(statusText);

    // Display scrolling statuses
    this.displayScrollingText(texts);
  }

  /* -------------------------------------------- */

  /**
   * Display scrolling text above all Tokens for this Actor.
   */
  async displayScrollingText(texts, {delayMS=250, jitter=0.5}={}) {
    const tokens = this.getActiveTokens(true);
    if ( !tokens.length ) return;
    if ( !Array.isArray(texts) ) texts = [texts];
    for ( let text of texts ) {
      if ( typeof text === "string" ) text = {text};
      if ( !text.text ) continue;
      for ( const token of tokens ) {
        // noinspection ES6MissingAwait
        canvas.interface.createScrollingText(token.center, text.text, {
          anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
          fontSize: text.fontSize || 32,
          fill: text.fillColor || 0xFFFFFF,
          stroke: 0x000000,
          strokeThickness: 4,
          jitter
        });
      }
      if ( delayMS ) await new Promise(resolve => window.setTimeout(resolve, delayMS));
    }
  }

  /* -------------------------------------------- */

  /**
   * Apply status effect changes when attribute pools change
   * @param {object} data     The data which changed
   * @returns {Promise<void>}
   * @private
   */
  async #applyResourceStatuses(data) {
    const r = data?.system?.resources || {};
    if ( ("health" in r) || ("wounds" in r) ) {
      await this.toggleStatusEffect("weakened", {active: this.system.isWeakened && !this.system.isDead });
      await this.toggleStatusEffect("dead", {active: this.system.isDead});
      await this.toggleStatusEffect("asleep", {active: false});
    }
    if ( ("morale" in r) || ("madness" in r) ) {
      await this.toggleStatusEffect("broken", {active: this.system.isBroken && !this.system.isInsane });
      await this.toggleStatusEffect("insane", {active: this.system.isInsane});
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the size of Tokens for this Actor.
   * If the Actor is an unlinked ActorDelta, we only update it's specific Token.
   * Otherwise, we update the Actor's prototype token as well as all placed instances of the Actor's token.
   */
  async #updateSize(data, options) {
    if ( options._crucibleRelatedUpdate || (this.type === "group") ) return;
    const size = this.size;

    // Unlinked Token Actor
    if ( this.isToken ) {
      const token = this.token;
      if ( (token.width !== size) || (token.height !== size) ) {
        await token.update({width: size, height: size}, {_crucibleRelatedUpdate: true});
      }
      return;
    }

    // Linked Actor
    const pt = this.prototypeToken;
    if ( (pt.width === size) && (pt.height === size) ) return;
    await this.update({prototypeToken: {width: size, height: size}}, {_crucibleRelatedUpdate: true});

    // Update placed Tokens
    const sceneUpdates = {};
    for ( const token of this.getDependentTokens() ) {
      if ( (token.width !== size) || (token.height !== size) ) {
        sceneUpdates[token.parent.id] ||= [];
        sceneUpdates[token.parent.id].push({_id: token.id, width: size, height: size});
      }
    }
    for ( const [sceneId, updates] of Object.entries(sceneUpdates) ) {
      const scene = game.scenes.get(sceneId);
      if ( scene ) await scene.updateEmbeddedDocuments("Token", updates, {_crucibleRelatedUpdate: true});
    }
  }

  /* -------------------------------------------- */

  /**
   * If the travel pace of a group actor changed, update its token placements.
   */
  async #updatePace(data, options) {
    if ( !data.system?.movement?.pace || (this.type !== "group") || options._crucibleRelatedUpdate ) return;
    const pace = this.system.movement.pace;
    const sceneUpdates = {};
    for ( const token of this.getDependentTokens() ) {
      sceneUpdates[token.parent.id] ||= [];
      sceneUpdates[token.parent.id].push({_id: token.id, movementAction: pace});
    }
    for ( const [sceneId, updates] of Object.entries(sceneUpdates) ) {
      const scene = game.scenes.get(sceneId);
      if ( scene ) await scene.updateEmbeddedDocuments("Token", updates, {_crucibleRelatedUpdate: true});
    }
  }

  /* -------------------------------------------- */

  /**
   * Update cached resources for this Actor.
   */
  #updateCachedResources() {
    this._cachedResources ||= {};
    const resources = this.system.schema.get("resources");
    if ( !resources ) return;
    for ( const k in resources.fields ) this._cachedResources[k] = this._source.system.resources[k].value;
    this._cachedResources.wasIncapacitated = this.system.isIncapacitated;
    this._cachedResources.wasBroken = this.system.isBroken;
    return this._cachedResources;
  }

  /* -------------------------------------------- */

  /**
   * Update data for groups this Actor belongs to.
   */
  #updateGroups() {
    for ( const group of this._groups ) {
      if ( !group.system.actors.has(this) ) {
        this._groups.delete(group);
        continue;
      }
      group.sheet.render({force: false});
    }
  }

  /* -------------------------------------------- */
  /*  Rendering Helpers                           */
  /* -------------------------------------------- */

  /**
   * Prepare tags displayed about this Actor.
   * @param {"short"|"full"} scope
   * @returns {Record<string, string>}
   */
  getTags(scope="full") {
    return this.system.getTags?.(scope) || {};
  }

  /* -------------------------------------------- */

  /** @override */
  onEmbed(element) {
    Hooks.callAll("crucible.embedActor", this, element);
  }
}

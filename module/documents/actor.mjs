import StandardCheck from "../dice/standard-check.mjs"
import AttackRoll from "../dice/attack-roll.mjs";
import CrucibleAction from "../models/action.mjs";
import CrucibleSpellAction from "../models/spell-action.mjs";
const {DialogV2} = foundry.applications.api;

/** @import {TRAINING_TYPES} from "../config/talents.mjs"; */

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
    this.system._updateCachedResources?.();
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
   * Is this Actor currently in the active Combat encounter?
   * @type {boolean}
   */
  get combatant() {
    if ( this.isToken ) return game.combat?.combatants.find(c => c.tokenId === this.token.id);
    return game.combat?.combatants.find(c => c.actorId === this.id);
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
    return this.system.isDead || this.statuses.has("unconscious") || this.statuses.has("paralyzed");
  }

  /**
   * A convenience reference to the Actor level.
   * @type {number}
   */
  get level() {
    return this.system.advancement.level;
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

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritdoc */
  prepareEmbeddedDocuments() {
    super.prepareEmbeddedDocuments();
    const items = this.itemTypes;
    this.system.prepareItems(items);
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
    for ( const {talent, fn} of hooks ) {
      console.debug(`Calling ${hook} hook for Talent ${talent.name}`);
      try {
        fn(this, ...args);
      } catch(err) {
        const msg = `The "${hook}" hook defined for Talent "${talent.name}" failed evaluation in Actor [${this.id}]`;
        console.error(msg, err);
      }
    }
  }

  /* -------------------------------------------- */
  /*  Dice Rolling Methods                        */
  /* -------------------------------------------- */

  /**
   * Compute the ability score bonus for a given scaling mode.
   * @param {string[]} scaling    How is the ability bonus computed?
   * @returns {number}            The ability bonus
   */
  getAbilityBonus(scaling) {
    const abilities = this.system.abilities;
    return Math.round(scaling.reduce((x, t) => x + abilities[t].value, 0) / (scaling.length * 2));
  }

  /* -------------------------------------------- */

  /**
   * Prepare an Action to be used by this Actor.
   * @param {CrucibleAction} action     The action being prepared
   */
  prepareAction(action) {
    const statuses = this.statuses;
    const rollBonuses = this.system.rollBonuses;
    const {banes, boons} = action.usage;
    const isWeapon = ["mainhand", "offhand", "twohand"].some(t => action.tags.has(t));
    const isSpell = action.tags.has("spell");
    const isAttack = isWeapon || isSpell;

    // Actor status effects
    if ( statuses.has("broken") ) banes.broken = {label: "Broken", number: 2};
    if ( statuses.has("blinded") && isAttack ) banes.blind = {label: "Blinded", number: 2};
    if ( statuses.has("disoriented") && action.cost.focus ) action.cost.focus += 1;
    if ( statuses.has("prone") && isAttack ) banes.prone = {label: "Prone", number: 1};

    // Temporary boons and banes stored as Actor rollBonuses
    for ( const [id, boon] of Object.entries(rollBonuses.boons) ) {
      if ( id in boons ) continue;
      boons[id] = boon;
    }
    for ( const [id, bane] of Object.entries(rollBonuses.banes) ) {
      if ( id in banes ) continue;
      banes[id] = bane;
    }
  }

  /* -------------------------------------------- */

  /**
   * Get the number of additional boons or banes you have when attacking a target.
   * @param {CrucibleActor} target    The target being attacked
   * @param {CrucibleAction} action   The action being performed
   * @param {string} actionType       The type of action being performed: "weapon", "spell", or "skill
   * @param {boolean} [ranged]        Does this action count as a ranged attack?
   * @returns {{boons: Object<DiceBoon>, banes: Object<DiceBoon>}}  Configuration of boons and banes
   */
  applyTargetBoons(target, action, actionType, ranged) {
    const boons = foundry.utils.deepClone(action.usage.boons);
    const banes = foundry.utils.deepClone(action.usage.banes);
    ranged ??= (action.range.maximum > 3);
    const isAttack = (actionType !== "skill") && !action.damage?.restoration;

    // Guarded
    if ( target.statuses.has("guarded") && isAttack ) banes.guarded = {label: "Guarded", number: 1};

    // Prone
    if ( target.statuses.has("prone") && isAttack ) {
      if ( ranged ) {
        if ( "prone" in banes ) banes.prone.number += 1;
        else banes.prone = {label: "Prone", number: 1};
      }
      else boons.prone = {label: "Prone", number: 1};
    }

    // Flanked
    if ( target.statuses.has("flanked") && isAttack && !ranged ) {
      const ae = target.effects.get(SYSTEM.EFFECTS.getEffectId("flanked"));
      if ( ae ) boons.flanked = {label: "Flanked", number: ae.getFlag("crucible", "flanked") ?? 1};
      else console.warn(`Missing expected Flanked effect on Actor ${target.id} with flanked status`);
    }
    return {boons, banes};
  }

  /* -------------------------------------------- */

  /**
   * Get a creature's effective resistance against a certain damage type dealt to a certain resource.
   * @param {string} resource       The resource targeted in SYSTEM.RESOURCES
   * @param {string} damageType     The damage type dealt in SYSTEM.DAMAGE_TYPES
   * @param {boolean} restoration   Does the ability cause restoration?
   */
  getResistance(resource, damageType, restoration) {
    if ( restoration ) return 0;
    let r = this.resistances[damageType]?.total ?? 0;
    switch ( resource ) {
      case "health":
        if ( this.isBroken ) r -= 2;
        if ( this.statuses.has("invulnerable") ) r = Infinity
        break;
      case "morale":
        if ( this.isWeakened ) r -= 2;
        if ( this.statuses.has("resolute") ) r = Infinity;
        break;
    }
    return r;
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
    const skill = this.system.skills[skillId];
    if ( !skill ) throw new Error(`Invalid skill ID ${skillId}`);

    // Prepare check data
    const rollData = {
      actorId: this.id,
      banes: {},
      boons: {},
      dc: dc,
      ability: skill.abilityBonus,
      skill: skill.skillBonus,
      enchantment: skill.enchantmentBonus,
      type: skillId,
      rollMode: rollMode,
    };
    if ( boons ) rollData.boons.special = {label: "Special", number: boons};
    if ( banes ) rollData.banes.special = {label: "Special", number: banes};

    // Apply talent hooks
    this.callActorHooks("prepareStandardCheck", rollData);
    this.callActorHooks("prepareSkillCheck", skill, rollData);

    // Create the check roll
    const sc = new StandardCheck(rollData);

    // Prompt the user with a roll dialog
    const flavor = game.i18n.format("SKILL.RollFlavor", {name: this.name, skill: SYSTEM.SKILLS[skillId].label});
    if ( dialog ){
      const title = game.i18n.format("SKILL.RollTitle", {name: this.name, skill: SYSTEM.SKILLS[skillId].label});
      const response = await sc.dialog({title, flavor, rollMode});
      if ( response === null ) return null;
    }

    // Execute the roll to chat
    await sc.toMessage({flavor, flags: {crucible: {skill: skillId}}});
    return sc;
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
      const r = twist.random() * d.physical.total;
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
    return action.use({dialog: true, ...options});
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
   * Cast a certain spell against a target.
   * @param {CrucibleSpellAction} spell
   * @param {CrucibleActor} target
   * @returns {Promise<AttackRoll|null>}
   */
  async castSpell(spell, target) {
    if ( !(target instanceof CrucibleActor) ) throw new Error("You must define a target Actor for the spell.");
    if ( !spell.usage.hasDice ) return null;

    // Prepare Roll Data
    const defenseType = spell.defense;
    const {boons, banes} = this.applyTargetBoons(target, spell, "spell");
    const rollData = {
      actorId: this.id,
      spellId: spell.id,
      target: target.uuid,
      ability: this.getAbilityBonus(Array.from(spell.scaling)),
      skill: 0,
      enchantment: 0,
      banes, boons,
      defenseType,
      dc: target.defenses[defenseType].total
    }

    // Call talent hooks
    this.callActorHooks("prepareStandardCheck", rollData);
    this.callActorHooks("prepareSpellAttack", spell, target, rollData);
    target.callActorHooks("defendSpellAttack", spell, this, rollData);

    // Create the Attack Roll instance
    const roll = new AttackRoll(rollData);

    // Evaluate the result and record the result
    await roll.evaluate({async: true});
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
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Perform a Skill Attack targeting a specific creature.
   * @param {CrucibleAction} action       The Skill Attack action being performed
   * @param {CrucibleActor} target        The target Actor
   * @returns {Promise<AttackRoll|null>}  A created AttackRoll instance if the action involves a roll, otherwise null
   */
  async skillAttack(action, target) {

    // Prepare Roll Data
    let {bonuses, damageType, defenseType, restoration, resource, skillId} = action.usage;
    const {boons, banes} = this.applyTargetBoons(target, action, "skill");
    let dc;
    if ( defenseType in target.defenses ) dc = target.defenses[defenseType].total;
    else {
      defenseType = skillId;
      dc = target.skills[skillId].passive
    }
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
    target.callActorHooks("defendSkillAttack", action, this, rollData);

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
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Perform an Action which makes an attack using a Weapon.
   * @param {CrucibleAction} action         The action being performed
   * @param {CrucibleActor} target          The target being attacked
   * @param {CrucibleItem} [weapon]         The weapon used in the attack
   * @returns {Promise<AttackRoll|null>}    An evaluated attack roll, or null if no attack is performed
   */
  async weaponAttack(action, target, weapon) {
    weapon ||= action.usage.weapon;
    const {boons, banes} = this.applyTargetBoons(target, action, "weapon", !!weapon.config.category.ranged);
    const defenseType = action.usage.defenseType || "physical";
    if ( weapon?.type !== "weapon") {
      throw new Error(`Weapon attack Action "${action.name}" did not specify which weapon is used in the attack`);
    }

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
    target.callActorHooks("defendWeaponAttack", action, this, rollData);

    // Create and evaluate the AttackRoll instance
    const roll = new AttackRoll(rollData);
    await roll.evaluate({async: true});
    const r = roll.data.result = target.testDefense(defenseType, roll);

    // Structure damage
    if ( r < AttackRoll.RESULT_TYPES.GLANCE ) return roll;
    roll.data.damage = weapon.system.getDamage(this, action, target, roll);
    roll.data.damage.total = CrucibleAction.computeDamage(roll.data.damage);

    // TODO "rollWeaponAttack" hook for final damage adjustments?
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
    const combatant = game.combat.getCombatantByActor(this);
    if ( !combatant ) throw new Error(`Actor [${this.id}] has no Combatant in the currently active Combat.`);
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
   * Restore all resource pools to their maximum value.
   * @param {object} [updateData={}]      Additional update data to include in the rest operation
   * @param {object} [options={}]         Options which modify the rest
   * @param {boolean} [options.allowDead=false]   Allow dead actors to rest?
   * @returns {Promise<void>}
   */
  async rest(updateData={}, {allowDead=false}={}) {
    if ( (this.system.isDead || this.system.isInsane) && !allowDead ) return;

    // Expire Active Effects
    const toDeleteEffects = this.effects.reduce((arr, effect) => {
      if ( effect.id === "weakened00000000" ) arr.push(effect.id);
      else if ( effect.id === "broken0000000000" ) arr.push(effect.id);
      else if ( !effect.duration.seconds || (effect.duration.seconds <= 600) ) arr.push(effect.id);
      return arr;
    }, []);
    await this.deleteEmbeddedDocuments("ActiveEffect", toDeleteEffects);

    // Recover Resources
    await this.update(foundry.utils.mergeObject(this._getRestData(), updateData));
  }

  /* -------------------------------------------- */

  /**
   * Prepare an object that replenishes all resource pools to their current maximum level
   * @returns {{}}
   * @private
   */
  _getRestData() {
    const updates = {};
    for ( let [id, resource] of Object.entries(this.system.resources) ) {
      const cfg = SYSTEM.RESOURCES[id];
      updates[`system.resources.${id}.value`] = cfg.type === "reserve" ? 0 : resource.max;
    }
    updates["system.resources.heroism.value"] = 0;
    updates["system.status"] = null;
    return updates;
  }

  /* -------------------------------------------- */

  /**
   * Alter the resource pools of the actor using an object of change data
   * @param {Object<string, number>} deltas       Changes where the keys are resource names and the values are deltas
   * @param {object} [updates]                    Other Actor updates to make as part of the same transaction
   * @param {object} [options]                    Options which are forwarded to the update method
   * @param {boolean} [options.reverse]             Reverse the direction of change?
   * @param {string} [options.statusText]           Custom status text displayed on the Token.
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
      if ( (resourceName === "morale") && this.statuses.has("frightened") ) delta = Math.min(delta, 0);
      else if ( (resourceName === "health") && this.statuses.has("diseased") ) delta = Math.min(delta, 0);

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
        label: game.i18n.localize(effectData.label),
        statuses: [statusId]
      });
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

    // Prune effects if the attack was unsuccessful
    if ( !reverse && outcome.rolls.length && !outcome.rolls.some(r => r.isSuccess) ) outcome.effects.length = 0;

    // Call outcome confirmation actor hooks
    this.callActorHooks("confirmActionOutcome", action, outcome, {reverse});

    // Apply changes to the Actor
    await this.alterResources(outcome.resources, outcome.actorUpdates, {reverse});
    await this.#applyOutcomeEffects(outcome, reverse);
    await this.#trackHeroismDamage(outcome.resources, reverse);

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
   * Track the amount of damage or healing dealt during the combat encounter.
   * @param {Record<string, number>} resources
   * @param {boolean} reverse
   */
  async #trackHeroismDamage(resources, reverse) {
    if ( !game.combat?.active ) return;
    let delta = 0;
    for ( const r of ["health", "wounds", "morale", "madness"] ) delta += (resources[r] || 0);
    if ( delta === 0 ) return;
    if ( reverse ) delta *= -1;
    const heroism = Math.max((game.settings.get("crucible", "heroism") || 0) + delta, 0);
    await game.settings.set("crucible", "heroism", heroism);
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
   * @returns {Promise<void>}
   */
  async onStartTurn() {

    // Re-prepare data and re-render the actor sheet
    this.reset();
    this._sheet?.render(false);

    // Skip cases where the actor delayed, and it is now their turn again
    const {round, from, to} = this.flags.crucible?.delay || {};
    if ( from && (round === game.combat.round) && (game.combat.combatant?.initiative === to) ) return;

    // Clear system statuses
    await this.update({"system.status": null});

    // Remove Active Effects which expire at the start of a turn (round)
    await this.expireEffects(true);

    // Apply damage-over-time before recovery
    await this.applyDamageOverTime();

    // Recover resources
    const resources = {};
    const updates = {};
    if ( !this.isIncapacitated ) {
      resources.action = Infinity; // Try to recover as much action as possible, in case your maximum increases
      if ( this.talentIds.has("lesserregenerati") && !this.system.isWeakened ) resources.health = 1;
      if ( this.talentIds.has("irrepressiblespi") && !this.system.isBroken ) resources.morale = 1;
    }
    await this.alterResources(resources, updates);
  }

  /* -------------------------------------------- */

  /**
   * Actions that occur at the end of an Actor's turn in Combat.
   * This method is only called for one User who has ownership permission over the Actor.
   * @returns {Promise<void>}
   */
  async onEndTurn() {

    // Re-prepare data and re-render the actor sheet
    this.reset();
    this._sheet?.render(false);

    // Skip cases where the turn is over because the actor delayed
    const {round, from, to} = this.flags.crucible?.delay || {};
    if ( from && (round === game.combat.round) && (game.combat.combatant?.initiative > to) ) return;

    // Conserve Effort
    if ( this.talentIds.has("conserveeffort00") && this.system.resources.action.value ) {
      await this.alterResources({focus: 1}, {}, {statusText: "Conserve Effort"});
    }

    // Remove active effects which expire at the end of a turn
    await this.expireEffects(false);

    // Clear delay flags
    if ( this.flags.crucible?.delay ) await this.update({"flags.crucible.-=delay": null});
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
      await this.alterResources(damage, {}, {statusText: effect.label});
    }
  }

  /* -------------------------------------------- */

  /**
   * Expire active effects whose durations have concluded at the end of the Actor's turn.
   * @param {boolean} start       Is it the start of the turn (true) or the end of the turn (false)
   * @returns {Promise<void>}
   */
  async expireEffects(start=true) {
    const toDelete = [];
    for ( const effect of this.effects ) {
      if ( this.#isEffectExpired(effect, start) ) toDelete.push(effect.id);
    }
    await this.deleteEmbeddedDocuments("ActiveEffect", toDelete);
  }

  /* -------------------------------------------- */

  /**
   * Test whether an ActiveEffect is expired.
   * @param {ActiveEffect} effect       The effect being tested
   * @param {boolean} start             Is it the start of the turn (true) or the end of the turn (false)
   * @returns {boolean}
   */
  #isEffectExpired(effect, start=true) {
    const {startRound, rounds, turns} = effect.duration;
    const elapsed = game.combat.round - startRound + 1;

    // Turn-based effects expire at the end of the turn
    if ( turns > 0 ) {
      if ( start ) return false;
      return elapsed >= turns;
    }

    // Round-based effects expire at the start of the turn
    else if ( rounds > 0 ) {
      if ( !start ) return false;
      return elapsed > rounds;
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
    const updates = [];
    const packs = [SYSTEM.COMPENDIUM_PACKS.talent, SYSTEM.COMPENDIUM_PACKS.talentExtensions].reduce((arr, id) => {
      const pack = game.packs.get(id);
      if ( pack ) arr.push(pack);
      return arr;
    }, []);
    for ( const item of this._source.items ) {
      if ( item.type !== "talent" ) continue;
      for ( const pack of packs ) {
        if ( !pack.index.has(item._id) ) continue;
        const talent = await pack.getDocument(item._id);
        if ( talent ) updates.push(talent.toObject());
      }
    }
    await this.updateEmbeddedDocuments("Item", updates, {diff: false, recursive: false, noHook: true});
    await this.update({"_stats.systemVersion": game.system.version});
  }

  /* -------------------------------------------- */

  /**
   * Handle requests to add a new Talent to the Actor.
   * Confirm that the Actor meets the requirements to add the Talent, and if so create it on the Actor
   * @param {CrucibleItem} talent     The Talent item to add to the Actor
   * @param {object} [options]        Options which configure how the Talent is added
   * @param {boolean} [options.dialog]    Prompt the user with a confirmation dialog?
   * @returns {Promise<CrucibleItem|null>} The created talent Item or null if no talent was added
   */
  async addTalent(talent, {dialog=false}={}) {

    // Confirm that the Actor meets the requirements to add the Talent
    try {
      talent.system.assertPrerequisites(this);
    } catch(err) {
      ui.notifications.warn(err.message);
      return null;
    }

    // Confirmation dialog
    if ( dialog ) {
      const confirm = await foundry.applications.api.DialogV2.confirm({
        window: {title: `Purchase Talent: ${talent.name}`},
        content: `<p>Spend 1 Talent Point to purchase <strong>${talent.name}</strong>?</p>`,
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
    if ( !this._id ) {
      const talentCopy = talent.constructor.fromSource(talent.toObject(), {parent: this});
      this.items.set(talentCopy.id, talentCopy);
      this.reset();
      if ( crucible.tree.actor === this ) crucible.tree.refresh();
    }

    // Add permanently to a persisted Actor
    return talent.constructor.create(talent.toObject(), {parent: this, keepId: true});
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
   * @param {CrucibleItem} item               An Item document, object of Item data, or null to clear data
   * @param {object} [options]                Options which affect how details are applied
   * @param {boolean} [options.canApply]        Allow new detail data to be applied?
   * @param {boolean} [options.canClear]        Allow the prior data to be cleared if null is passed?
   * @returns {Promise<void>}
   * @internal
   */
  async _applyDetailItem(item, {canApply=true, canClear=false}={}) {
    const type = item.type;
    if ( !item && !canClear ) {
      throw new Error(`You are not allowed to clear ${type} data from Actor ${this.name}`);
    }
    if ( item && !canApply ) {
      throw new Error(`You are not allowed to apply ${type} data to Actor ${this.name}`);
    }
    if ( !(item.type in this.system.details) ) {
      throw new Error(`Incorrect detail item type ${type} for Actor type ${this.type}`);
    }
    if ( !canApply ) {
      throw new Error(`You are not allowed to apply this ${type} item to Actor type ${this.type}`);
    }

    // Prepare data
    const key = `system.details.==${type}`;
    const updateData = {};
    let message;

    // Remove existing talents
    const existing = this.system.details[type];
    if ( existing?.talents?.size ) {
      const deleteIds = Array.from(existing.talents).reduce((arr, uuid) => {
        const documentId = foundry.utils.parseUuid(uuid);
        if ( this.items.has(documentId) ) arr.push(documentId);
        return arr;
      }, []);
      await this.deleteEmbeddedDocuments("Item", deleteIds);
    }

    // Clear the detail data
    if ( !item ) updateData[key] = null;

    // Add new detail data
    else {
      const itemData = item.toObject();
      const detail = updateData[key] = Object.assign(itemData.system, {name: itemData.name, img: itemData.img});
      if ( detail.talents?.length ) {
        updateData.items = [];
        for ( const uuid of detail.talents ) {
          const doc = await fromUuid(uuid);
          if ( doc ) updateData.items.push(doc.toObject());
        }
      }
      message = game.i18n.format("ACTOR.AppliedDetailItem", {name: detail.name, type, actor: this.name});
    }

    // Perform the update
    await this.update(updateData, {keepEmbeddedIds: true});
    if ( message ) ui.notifications.info(message);
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
  /*  Equipment Management Methods                */
  /* -------------------------------------------- */

  /**
   * Equip an owned armor Item.
   * @param {string} itemId       The owned Item id of the Armor to equip
   * @param {object} [options]    Options which configure how armor is equipped
   * @param {boolean} [options.equipped]  Is the armor being equipped (true), or unequipped (false)
   * @return {Promise}            A Promise which resolves once the armor has been equipped or un-equipped
   */
  async equipArmor(itemId, {equipped=true}={}) {
    const current = this.equipment.armor;
    const item = this.items.get(itemId);

    // Modify the currently equipped armor
    if ( current === item ) {
      if ( equipped ) return current;
      else return current.update({"system.equipped": false});
    }

    // Cannot equip armor
    if ( current.id ) {
      return ui.notifications.warn(game.i18n.format("WARNING.CannotEquipSlotInUse", {
        actor: this.name,
        item: item.name,
        type: game.i18n.localize("TYPES.Item.armor")
      }));
    }

    // Equip new armor
    return item.update({"system.equipped": true});
  }

  /* -------------------------------------------- */

  /**
   * Equip an owned weapon Item.
   * @param {string} itemId       The owned Item id of the Weapon to equip. The slot is automatically determined.
   * @param {object} [options]    Options which configure how the weapon is equipped.
   * @param {number} [options.slot]       A specific equipment slot in SYSTEM.WEAPON.SLOTS
   * @param {boolean} [options.equipped]  Whether the weapon should be equipped (true) or unequipped (false)
   * @return {Promise}            A Promise which resolves once the weapon has been equipped or un-equipped
   */
  async equipWeapon(itemId, {slot, equipped=true}={}) {
    const weapon = this.items.get(itemId, {strict: true});
    const action = equipped ? this.#equipWeapon(weapon, slot) : this.#unequipWeapon(weapon);
    // If in combat, use the action
    if ( this.inCombat ) await action.use();
    // Otherwise make the updates directly
    else await this.updateEmbeddedDocuments("Item", action.usage.actorUpdates.items);
  }

  /* -------------------------------------------- */

  /**
   * Identify updates which should be made when un-equipping a weapon.
   * @param {CrucibleItem} [weapon]     A weapon being unequipped
   * @returns {CrucibleAction|null}
   */
  #unequipWeapon(weapon) {
    if ( !weapon.system.equipped ) return null;
    const action = new CrucibleAction({
      id: "equipWeapon",
      name: "Unequip Weapon",
      img: weapon.img,
      cost: {action: 0},
      description: `Unequip the ${weapon.name}.`,
      target: {type: "self", scope: 1}
    }, {actor: this});
    Object.assign(action.usage.actorStatus, {unequippedWeapon: true});
    Object.assign(action.usage.actorUpdates, {items: [{_id: weapon.id, "system.equipped": false}]});
    return action;
  }

  /* -------------------------------------------- */

  /**
   * Identify updates which should be made when equipping a weapon.
   * @param {CrucibleItem} weapon     A weapon being equipped
   * @param {number} slot             A requested equipment slot in SYSTEM.WEAPON.SLOTS
   * @returns {CrucibleAction|null}
   */
  #equipWeapon(weapon, slot) {
    const category = weapon.config.category;
    const slots = SYSTEM.WEAPON.SLOTS;
    const {mainhand, offhand} = this.equipment.weapons;

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
        if ( mainhand.id ) occupied = mainhand;
        else if ( offhand.id ) occupied = offhand;
        break;
      case slots.MAINHAND:
        if ( mainhand.id ) occupied = mainhand;
        break;
      case slots.OFFHAND:
        if ( offhand?.id ) occupied = offhand;
        else if ( mainhand.config.category.hands === 2 ) occupied = mainhand;
        break;
    }
    if ( occupied ) throw new Error(game.i18n.format("WARNING.CannotEquipSlotInUse", {
      actor: this.name,
      item: weapon.name,
      type: game.i18n.localize(slots.label(slot))
    }));

    // Create the action
    const action = new CrucibleAction({
      id: "equipWeapon",
      name: "Equip Weapon",
      img: weapon.img,
      cost: {action: weapon.system.properties.has("ambush") ? 0 : 1},
      description: `Equip the ${weapon.name}.`,
      target: {type: "self", scope: 1}
    }, {actor: this});

    // Equip the weapon as a follow-up actor update
    action.usage.actorUpdates ||= {};
    action.usage.actorUpdates.items ||= [];
    action.usage.actorUpdates.items.push({_id: weapon.id, "system.equipped": true, "system.slot": slot});
    return action;
  }

  /* -------------------------------------------- */

  /**
   * Update the Flanking state of this Actor given a set of engaged Tokens.
   * @param {CrucibleTokenEngagement} engagement      The enemies and allies which this Actor currently has engaged.
   */
  async commitFlanking(engagement) {
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
  /*  Database Workflows                          */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    const updates = {};

    // Begin Character Creation
    if ( !this.pack && (this.type === "hero") && (this.level === 0) ) {
      foundry.utils.setProperty(updates, "flags.core.sheetClass", `crucible.${crucible.CONFIG.heroCreationSheet.name}`);
    }

    // Automatic Prototype Token configuration
    updates.prototypeToken = {bar1: {attribute: "resources.health"}, bar2: {attribute: "resources.morale"}};
    switch ( data.type ) {
      case "hero":
        Object.assign(updates.prototypeToken, {vision: true, actorLink: true, disposition: 1});
        break;
      case "adversary":
        Object.assign(updates.prototypeToken, {vision: false, actorLink: false, disposition: -1});
        break;
    }
    this.updateSource(updates);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preUpdate(data, options, user) {
    await super._preUpdate(data, options, user);

    // Restore resources when level changes
    const a1 = data.system?.advancement;
    if ( !a1 ) return;
    const a0 = this._source.system.advancement;
    const resetResourceKeys = this.type === "hero" ? ["level"] : ["level", "threat"];
    const resetResources = resetResourceKeys.some(k => (k in a1) && (a1[k] !== a0[k]));
    if ( resetResources ) {
      const clone = this.clone();
      clone.updateSource(data);
      Object.assign(data, clone._getRestData());
      if ( this.type === "hero" ) a1.progress = clone.level > this.level ? 0 : clone.system.advancement.next;
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onUpdate(data, options, userId) {
    super._onUpdate(data, options, userId);

    // Locally display scrolling status updates
    this.#displayScrollingStatus(data, options);

    // Apply follow-up database changes only as the initiating user
    if ( game.userId === userId ) {
      this.#updateSize();
      // TODO update size of active tokens
      this.#replenishResources(data);
      this.#applyResourceStatuses(data);
    }

    // Update flanking
    if ( this.system._cachedResources ) {
      const {wasIncapacitated, wasBroken} = this.system._cachedResources || {};
      if ( (this.isIncapacitated !== wasIncapacitated) || (this.system.isBroken !== wasBroken) ) {
        const tokens = this.getActiveTokens(true);
        const activeGM = game.users.activeGM;
        const commit = (activeGM === game.user) && (activeGM?.viewedScene === canvas.id);
        for ( const token of tokens ) token.refreshFlanking(commit);
      }
      this.system._updateCachedResources?.();
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
   * Display changes to the Actor as scrolling combat text.
   */
  #displayScrollingStatus(changed, {statusText}={}) {
    const resources = changed.system?.resources || {};
    const tokens = this.getActiveTokens(true);
    if ( !tokens.length || !this.system._cachedResources ) return;

    // Display resource changes
    for ( let [resourceName, prior] of Object.entries(this.system._cachedResources ) ) {
      if ( resources[resourceName]?.value === undefined ) continue;

      // Get change data
      const resource = SYSTEM.RESOURCES[resourceName];
      const attr = this.system.resources[resourceName];
      const delta = attr.value - prior;
      if ( delta === 0 ) continue;
      const text = `${delta.signedString()} ${statusText ?? resource.label}`;
      const pct = Math.clamp(Math.abs(delta) / attr.max, 0, 1);
      const fontSize = 36 + (36 * pct); // Range between [36, 64]
      const healSign = resource.type === "active" ? 1 : -1;
      const fillColor = resource.color[Math.sign(delta) === healSign ? "heal" : "high"];

      // Display for all tokens
      for ( let token of tokens ) {
        canvas.interface.createScrollingText(token.center, text, {
          anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
          fontSize: fontSize,
          fill: fillColor,
          stroke: 0x000000,
          strokeThickness: 4,
          jitter: 0.5
        });
      }
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
    }
    if ( ("morale" in r) || ("madness" in r) ) {
      await this.toggleStatusEffect("broken", {active: this.system.isBroken && !this.system.isInsane });
      await this.toggleStatusEffect("insane", {active: this.system.isInsane});
    }
  }

  /* -------------------------------------------- */

  /**
   * Update the size of Tokens for this Actor.
   * @returns {Promise<void>}
   */
  async #updateSize() {

    // Prototype token size
    if ( this.size !== this.prototypeToken.width ) {
      await this.update({prototypeToken: {width: this.size, height: this.size}});
    }

    // Active token sizes
    if ( canvas.scene ) {
      const tokens = this.getActiveTokens();
      const updates = [];
      for ( const token of tokens ) {
        if ( token.width !== this.size ) updates.push({_id: token.id, width: this.size, height: this.size});
      }
      await canvas.scene.updateEmbeddedDocuments("Token", updates);
    }
  }

  /* -------------------------------------------- */

  #replenishResources(data) {
    const levelChange = foundry.utils.hasProperty(data, "system.advancement.level");
    const attributeChange = Object.keys(SYSTEM.ABILITIES).some(k => {
      return foundry.utils.hasProperty(data, `system.abilities.${k}`);
    });
    if ( this.isOwner && (levelChange || attributeChange) ) this.rest();
  }

  /* -------------------------------------------- */
  /*  Rendering Helpers                           */
  /* -------------------------------------------- */

  /**
   * Prepare tags displayed about this Actor.
   * @returns {Record<string, string>}
   */
  getTags() {
    return this.system.getTags?.() || {};
  }
}

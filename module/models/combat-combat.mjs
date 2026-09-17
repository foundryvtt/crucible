import {TEMPLATES} from "../chat.mjs";

/**
 * A system sub-type of the Combat document used for combat challenges.
 */
export default class CrucibleCombatChallenge extends foundry.abstract.TypeDataModel {
  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      heroism: new fields.SchemaField({
        actions: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 0}),
        awarded: new fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 0})
      }),
      startedTurns: new fields.SetField(new fields.DocumentIdField({nullable: false})),
      endedTurns: new fields.SetField(new fields.DocumentIdField({nullable: false}))
    };
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    const h = this.heroism;
    const nHeroes = this.parent.combatants.filter(c => c.actor?.type === "hero")?.length || 1;
    h.required = nHeroes * 4 * 3; // Generation rate: 4A per hero over 3 rounds
    h.previous = Math.floor(h.actions / h.required) * h.required;
    h.next = h.previous + h.required;
    h.pct = (h.actions - h.previous) / h.required;
  }

  /* -------------------------------------------- */
  /*  Initiative and Turn Events                  */
  /* -------------------------------------------- */

  /**
   * Apply Morale Escalation to the first and last Combatants to act once a Round exceeds the escalation threshold.
   * @param {CombatRoundEventContext} context  Context for the round change
   * @returns {Promise<void>}
   * @internal
   */
  async _onStartRound(context) {
    const combat = this.parent;
    if ( (combat.turns.length < 2) || (combat.round <= 6) ) return;
    const firstActor = combat.turns[0]?.actor;

    // The last Combatant to act is the last who is not incapacitated
    let lastActor;
    for ( let i=combat.turns.length-1; i>0; i-- ) {
      if ( combat.turns[i].actor?.isIncapacitated !== true ) {
        lastActor = combat.turns[i].actor;
        break;
      }
    }
    const statusText = [{text: _loc("COMBAT.Escalation")}];
    await firstActor?.alterResources({morale: combat.round}, {}, {statusText});
    await lastActor?.alterResources({morale: -combat.round}, {}, {statusText});
  }

  /* -------------------------------------------- */

  /**
   * A Combatant receives one turn start per round, so a rewound turn or a Delayed turn does not repeat it.
   * @param {Combatant} combatant             The Combatant whose turn is beginning
   * @param {CombatTurnEventContext} context  Context for the turn change
   * @returns {Promise<void>}
   * @internal
   */
  async _onStartTurn(combatant, context) {
    if ( this.startedTurns.has(combatant.id) ) return;
    await this.#recordTurnEvent("startedTurns", combatant, context);
    await combatant.actor.onStartTurn(context);
  }

  /* -------------------------------------------- */

  /**
   * A Combatant receives one turn end per round, so a rewound turn does not repeat it.
   * @param {Combatant} combatant             The Combatant whose turn is ending
   * @param {CombatTurnEventContext} context  Context for the turn change
   * @returns {Promise<void>}
   * @internal
   */
  async _onEndTurn(combatant, context) {
    if ( this.endedTurns.has(combatant.id) ) return;
    const actor = combatant.actor;
    if ( !actor ) return;
    // A Combatant which has Delayed does not truly end its turn until the initiative it delayed to
    const {round, from, to} = actor.flags.crucible?.delay || {};
    if ( from && (round === this.parent.round) && (this.parent.combatant?.initiative > to) ) return;
    await this.#recordTurnEvent("endedTurns", combatant, context);
    await actor.onEndTurn(context);
  }

  /* -------------------------------------------- */

  /**
   * Record that a Combatant has received a turn event during the Round currently in progress.
   * @param {"startedTurns"|"endedTurns"} field  The tracking set which is updated
   * @param {Combatant} combatant                The Combatant which received the event
   * @param {CombatTurnEventContext} context     Context for the turn change
   * @returns {Promise<void>}
   */
  async #recordTurnEvent(field, combatant, context) {
    if ( context.round !== this.parent.round ) return; // We moved to the next round and no update is necessary
    await this.parent.update({[`system.${field}`]: [...this[field], combatant.id]});
  }

  /* -------------------------------------------- */

  /**
   * Generate a new set of Initiative rolls for all Combatants at the beginning of a new Round.
   * @param {Partial<CombatData>} data    Combat encounter data being modified
   * @returns {Promise<void>}
   */
  async preUpdateRoundInitiative(data) {
    data.turn = 0; // Force starting at the top of the round, ignoring defeated combatant adjustments
    data.system ||= {};
    data.system.startedTurns = [];
    data.system.endedTurns = [];
    data.combatants = [];
    const results = [];
    const actorUpdates = [];
    for ( const c of this.parent.combatants ) {
      const roll = c.getInitiativeRoll();
      await roll.evaluate();
      data.combatants.push({_id: c.id, initiative: roll.total});
      const r = c.clone({initiative: roll.total}, {keepId: true});
      r.roll = roll;
      results.push(r);
      if ( c.actor?.flags.crucible?.delay ) actorUpdates.push({_id: c.actor.id, "flags.crucible.delay": _del});
    }
    if ( actorUpdates.length ) await Actor.updateDocuments(actorUpdates);
    await this.postInitiativeMessage(data.round, results);
  }

  /* -------------------------------------------- */

  /**
   * Post a chat message with a summary of initiative rolls for the round.
   * @param {number} round
   * @param {object[]} results
   * @returns {Promise<ChatMessage>}
   */
  async postInitiativeMessage(round, results) {
    results.sort(this.parent._sortCombatants);

    // Prepare context data
    const rolls = [];
    const combatants = results.map(i => {
      rolls.push(i.roll);
      const rd = i.roll.data;
      return {
        id: i.id,
        name: i.name,
        boons: Object.values(rd.boons).reduce((t, b) => t + b.number, 0),
        banes: Object.values(rd.banes).reduce((t, b) => t + b.number, 0),
        ability: rd.ability.signedString(),
        initiative: i.initiative
      };
    });

    // Render template and create the Chat Message
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.initiativeReport, {
      combatId: this.parent.id,
      combatantLabel: _loc("COMBAT.INITIATIVE.Combatant"),
      resultLabel: _loc("COMBAT.INITIATIVE.Result"),
      combatants
    });
    const speaker = ChatMessage.getSpeaker();
    speaker.alias = _loc("COMBAT.INITIATIVE.Round", {round});
    return ChatMessage.create({content, rolls, speaker, flags: {
      crucible: {isInitiativeReport: true},
      core: {initiativeRoll: true}
    }});
  }

  /* -------------------------------------------- */

  /**
   * After rendering a chat message, apply dynamic filtering to the produced table.
   * @param {ChatMessage} message
   * @param {HTMLElement} html
   */
  static onRenderInitiativeReport(message, html) {

    // Remove rolls
    html.querySelector(".dice-rolls")?.remove();

    // Hide combatants which are not visible
    const table = html.querySelector(".initiative-report-table");
    const combat = game.combats.get(table?.dataset.combatId);
    if ( !combat ) return;

    // Iterate combatants
    for ( const tr of html.querySelectorAll("tr.combatant") ) {
      const c = combat.combatants.get(tr.dataset.combatantId);
      if ( !c ) continue;
      if ( c.hidden ) {
        if ( game.user.isGM ) tr.classList.add("secret");
        else tr.remove();
      }
    }
  }

  /* -------------------------------------------- */
  /*  Combat Tracker Rendering                    */
  /* -------------------------------------------- */

  /**
   * When the CombatTracker is rendered, add a heroism progress bar.
   * @param {Application} app
   * @param {jQuery} _html
   * @param {object} _options
   */
  static onRenderCombatTracker(app, _html, _options) {
    if ( game.combat?.type !== "combat" ) return;
    const header = app.element.querySelector(".combat-tracker-header");
    const bar = '<div class="heroism-meter"><span class="heroism-bar"></span><span class="heroism-label"></span></div>';
    header.insertAdjacentHTML("beforeend", bar);
    CrucibleCombatChallenge.refreshCombatTracker();
  }

  /* -------------------------------------------- */

  /**
   * Refresh display of the CombatTracker to update the heroism progress bar.
   */
  static refreshCombatTracker() {
    if ( game.combat?.type !== "combat" ) return;
    const meters = [ui.combat.element.querySelector(".heroism-meter")];
    if ( ui.combat.popout?.rendered ) meters.push(ui.combat.popout.element.querySelector(".heroism-meter"));
    const heroism = game.combat.system.heroism;
    const pct = Math.round(heroism.pct * 100);
    for ( const meter of meters ) {
      if ( !meter ) continue;
      const [bar, label] = meter.children;
      bar.style.width = `${pct}%`;
      label.innerText = _loc("COMBAT.HeroismPct", {pct});
      meter.dataset.tooltip = "";
      meter.ariaLabel = _loc("COMBAT.HeroismTooltip");
    }
  }
}

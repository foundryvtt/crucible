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
      })
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

  async preUpdateRoundInitiative(data) {
    data.turn = 0; // Force starting at the top of the round, ignoring defeated combatant adjustments
    data.combatants = [];
    const results = [];
    for ( const c of this.parent.combatants ) {
      const roll = c.getInitiativeRoll();
      await roll.evaluate();
      data.combatants.push({_id: c.id, initiative: roll.total});
      const r = c.clone({initiative: roll.total}, {keepId: true});
      r.roll = roll;
      results.push(r);
    }
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

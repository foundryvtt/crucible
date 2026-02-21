/**
 * A system sub-type of the Combat document used for combat challenges.
 */
export default class CrucibleCombatChallenge extends foundry.abstract.TypeDataModel {
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
  postInitiativeMessage(round, results) {
    results.sort(this.parent._sortCombatants);

    // Format table rows
    const rolls = [];
    const rows = results.map(i => {
      rolls.push(i.roll);
      const rd = i.roll.data;
      const boons = Object.values(rd.boons).reduce((t, b) => t + b.number, 0);
      const banes = Object.values(rd.banes).reduce((t, b) => t + b.number, 0);
      const modifiers = [
        boons > 0 ? `<span class="boons"><i class="fa-solid fa-caret-up" inert></i> ${boons}</span>` : "",
        banes > 0 ? `<span class="banes"><i class="fa-solid fa-caret-down" inert></i> ${banes}</span>` : "",
        `(${rd.ability.signedString()})`
      ].filterJoin(" ");
      return `<tr class="combatant" data-combatant-id="${i.id}">
        <td class="initiative-name">${i.name}</td>
        <td class="initiative-modifiers">${modifiers}</td>
        <td class="initiative-value">${i.initiative}</td>
      </tr>`;
    }).join("");

    // Create the Chat Message
    return ChatMessage.create({
      content: `
      <section class="crucible dice-roll initiative">
      <table class="initiative-table" data-combat-id="${this.parent.id}">
        <thead>
          <tr>
              <th class="initiative-name">Combatant</th>
              <th class="initiative-value" colspan="2">Result</th>
          </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
      </table>
      </section>`,
      rolls,
      speaker: {user: game.user, alias: `Initiative - Round ${round}`},
      "flags.crucible.isInitiativeReport": true
    });
  }

  /* -------------------------------------------- */

  static onRenderInitiativeReport(message, html) {

    // Remove rolls
    html.querySelector(".dice-rolls")?.remove();

    // Hide combatants which are not visible
    const table = html.querySelector(".initiative-table");
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
   */
  static onRenderCombatTracker(app, _html, _options) {
    if ( game.combat?.type !== "combat" ) return;
    const header = app.element.querySelector(".combat-tracker-header");
    const bar = `<div class="heroism-meter"><span class="heroism-bar"></span><span class="heroism-label"></span></div>`;
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
    const pct = `${Math.round(heroism.pct * 100)}%`;
    for ( const meter of meters ) {
      if ( !meter ) continue;
      const [bar, label] = meter.children;
      bar.style.width = pct;
      label.innerText = `Heroism ${pct}`;
      meter.dataset.tooltip = "Progress to next Heroism point";
    }
  }
}

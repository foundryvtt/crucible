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
    }
  }

  /* -------------------------------------------- */

  /** @override */
  prepareDerivedData() {
    const h = this.heroism;
    const nHeroes = Math.max(this.parent.combatants.filter(c => c.actor?.type === "hero")?.length, 3);
    h.required = nHeroes * 6 * 3;
    h.previous = Math.floor(h.actions / h.required) * h.required;
    h.next = h.previous + h.required;
    h.pct = (h.actions - h.previous) / h.required;
  }

  /* -------------------------------------------- */
  /*  Initiative and Turn Events                  */
  /* -------------------------------------------- */

  /**
   * Post a chat message with a summary of initiative rolls for the round.
   * @param {number} round
   * @param {object[]} results
   * @returns {Promise<ChatMessage>}
   */
  postInitiativeMessage(round, results) {
    results.sort(this._sortCombatants);
    const rolls = results.map(e => e.roll);

    // Format table rows
    const rows = results.map(i => {
      const rd = i.roll.data;
      const modifiers = [
        rd.ability.signedString(),
        rd.boons > 0 ? `${rd.boons} Boons` : "",
        rd.banes > 0 ? `${rd.banes} Banes` : ""
      ].filterJoin(", ");
      return `<tr><td>${i.name}</td><td>${modifiers}</td><td>${i.initiative}</td></tr>`;
    }).join("");

    // Create the Chat Message
    return ChatMessage.create({
      content: `
      <section class="crucible dice-roll initiative">
      <table class="initiative-table">
        <thead>
          <tr>
              <th>Combatant</th>
              <th>Modifiers</th>
              <th>Result</th>
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
  /*  Heroism                                     */
  /* -------------------------------------------- */

  /**
   * Award heroism points to hero actors participating in the Combat.
   * @returns {Promise<void>}
   */
  async awardHeroism() {
    const combatants = this.parent.combatants;
    const heroes = [];

    // Scale based on hero level
    const heroLevels = combatants.reduce((arr, c) => {
      if ( c.actor?.type === "hero" ) {
        heroes.push(c.actor);
        arr.push(c.actor.level);
      }
      return arr;
    }, []);
    const actionsRequired = heroLevels.reduce((h, l) => h + l * 12, 0); // TODO maybe shouldn't depend on level
    const earned = Math.floor(this.heroism.actions / actionsRequired);
    const toAward = earned - this.heroism.awarded;
    if ( toAward <= 0 ) return;

    // Award
    for ( const actor of heroes ) {
      const status = {text: "Heroism!", fillColor: SYSTEM.RESOURCES.heroism.color.css};
      await actor.alterResources({heroism: toAward}, {}, {statusText: [status]});
    }
    await this.parent.update({"system.heroism.awarded": earned});
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
    const bar = `<div class="heroism-meter"><span class="heroism-bar"></span><span class="heroism-label"></span></div>`
    header.insertAdjacentHTML("beforeend", bar);
    CrucibleCombatChallenge.refreshCombatTracker();
  }

  /* -------------------------------------------- */

  /**
   * Refresh display of the CombatTracker to update the heroism progress bar.
   */
  static refreshCombatTracker() {
    if ( game.combat?.type !== "combat" ) return;
    const meters = [ui.combat.element.querySelector(".heroism-meter")]
    if ( ui.combat.popout ) meters.push(ui.combat.popout.element.querySelector(".heroism-meter"));
    const heroism = game.combat.system.heroism;
    const pct = `${Math.round(heroism.pct * 100)}%`
    for ( const meter of meters ) {
      const [bar, label] = meter.children;
      bar.style.width = pct;
      label.innerText = `Heroism ${pct}`;
      meter.dataset.tooltip = "Progress to next Heroism point";
    }
  }
}

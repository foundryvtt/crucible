/**
 * A system sub-type of the Combat document used for combat challenges.
 */
export default class CrucibleCombatChallenge extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      heroism: new fields.SchemaField({
        actions: new fields.NumberField({required: true, integer: true, min: 0}),
        awarded: new fields.NumberField({required: true, integer: true, min: 0})
      })
    }
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

}

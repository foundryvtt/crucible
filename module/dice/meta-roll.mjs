/**
 * A special class of Roll which serves as a container to package multiple StandardCheck instances together.
 * Each StandardCheck is a member of a DicePool which is canonically the first (and only) term of the MetaRoll.
 * @extends {Roll}
 */
export default class MetaRoll extends Roll {

  /**
   * Access the component rolls within the MetaRoll instance
   * @returns {StandardCheck[]}
   */
  get rolls() {
    return this.terms[0].rolls;
  }

  /* -------------------------------------------- */

  /** @override */
  async render(options) {
    let html = `<section class="dice-rolls">`;
    for ( let r of this.rolls ) {
      html += await r.render(options);
    }
    html += `</section>`;
    return html;
  }

  /* -------------------------------------------- */

  /**
   * Create a MetaRoll instance from an array of StandardCheck rolls
   * @param {StandardCheck[]} rolls     The component rolls which belong to the meta roll
   * @returns {MetaRoll}                The constructed MetaRoll instance
   */
  static fromRolls(rolls) {
    return this.fromTerms([PoolTerm.fromRolls(rolls)]);
  }
}

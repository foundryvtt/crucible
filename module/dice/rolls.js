import { SYSTEM } from "../config/system.js";
import { StandardCheckDialog } from "./apps.js";

/**
 * The standard 3d8 dice pool check used by the system.
 * The rolled formula is determined by:
 *
 * @param {object} rollData     An object of roll data, containing the following optional fields
 * @param {string} actorId      The ID of the actor rolling the check
 * @param {string} type         The type of check being rolled
 * @param {number} dc           The target difficulty of the check
 * @param {number} boons        A number of advantageous boons, up to a maximum of 6
 * @param {number} banes        A number of disadvantageous banes, up to a maximum of 6
 * @param {number} ability      The ability score which modifies the roll, up to a maximum of 12
 * @param {number} skill        The skill bonus which modifies the roll, up to a maximum of 12
 * @param {number} enchantment  An enchantment bonus which modifies the roll, up to a maximum of 6
 */
export class StandardCheck extends Roll {
  constructor(formula, data) {
    super(StandardCheck.FORMULA, data || formula);
    this.app = new StandardCheckDialog(this);
  }

  /* -------------------------------------------- */

  initialize(rollData) {
    this.data = this._prepareData(rollData);
    this._replaceData(this.constructor.FORMULA);
  }

  /* -------------------------------------------- */

  /**
   * Prepare the data structure for the Standard Check
   * @param {object} data
   * @private
   */
  _prepareData(data={}) {

    // Merge provided data with current or default
    const current = this.data || {
      actorId: null,
      type: "generic",
      ability: 0,
      banes: 0,
      boons: 0,
      dc: 15,
      enchantment: 0,
      skill: 0
    };
    data = mergeObject(current, data);

    // Regulate and constrain data contents
    data.ability = Math.clamped(data.ability, 0, 12);
    data.banes = Math.clamped(data.banes, 0, SYSTEM.dice.MAX_BOONS);
    data.boons = Math.clamped(data.boons, 0, SYSTEM.dice.MAX_BOONS);
    data.dc = Math.max(data.dc, 0);
    data.enchantment = Math.clamped(data.enchantment, 0, 6);
    data.skill = Math.clamped(data.skill, 0, 12);
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Get the number of faces for each die in the dice pool
   * @return {number[]}
   * @private
   */
  _getPool() {
    const pool = [8, 8, 8];

    // Apply boons from the left
    let d = 0;
    for ( let i=0; i < this.data.boons; i++ ) {
      pool[d] = pool[d] + SYSTEM.dice.DIE_STEP;
      if ( pool[d] === SYSTEM.dice.MAX_DIE ) d++;
    }

    // Apply banes from the right
    d = 2;
    for ( let i=0; i < this.data.banes; i++ ) {
      pool[d] = pool[d] - SYSTEM.dice.DIE_STEP;
      if ( pool[d] === SYSTEM.dice.MIN_DIE ) d--;
    }
    return pool;
  }

  /* -------------------------------------------- */

  /** @override */
  _replaceData(formula) {
    this.pool = this._getPool();
    let parts = this.pool.map(p => `1d${p}`).concat([this.data.ability, this.data.skill]);
    if ( this.data.enchantment > 0 ) parts.push(this.data.enchantment);
    return parts.join(" + ");
  }

  /* -------------------------------------------- */

  get actor() {
    return this.data.actorId ? game.actors.get(this.data.actorId) : null;
  }

  /* -------------------------------------------- */

  get dialog() {
    return new StandardCheckDialog(this);
  }

  /* -------------------------------------------- */

  async render(chatOptions={}) {
    const isPrivate = chatOptions.isPrivate;
    const html = await renderTemplate(`systems/${SYSTEM.id}/templates/dice/standard-check-chat.html`, {
      cssClass: [SYSTEM.id, "standard-check"].join(" "),
      data: this.data,
      isPrivate: isPrivate,
      formula: this.formula,
      pool: this.dice.map(d => {
        return {
          denom: "d"+d.faces,
          result: isPrivate ? "?" : d.total
        }
      }),
      total: isPrivate ? "?" : this.total
    });
    return html;
  }

  /* -------------------------------------------- */

  toMessage() {
    const actor = this.actor;
    const messageData = {
      flavor: `${actor.name} rolls a ${this.data.type} check`,
      speaker: ChatMessage.getSpeaker({actor, user: game.user})
    };
    return super.toMessage(messageData, {rollMode: this.data.rollMode});
  }

  /* -------------------------------------------- */
  /*  Saving and Loading                          */
  /* -------------------------------------------- */

  /** @override */
  toJSON() {
    const data = super.toJSON();
    data.data = this.data;
    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  static fromData(data) {
    data.formula = data.data;
    const roll = super.fromData(data);
    return roll;
  }
}

StandardCheck.FORMULA = "3d8 + @ability + @skill + @enchantment";
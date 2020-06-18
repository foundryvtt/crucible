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
export class StandardCheck {
  constructor(rollData={}) {
    this.data = {
      actorId: null,
      type: "generic",
      ability: 0,
      banes: 0,
      boons: 0,
      dc: 15,
      enchantment: 0,
      skill: 0
    };
    this.initialize(rollData);
    this.app = new StandardCheckDialog(this);
  }

  /* -------------------------------------------- */

  initialize(data) {
    this.data = this._prepareData(data);
    this.pool = this._getPool();
  }

  /* -------------------------------------------- */

  /**
   * Prepare the data structure for the Standard Check
   * @param {object} data
   * @private
   */
  _prepareData(data) {
    data = mergeObject(this.data, data);
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

  _getRoll() {
    let parts = this.pool.map(p => `1d${p}`).concat(["@ability", "@skill"]);
    if ( this.data.enchantment > 0 ) parts.push("@enchantment");
    return new Roll(parts.join(" + "), this.data);
  }

  /* -------------------------------------------- */

  get actor() {
    return this.data.actorId ? game.actors.get(this.data.actorId) : null;
  }

  /* -------------------------------------------- */

  render(...args) {
    this.app.render(...args);
  }

  /* -------------------------------------------- */

  async roll({chat=true, rollMode="roll"}={}) {
    const actor = this.actor;
    const flavor = `${actor.name} makes a ${this.data.type} check`;
    const roll = this._getRoll();
    if ( chat ) {
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({actor}),
        flavor: flavor
      }, {
        rollMode: rollMode
      });
    }
    return roll;
  }
}

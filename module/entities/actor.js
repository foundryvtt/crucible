import { SYSTEM } from "../config/system.js";


export class CrucibleActor extends Actor {
  constructor(...args) {
    super(...args);

    /**
     * Prepare the configuration entry for this Actor
     * @type {Object}
     */
    this.config = this.prepareConfig();
  }

  /* -------------------------------------------- */
  /*  Actor Configuration
  /* -------------------------------------------- */

  /**
   * Prepare the Configuration object for this Item type.
   * This configuration does not change when the data changes
   */
  prepareConfig() {
    this.prepareData();
  }

  /* -------------------------------------------- */
  /*  Actor Preparation
  /* -------------------------------------------- */

  /**
   * Prepare the data object for this Item.
   * The prepared data will change as the underlying source data is updated
   */
  prepareData() {
    if ( !this.config ) return; // Hack to avoid preparing data before the config is ready
  }

  /* -------------------------------------------- */
}
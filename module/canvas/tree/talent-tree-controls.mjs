const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
/**
 * An Application instance that renders the talent tree controls UI element.
 */
export default class CrucibleTalentTreeControls extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "crucible-talent-controls",
    window: {
      frame: false,
      positioned: false,
    },
    classes: ['crucible', 'flexrow'],
    actions: {
      reset: this._onReset,
      closeTree: this._onCloseTree
    }
  };

  /** @override */
  static PARTS = {
    controls: {
      root: true,
      template: 'systems/crucible/templates/hud/talent-tree-controls.hbs',
    },
  };

  /* -------------------------------------------- */

  /**
   * A convenience reference to the tree instance.
   * @returns {CrucibleTalentTree}
   */
  get tree() {
    return game.system.tree;
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    return {
      actor: this.tree.actor,
      cssClass: this.options.classes.join(" ")
    };
  }

  /* -------------------------------------------- */

  /** @override */
  _insertElement(element) {
    const existing = document.getElementById(element.id);
    if ( existing ) existing.replaceWith(element);
    else crucible.tree.canvas.insertAdjacentElement("afterend", element);
  }
  
  /* -------------------------------------------- */

  /**
   * @this {CrucibleTalentTreeControls}
   * @type {ApplicationClickAction}
   */
  static _onCloseTree() {
    this.tree.close();
  }

  /**
   * @this {CrucibleTalentTreeControls}
   * @type {ApplicationClickAction}
   */
  static _onReset() {
    this.tree.actor.resetTalents({ dialog: true });
  }
}

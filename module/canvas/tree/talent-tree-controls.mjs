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
      positioned: false
    },
    classes: ["crucible", "flexrow"],
    actions: {
      reset: this._onReset,
      closeTree: this._onCloseTree,
      showTalents: this.#onShowTalents,
      showSheet: this.#onShowSheet,
      toggleSearch: this.#onToggleSearch
    }
  };

  /** @override */
  static PARTS = {
    controls: {
      root: true,
      template: "systems/crucible/templates/hud/talent-tree-controls.hbs"
    }
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
      cssClass: this.options.classes.join(" "),
      searchActive: this.tree.filter.rendered
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
   * Handle the action to close the talent tree.
   * @this {CrucibleTalentTreeControls}
   * @type {ApplicationClickAction}
   */
  static _onCloseTree() {
    this.tree.close();
  }

  /**
   * Handle the action to reset all talents for the bound actor.
   * @this {CrucibleTalentTreeControls}
   * @type {ApplicationClickAction}
   */
  static _onReset() {
    this.tree.actor.resetTalents({ dialog: true });
  }

  /* -------------------------------------------- */

  /**
   * Show every configured talent compendium, tiled right to left across the top of the screen.
   * @this {CrucibleTalentTreeControls}
   * @type {ApplicationClickAction}
   */
  static async #onShowTalents() {
    const apps = Array.from(crucible.CONFIG.packs.talent, id => game.packs.get(id)?.apps ?? []).flat();

    // Tile right to left, clear of the filter HUD unless the packs must overlap to fit the screen width
    const margin = 16;
    const {width} = apps[0].options.position;
    const right = window.innerWidth - margin - width;
    const step = apps.length > 1 ? Math.min(width + margin, (right - margin) / (apps.length - 1)) : 0;
    await Promise.all(apps.map(async (app, i) => {
      if ( app.minimized ) await app.maximize();
      await app.render({force: true, position: {left: right - (i * step), top: margin}});
      app.bringToFront();
    }));
  }

  /* -------------------------------------------- */

  /**
   * Show the bound Actor's sheet, opening it at the top-right of the screen if it is not already open.
   * @this {CrucibleTalentTreeControls}
   * @type {ApplicationClickAction}
   */
  static async #onShowSheet() {
    const sheet = this.tree.actor.sheet;
    if ( sheet.rendered ) {
      if ( sheet.minimized ) await sheet.maximize();
      sheet.bringToFront();
      return;
    }
    const left = window.innerWidth - sheet.options.position.width - 16;
    await sheet.render({force: true, position: {left, top: 16}});
  }

  /* -------------------------------------------- */

  /**
   * Toggle display of the talent tree search and filter HUD.
   * @this {CrucibleTalentTreeControls}
   * @type {ApplicationClickAction}
   */
  static async #onToggleSearch() {
    const filter = this.tree.filter;
    if ( filter.rendered ) await filter.close({animate: false});
    else await filter.render({force: true});
    await this.render();
  }
}

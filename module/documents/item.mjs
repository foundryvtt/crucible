/**
 * An Item subclass which handles system specific logic for the Item document type.
 */
export default class CrucibleItem extends foundry.documents.Item {

  /**
   * The partial template used to render a feature granted item.
   * @type {string}
   */
  static INLINE_TEMPLATE_PATH = "systems/crucible/templates/sheets/creation/feature-item.hbs";

  /* -------------------------------------------- */
  /*  Item Attributes                             */
  /* -------------------------------------------- */

  /**
   * Item-specific configuration data which is constructed before any additional data preparation steps.
   * @type {object}
   */
  get config() {
    return this.system.config;
  }

  /**
   * An array of actions that this Item provides.
   * @type {CrucibleAction[]}
   */
  get actions() {
    return this.system.actions;
  }

  /**
   * Current talent rank for this Item
   * @type {TalentRankData}
   */
  get rank() {
    return this.system.currentRank;
  }

  /* -------------------------------------------- */
  /*  Database Workflows                          */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    // Create Identifier
    if ( this.system.schema.has("identifier") && !data.system?.identifier ) {
      this.system.updateSource({"identifier": crucible.api.methods.generateId(this.name ?? this._id)});
    }

    // Handle Owned Item Creation
    if ( this.isOwned ) {
      switch (data.type) {
        case "ancestry":
          if ( this.parent.type === "hero" ) await this.parent.system.applyAncestry(this);
          return false;   // Prevent creation
        case "archetype":
          if ( this.parent.type === "adversary" ) await this.parent.system.applyArchetype(this);
          return false;   // Prevent creation
        case "background":
          if ( this.parent.type === "hero" ) await this.parent.system.applyBackground(this);
          return false;   // Prevent creation
        case "spell":
          try {
            this.parent.canLearnIconicSpell(this);
          } catch(err) {
            return false;
          }
          options.keepId = true;
          break;
        case "talent":
          options.keepId = true;
          options.keepEmbeddedIds = true;
          break;          // Allow creation
        case "taxonomy":
          if ( this.parent.type === "adversary" ) await this.parent.system.applyTaxonomy(this);
          return false;   // Prevent creation
      }
    }
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _onUpdate(data, options, userId) {
    this._displayScrollingStatus(data);
    return super._onUpdate(data, options, userId);
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Provide an array of detail tags which are shown in each item description
   * @param {string} [scope="full"]       The scope of tags being retrieved, "full" or "short"
   * @returns {Record<string, string>}    The tags which describe this Item
   */
  getTags(scope="full") {
    return this.system.getTags?.(scope) || {};
  }

  /* -------------------------------------------- */

  /**
   * Render partial HTML for displaying this item as a standard inline block.
   * @returns {Promise<string>}
   */
  async renderInline() {
    return foundry.applications.handlebars.renderTemplate(this.constructor.INLINE_TEMPLATE_PATH, {
      uuid: this.uuid,
      name: this.name,
      img: this.img,
      tags: this.getTags()
    });
  }

  /* -------------------------------------------- */

  /**
   * Display changes to the Item as scrolling combat text.
   * @private
   */
  _displayScrollingStatus(changed) {
    if ( !this.isOwned ) return;
    if ( !["armor", "weapon"].includes(this.type) ) return;
    const tokens = this.actor.getActiveTokens(true);

    // Equipment changes
    if ( changed.system?.equipped !== undefined ) {
      const text = `${changed.system.equipped ? "+" : "-"}(${this.name})`;
      for ( let token of tokens ) {
        canvas.interface.createScrollingText(token.center, text, {
          anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
          direction: CONST.TEXT_ANCHOR_POINTS[changed.system.equipped ? "TOP" : "BOTTOM"],
          fontSize: 36,
          stroke: 0x000000,
          strokeThickness: 4
        });
      }
    }
  }
}

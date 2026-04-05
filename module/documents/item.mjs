/**
 * An Item subclass which handles system specific logic for the Item document type.
 */
export default class CrucibleItem extends foundry.documents.Item {

  /* -------------------------------------------- */
  /*  Item Attributes                             */
  /* -------------------------------------------- */

  /**
   * If this item belongs to a configured category, report the category identifier.
   * @returns {string}
   */
  get category() {
    return this.system.config?.category?.id || "";
  }

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

  /**
   * Should this item's effects be suppressed?
   * @type {boolean}
   */
  get activeEffectsSuppressed() {
    return this.system.activeEffectsSuppressed || false;
  }

  /* -------------------------------------------- */
  /*  Database Workflows                          */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    // Create Identifier
    if ( this.system.schema?.has("identifier") && !data.system?.identifier ) {
      this.system.updateSource({identifier: crucible.api.methods.generateId(this.name ?? this._id)});
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
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);
    if ( allowed === false ) return false;

    // If physical item without stackable, clamp quantity to [0, 1]
    if ( !(this.system instanceof crucible.api.models.CruciblePhysicalItem) ) return;
    const isStackable = (data.system?.properties && data.system.properties.includes("stackable")) ?? this.system.properties.has("stackable");
    if ( isStackable ) return;
    const currQuantity = data.system?.quantity ?? this.system.quantity;
    foundry.utils.setProperty(data, "system.quantity", Math.clamp(currQuantity, 0, 1));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preCreateDescendantDocuments(parent, collection, data, options, userId) {
    await super._preCreateDescendantDocuments(parent, collection, data, options, userId);
    if ( collection === "effects" ) this.#validateAffixBudget(data);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preUpdateDescendantDocuments(parent, collection, changes, options, userId) {
    await super._preUpdateDescendantDocuments(parent, collection, changes, options, userId);
    if ( collection === "effects" ) this.#validateAffixBudget(changes);
  }

  /* -------------------------------------------- */

  /**
   * Validate that the set of affix effects on this item does not exceed the prefix or suffix budget.
   * Mutates the provided array in-place, removing entries that would exceed capacity.
   * @param {object[]} affixData      The array of creation data or update changes
   */
  #validateAffixBudget(affixData) {
    if ( !this.system.constructor.AFFIXABLE ) return;
    const capacity = this.system.affixCapacity;
    if ( !capacity ) return;
    const remaining = {
      prefix: capacity.prefix.available,
      suffix: capacity.suffix.available
    };
    for ( let i = affixData.length - 1; i >= 0; i-- ) {
      const d = affixData[i];
      if ( d.type !== "affix" ) continue;
      const existing = this.effects.get(d._id);
      const affixType = d.system?.affixType ?? existing?.system.affixType;
      const tierValue = d.system?.tier?.value ?? existing?.system.tier.value ?? 0;
      if ( !affixType ) continue;

      // For updates, account for the current tier being replaced
      if ( existing?.type === "affix" ) remaining[affixType] += existing.system.tier.value;

      // Check budget
      if ( tierValue > remaining[affixType] ) {
        console.warn(`Affix "${d.name || d._id}" exceeds ${affixType} capacity.`);
        affixData.splice(i, 1);
      }
      else remaining[affixType] -= tierValue;
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
   * Render the Item as HTML for tooltip card display, if supported by its item type subclass.
   * @returns {Promise<string>}
   */
  async renderCard() {
    if ( this.system.renderCard instanceof Function ) return this.system.renderCard();
    return "";
  }

  /* -------------------------------------------- */

  /**
   * Render the Item as HTML for inline display, if supported by its item type subclass.
   * @param {object} [options]  Additional rendering options
   * @returns {Promise<string>}
   */
  async renderInline(options={}) {
    if ( this.system.renderInline instanceof Function ) return this.system.renderInline(options);
    return "";
  }

  /* -------------------------------------------- */

  /**
   * Prepare an array of action data for display in a tooltip card or item sheet.
   * @returns {Promise<object[]>}
   */
  async prepareActionsContext() {
    const editorCls = CONFIG.ux.TextEditor;
    const editorOptions = {relativeTo: this, secrets: this.isOwner};
    return Promise.all((this.actions ?? []).map(async action => ({
      id: action.id,
      name: action.name,
      img: action.img,
      condition: action.condition,
      description: await editorCls.enrichHTML(action.description, editorOptions),
      tags: action.getTags(),
      effects: action.effects
    })));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  toAnchor(options={}) {
    const tooltipTypes = ["talent", "spell"];
    if ( tooltipTypes.includes(this.type) ) {
      options.dataset ||= {};
      options.dataset.crucibleTooltip = this.type;
    }
    return super.toAnchor(options);
  }

  /* -------------------------------------------- */

  /**
   * Display changes to the Item as scrolling combat text.
   * @param {object} changed
   * @private
   */
  _displayScrollingStatus(changed) {
    if ( !this.isOwned ) return;
    if ( !["armor", "weapon"].includes(this.type) ) return;
    const tokens = this.actor.getActiveTokens(true);

    // Equipment changes
    if ( changed.system?.equipped !== undefined ) {
      const text = `${changed.system.equipped ? "+" : "-"}(${this.name})`;
      for ( const token of tokens ) {
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

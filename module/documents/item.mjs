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
  /*  Validation                                  */
  /* -------------------------------------------- */

  /** @override */
  static validateJoint(data) {
    const itemModel = CONFIG.Item.dataModels[data.type];
    if ( itemModel?.AFFIXABLE ) CrucibleItem.#validateAffixes(data);
  }

  /* -------------------------------------------- */

  /**
   * Validate the composition of affix effects against their parent item's type and enchantment capacity.
   * @param {Partial<ItemData>} data    Candidate Item data to persist
   * @throws {Error}                    An error if the composition of affixes is disallowed
   */
  static #validateAffixes(data) {
    const AffixModel = CONFIG.ActiveEffect.dataModels.affix;

    // Build affix summaries from raw source effects
    const proposedAffixes = [];
    for ( const effect of (data.effects ?? []) ) {
      if ( effect.type !== "affix" ) continue;
      proposedAffixes.push({
        identifier: effect.system?.identifier,
        affixType: effect.system?.affixType,
        tierValue: effect.system?.tier?.value ?? 1,
        itemTypes: new Set(effect.system?.itemTypes ?? [])
      });
    }
    if ( !proposedAffixes.length ) return;

    // Unique items cannot have affixes
    const properties = new Set(data.system?.properties ?? []);
    if ( properties.has("unique") ) {
      throw new Error("Unique items cannot be enchanted with affixes.");
    }

    // Validate the proposed affix composition
    const TIERS = crucible.CONST.ITEM.QUALITY_TIERS;
    const quality = TIERS[data.system?.quality] ?? TIERS.standard;
    const halfCapacity = quality.capacity / 2;
    const identifiers = new Set();
    let prefixSpent = 0;
    let suffixSpent = 0;
    for ( const affix of proposedAffixes ) {
      if ( identifiers.has(affix.identifier) ) {
        throw new Error(`Duplicate affix identifier "${affix.identifier}".`);
      }
      identifiers.add(affix.identifier);
      if ( affix.itemTypes.size && !affix.itemTypes.has(data.type) ) {
        throw new Error(`Affix "${affix.identifier}" cannot be applied to item type "${data.type}".`);
      }
      if ( affix.affixType === "prefix" ) prefixSpent += affix.tierValue;
      else suffixSpent += affix.tierValue;
    }
    if ( prefixSpent > halfCapacity ) {
      throw new Error(`Prefix affixes (cost ${prefixSpent}) exceed the available prefix capacity of ${halfCapacity}.`);
    }
    if ( suffixSpent > halfCapacity ) {
      throw new Error(`Suffix affixes (cost ${suffixSpent}) exceed the available suffix capacity of ${halfCapacity}.`);
    }
  }

  /* -------------------------------------------- */
  /*  Drop Data                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static async fromDropData(data) {
    if ( data.enchanted ) return CrucibleItem.#fromEnchantedDropData(data);
    return super.fromDropData(data);
  }

  /* -------------------------------------------- */

  /**
   * Compose an enchanted item from drop data containing a base item UUID and affix configuration.
   * @param {object} data                        The drop data
   * @param {string} data.uuid                   The UUID of the base item
   * @param {object} data.enchanted              The enchanted item configuration
   * @param {string} data.enchanted.baseUuid     The UUID of the base item
   * @param {{id: string, tier: number}[]} data.enchanted.affixes  Affix identifiers and tiers
   * @param {string|null} data.enchanted.quality Explicit quality tier, or null for auto-selection
   * @param {string|null} data.enchanted.name    Optional display name override
   * @returns {Promise<CrucibleItem>}
   */
  static async #fromEnchantedDropData(data) {
    const {baseUuid, affixes, quality, name} = data.enchanted;

    // Resolve the base item
    const baseItem = await fromUuid(baseUuid);
    if ( !baseItem ) throw new Error(`Base item "${baseUuid}" not found.`);

    // Resolve affix documents from the compendium
    const affixPack = game.packs.get("crucible.affixes");
    const affixIndex = affixPack.index;
    const affixEffects = [];
    for ( const {id, tier} of affixes ) {
      const indexEntry = affixIndex.find(e => e.system?.identifier === id);
      if ( !indexEntry ) throw new Error(`Affix "${id}" not found in the affixes compendium.`);
      const affixDoc = await affixPack.getDocument(indexEntry._id);
      const affixData = affixDoc.toObject();
      affixData.system.tier.value = Math.clamp(tier, affixData.system.tier.min, affixData.system.tier.max);
      affixEffects.push(affixData);
    }

    // Determine quality tier
    let selectedQuality = quality;
    if ( !selectedQuality ) {
      const QT = crucible.CONST.ITEM.QUALITY_TIERS;
      let prefixCost = 0;
      let suffixCost = 0;
      for ( let i = 0; i < affixEffects.length; i++ ) {
        const ae = affixEffects[i];
        if ( ae.system.affixType === "prefix" ) prefixCost += ae.system.tier.value;
        else suffixCost += ae.system.tier.value;
      }
      for ( const tier of Object.values(QT) ) {
        const half = tier.capacity / 2;
        if ( (prefixCost <= half) && (suffixCost <= half) ) {
          selectedQuality = tier.id;
          break;
        }
      }
      if ( !selectedQuality ) selectedQuality = "masterwork";
    }

    // Clone the base item with enchanted modifications
    const itemData = baseItem.toObject();
    itemData.system.quality = selectedQuality;
    itemData.effects = [...(itemData.effects || []), ...affixEffects];

    // Compose the item name
    if ( name ) {
      itemData.name = name;
    } else {
      const CPI = crucible.api.models.CruciblePhysicalItem;
      const composed = CPI.composeItemName(baseItem.name, affixEffects.map(ae => ({
        name: ae.name,
        system: ae.system
      })));
      if ( composed ) itemData.name = composed;
    }

    // Flag compendium source
    itemData._stats ??= {};
    itemData._stats.compendiumSource = baseUuid;
    delete itemData._id;

    // Construct and validate the composed item
    try {
      return new Item.implementation(itemData);
    } catch(err) {
      const reason = err.cause?.message || err.message;
      ui.notifications.error(game.i18n.format("ITEM.WARNINGS.EnchantedDropError", {name: itemData.name, reason}));
      throw err;
    }
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

    // Prevent marking an item as unique if it has affixes
    if ( data.system?.properties && this.system.constructor.AFFIXABLE ) {
      const newProperties = new Set(data.system.properties);
      const hasAffixes = this.effects.some(e => e.type === "affix");
      if ( newProperties.has("unique") && !this.system.properties.has("unique") && hasAffixes ) {
        ui.notifications.warn(_loc("ITEM.WARNINGS.UniqueWithAffixes", {name: this.name}));
        return false;
      }
    }

    // Prevent quality reduction if affixes require the current capacity
    if ( data.system?.quality && this.system.constructor.AFFIXABLE ) {
      const newQuality = crucible.CONST.ITEM.QUALITY_TIERS[data.system.quality];
      const capacity = this.system.affixCapacity;
      if ( newQuality && capacity ) {
        const newHalf = newQuality.capacity / 2;
        if ( (capacity.prefix.spent > newHalf) || (capacity.suffix.spent > newHalf) ) {
          ui.notifications.warn(_loc("ITEM.WARNINGS.QualityReductionBlocked", {name: this.name}));
          delete data.system.quality;
        }
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

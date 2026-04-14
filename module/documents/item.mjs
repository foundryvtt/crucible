/**
 * @typedef CrucibleItemSnapshot
 * A serializable snapshot of item stateful data, captured at action-use time. Structured as an item update object.
 * Each item subtype declares its own STATEFUL_FIELDS; properties not relevant to a given subtype will be absent.
 * @property {string} _id                           The Item ID
 * @property {object} system                        The stateful system data
 * @property {boolean} [system.broken]              Was the item broken?
 * @property {boolean} [system.dropped]             Was the item dropped?
 * @property {boolean} [system.equipped]            Was the item equipped?
 * @property {boolean} [system.invested]            Was the item invested?
 * @property {boolean} [system.loaded]              Was the weapon loaded?
 * @property {number} [system.quantity]              Item stack quantity
 * @property {number} [system.slot]                 Weapon equipment slot
 * @property {object} [system.uses]                 Consumable remaining uses
 */

/**
 * An Item subclass which handles system specific logic for the Item document type.
 */
export default class CrucibleItem extends foundry.documents.Item {

  /**
   * Cached form values from the last randomizeDialog invocation.
   * @type {object}
   */
  static #lastRandomizeParams = {priceMin: 1000, priceMax: 10000, baseUuid: "", itemTypes: [], quality: ""};

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

  /**
   * Snapshot the stateful properties of this item at the time an Action is performed.
   * Properties outside the STATEFUL_FIELDS list are assumed to be permanent attributes of the item and not stateful.
   * @returns {CrucibleItemSnapshot}
   */
  snapshot() {
    const fields = this.system.constructor.STATEFUL_FIELDS;
    if ( !fields ) return {_id: this.id, system: {}};
    const source = this.system.toObject();
    return fields.reduce((obj, field) => {
      obj.system[field] = source[field];
      return obj;
    }, {_id: this.id, system: {}});
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
    if ( data.loot ) {
      const {baseUuid, affixes, ...options} = data.loot;
      return CrucibleItem.#fromLootDropData(baseUuid, affixes, options);
    }
    return super.fromDropData(data);
  }

  /* -------------------------------------------- */

  /**
   * Compose a loot item from a base item UUID and a set of affix configurations.
   * @param {string} baseUuid                       The UUID of the base item
   * @param {{id: string, tier: number}[]} affixes  Affix identifiers and tiers to apply
   * @param {object} [options]                      Additional options
   * @param {string} [options.quality]              Explicit quality tier, or auto-selected if omitted
   * @param {string} [options.name]                 Display name override, or auto-composed from affixes
   * @param {boolean} [options.broken]              Whether the item should be broken, if relevant
   * @returns {Promise<CrucibleItem>}               The generated item with enchantments applied
   * @throws {Error}                                An error if the requested affixes are incompatible with the item
   */
  static async #fromLootDropData(baseUuid, affixes, {quality, name, broken}={}) {

    // Resolve the base item
    const baseItem = await fromUuid(baseUuid);
    if ( !baseItem ) throw new Error(`Base item "${baseUuid}" not found.`);
    // Resolve affix documents from configured compendium packs
    const affixEffects = [];
    if ( affixes.length ) {
      const affixPacks = Array.from(crucible.CONFIG.packs.affix).map(id => game.packs.get(id)).filter(Boolean);
      const identifiers = new Set(affixes.map(a => a.id));
      const toLoad = new Map();
      for ( const pack of affixPacks ) {
        if ( !pack.indexed ) await pack.getIndex();
        if ( !toLoad.has(pack) ) toLoad.set(pack, []);
        for ( const idx of pack.index.values() ) {
          if ( !identifiers.size ) break;
          if ( identifiers.has(idx.system?.identifier) ) {
            toLoad.get(pack).push(idx._id);
            identifiers.delete(idx.system.identifier);
          }
        }
      }
      if ( identifiers.size ) {
        throw new Error(`Requested Affixes not found in compendium: ${Array.from(identifiers).join(", ")}`);
      }
      const affixData = {};
      await Promise.all(toLoad.entries().map(async ([pack, ids]) => {
        const docs = await pack.getDocuments({_id__in: ids});
        for ( const doc of docs ) affixData[doc.system.identifier] = doc.toObject();
      }));
      for ( const {id, tier} of affixes ) {
        const ae = affixData[id];
        ae.system.tier.value = Math.clamp(tier, ae.system.tier.min, ae.system.tier.max);
        affixEffects.push(ae);
      }
    }

    // Determine quality tier
    let selectedQuality = quality;
    if ( !selectedQuality && affixEffects.length ) {
      let prefixCost = 0;
      let suffixCost = 0;
      for ( const ae of affixEffects ) {
        if ( ae.system.affixType === "prefix" ) prefixCost += ae.system.tier.value;
        else suffixCost += ae.system.tier.value;
      }
      const QT = crucible.CONST.ITEM.QUALITY_TIERS;
      for ( const tier of Object.values(QT) ) {
        const half = tier.capacity / 2;
        if ( (prefixCost <= half) && (suffixCost <= half) ) {
          selectedQuality = tier.id;
          break;
        }
      }
      if ( !selectedQuality ) selectedQuality = "masterwork";
    }

    // Clone the base item with loot modifications
    const itemData = baseItem.toObject();
    if ( selectedQuality ) itemData.system.quality = selectedQuality;
    if ( broken ) itemData.system.broken = true;
    itemData.effects = [...(itemData.effects || []), ...affixEffects];

    // Compose the item name
    itemData.name = name || crucible.api.models.CruciblePhysicalItem.composeItemName(baseItem.name, affixEffects)
      || baseItem.name;

    // Flag compendium source
    itemData._stats ??= {};
    itemData._stats.compendiumSource = baseUuid;
    delete itemData._id;

    // Construct and validate the composed item
    try {
      return new this(itemData);
    } catch(err) {
      const reason = err.cause?.message || err.message;
      ui.notifications.error(game.i18n.format("ITEM.WARNINGS.LootDropError", {name: itemData.name, reason}));
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

  /* -------------------------------------------- */

  /**
   * Test whether an item is stackable with another item
   * @param {CrucibleItem} other
   * @returns {boolean}
   */
  isStackableWith(other) {
    if ( !(this.system instanceof crucible.api.models.CruciblePhysicalItem) ) return false;
    if ( !this.system.properties.has("stackable") ) return false;
    if ( this.effects.size || other.effects.size ) return false; // Affixes never stack
    const cleanData = this.toObject();
    const cleanOther = other.toObject();
    for ( const data of [cleanData, cleanOther] ) {
      delete data._id;
      delete data._stats;
      delete data.system.quantity;
      delete data.sort;
      delete data.ownership;
      delete data.folder;
    }
    return foundry.utils.equals(cleanData, cleanOther);
  }

  /* -------------------------------------------- */
  /*  Randomization                               */
  /* -------------------------------------------- */

  /**
   * Generate a randomized loot item within a given price budget.
   * @param {object} options
   * @param {{min: number, max: number}} options.price   Required price range in currency
   * @param {string} [options.baseUuid]                  Optional UUID of a specific base item to enchant
   * @param {string|string[]} [options.itemTypes]         Optional item type filter(s)
   * @param {string} [options.quality]                   Optional forced quality tier
   * @param {number} [options.maxRetries=10]             Maximum retry attempts
   * @returns {Promise<CrucibleItem>}
   */
  static async randomize({price, baseUuid, itemTypes, quality, maxRetries=10}={}) {
    if ( !Number.isNumeric(price?.min) || !Number.isNumeric(price?.max) ) {
      throw new Error("A price range {min, max} is required.");
    }
    const affixableTypes = crucible.CONST.ITEM.AFFIXABLE_ITEM_TYPES;

    // Load all equipment items and all affixes from configured packs
    const allEquipment = [];
    for ( const packId of crucible.CONFIG.packs.equipment ) {
      const pack = game.packs.get(packId);
      if ( pack ) allEquipment.push(...await pack.getDocuments());
    }
    const allAffixes = [];
    for ( const packId of crucible.CONFIG.packs.affix ) {
      const pack = game.packs.get(packId);
      if ( pack ) allAffixes.push(...await pack.getDocuments());
    }

    // Filter base item candidates
    let candidates;
    if ( baseUuid ) {
      const item = await fromUuid(baseUuid);
      if ( !item ) throw new Error(`Base item "${baseUuid}" not found.`);
      candidates = [item];
    } else {
      const allowedTypes = itemTypes?.length ? new Set(itemTypes) : affixableTypes;
      candidates = allEquipment.filter(item => {
        if ( !(item.system instanceof crucible.api.models.CruciblePhysicalItem) ) return false;
        if ( !allowedTypes.has(item.type) ) return false;
        if ( item.system.price > price.max ) return false;
        return true;
      });
    }
    if ( !candidates.length ) throw new Error("No eligible base items found for the given constraints.");

    // Attempt randomization with retries
    for ( let attempt = 0; attempt < maxRetries; attempt++ ) {
      try {
        const result = CrucibleItem.#randomizeAttempt(candidates, allAffixes, {price, quality});
        if ( result ) return result;
      } catch(err) {
        if ( attempt === (maxRetries - 1) ) throw err;
      }
    }
    throw new Error(`Failed to generate a valid randomized item within ${maxRetries} attempts.`);
  }

  /* -------------------------------------------- */

  /**
   * A single attempt at randomizing an item.
   * @param {CrucibleItem[]} candidates                 Eligible base items
   * @param {ActiveEffect[]} allAffixes                 All affix documents from the compendium
   * @param {object} context                            Shared context
   * @param {{min: number; max: number}} context.price  Required price range in currency
   * @param {string} [context.quality]                  Optional forced quality tier
   * @returns {CrucibleItem|null}
   */
  static #randomizeAttempt(candidates, allAffixes, {price, quality: forcedQuality}) {

    // Step 1: Select a random base item
    const baseItem = candidates[Math.floor(Math.random() * candidates.length)];
    const basePrice = baseItem.system._source.price;

    // Step 2: Determine which rarity values produce a price within range
    const validRarities = [];
    for ( let r = -3; r <= 10; r++ ) {
      const p = baseItem.system.constructor.computePrice(basePrice, r);
      if ( (p >= price.min) && (p <= price.max) ) validRarities.push(r);
    }
    if ( !validRarities.length ) return null;
    const targetRarity = validRarities[Math.floor(Math.random() * validRarities.length)];

    // Step 3: Find a quality + broken + affixTiers combination that achieves target rarity
    const QT = crucible.CONST.ITEM.QUALITY_TIERS;
    const qualityTiers = forcedQuality ? [QT[forcedQuality]] : Object.values(QT);
    const viable = [];
    for ( const qt of qualityTiers ) {
      if ( !qt ) continue;
      for ( const broken of [false, true] ) {
        const needed = targetRarity - qt.rarity - (broken ? -2 : 0);
        if ( (needed < 0) || (needed > qt.capacity) ) continue;

        // Verify prefix/suffix split is achievable
        const half = qt.capacity / 2;
        if ( needed > (half * 2) ) continue;
        viable.push({quality: qt, broken, affixTiers: needed});
      }
    }
    if ( !viable.length ) return null;
    const chosen = viable[Math.floor(Math.random() * viable.length)];

    // Step 4: Select random affixes to fill the needed tier budget
    const eligibleAffixes = allAffixes.filter(a => {
      if ( a.type !== "affix" ) return false;
      const types = a.system.itemTypes;
      return !types.size || types.has(baseItem.type);
    });
    const prefixPool = eligibleAffixes.filter(a => a.system.affixType === "prefix");
    const suffixPool = eligibleAffixes.filter(a => a.system.affixType === "suffix");

    const affixEffects = [];
    if ( chosen.affixTiers > 0 ) {
      const half = chosen.quality.capacity / 2;

      // Randomly split budget between prefix and suffix within capacity
      const maxPrefix = Math.min(chosen.affixTiers, half);
      const minPrefix = Math.max(0, chosen.affixTiers - half);
      const prefixBudget = minPrefix + Math.floor(Math.random() * (maxPrefix - minPrefix + 1));
      const suffixBudget = chosen.affixTiers - prefixBudget;

      // Draw affixes for each budget
      const drawAffixes = (pool, budget) => {
        const drawn = [];
        const used = new Set();
        let remaining = budget;
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        for ( const affix of shuffled ) {
          if ( remaining <= 0 ) break;
          if ( used.has(affix.system.identifier) ) continue;
          const tier = Math.min(remaining, affix.system.tier.max);
          if ( tier < affix.system.tier.min ) continue;
          const data = affix.toObject();
          data.system.tier.value = tier;
          drawn.push(data);
          used.add(affix.system.identifier);
          remaining -= tier;
        }
        return remaining === 0 ? drawn : null;
      };

      const prefixResult = drawAffixes(prefixPool, prefixBudget);
      const suffixResult = drawAffixes(suffixPool, suffixBudget);
      if ( !prefixResult || !suffixResult ) return null;
      affixEffects.push(...prefixResult, ...suffixResult);
    }

    // Step 5: Compose the item
    const itemData = baseItem.toObject();
    itemData.system.quality = chosen.quality.id;
    itemData.system.broken = chosen.broken;
    itemData.effects = [...(itemData.effects || []), ...affixEffects];

    // Compose item name
    const composed = baseItem.system.constructor.composeItemName(baseItem.name, affixEffects.map(ae => ({
      name: ae.name, system: ae.system
    })), {quality: chosen.quality});
    if ( composed ) itemData.name = composed;

    // Flag compendium source
    itemData._stats ??= {};
    itemData._stats.compendiumSource = baseItem.uuid;
    delete itemData._id;
    return new this(itemData);
  }

  /* -------------------------------------------- */

  /**
   * Format a currency value as a human-readable string with denomination abbreviations.
   * @param {number} value    The total currency value in base units
   * @returns {string}
   */
  static formatCurrency(value) {
    const allocated = crucible.api.documents.CrucibleActor.allocateCurrency(value);
    const parts = [];
    for ( const [key, amount] of Object.entries(allocated) ) {
      if ( !amount ) continue;
      parts.push(`${amount}${game.i18n.localize(crucible.CONFIG.currency[key].abbreviation)}`);
    }
    return parts.join(" ") || "0";
  }

  /* -------------------------------------------- */

  /**
   * Build an @Loot enricher string representing this item's base, affixes, quality, and name.
   * @returns {string}              The enricher string
   */
  toLootEnricher() {
    const baseUuid = this._stats?.compendiumSource;
    if ( !baseUuid ) throw new Error("Item has no compendium source for enricher reconstruction.");
    const tokens = [];
    for ( const effect of (this.effects ?? []) ) {
      if ( effect.type !== "affix" ) continue;
      const id = effect.system.identifier;
      const tier = effect.system.tier.value;
      tokens.push(tier === 1 ? id : `${id}=${tier}`);
    }
    tokens.push(`quality=${this.system.quality}`);
    if ( this.system.broken ) tokens.push("broken=true");
    return `@Loot[${baseUuid} ${tokens.join(" ")}]{${this.name}}`;
  }

  /* -------------------------------------------- */

  /**
   * Present a dialog for generating a randomized loot item and output the result as a ChatMessage.
   * GM-only entry point that wraps {@link CrucibleItem.randomize}.
   * @returns {Promise<ChatMessage|null>}
   */
  static async randomizeDialog() {
    if ( !game.user.isGM ) {
      ui.notifications.warn(game.i18n.localize("ITEM.RANDOMIZE.GMOnly"));
      return null;
    }
    const fields = foundry.data.fields;
    const _loc = game.i18n.localize.bind(game.i18n);
    const QT = crucible.CONST.ITEM.QUALITY_TIERS;
    const affixableTypes = crucible.CONST.ITEM.AFFIXABLE_ITEM_TYPES;

    // Retrieve cached parameters from last invocation
    const p = CrucibleItem.#lastRandomizeParams;
    if ( !p.itemTypes.length ) p.itemTypes = Array.from(affixableTypes);

    // Build form fields
    const currencyInput = (field, config) => {
      return crucible.api.applications.elements.HTMLCrucibleCurrencyElement.create(config);
    };
    const priceMinField = new fields.NumberField({label: _loc("ITEM.RANDOMIZE.PriceMin")});
    const priceMaxField = new fields.NumberField({label: _loc("ITEM.RANDOMIZE.PriceMax")});
    const baseUuidField = new fields.DocumentUUIDField({label: _loc("ITEM.RANDOMIZE.BaseItem"),
      required: false, blank: true, type: "Item"});
    const itemTypesField = new fields.SetField(new fields.StringField({
      choices: Object.fromEntries(Array.from(affixableTypes).map(t => [t, game.i18n.localize(`TYPES.Item.${t}`)]))
    }), {label: _loc("ITEM.RANDOMIZE.ItemTypes")});
    const qualityField = new fields.StringField({label: _loc("ITEM.RANDOMIZE.Quality"), required: false,
      blank: true, choices: {"": _loc("ITEM.RANDOMIZE.QualityAny"),
        ...Object.fromEntries(Object.values(QT).map(q => [q.id, _loc(q.label)]))}});

    // Build form content
    const dialogHTML = document.createElement("div");
    dialogHTML.append(
      priceMinField.toFormGroup({}, {name: "priceMin", input: currencyInput, value: p.priceMin}),
      priceMaxField.toFormGroup({}, {name: "priceMax", input: currencyInput, value: p.priceMax}),
      baseUuidField.toFormGroup({}, {name: "baseUuid", value: p.baseUuid}),
      itemTypesField.toFormGroup({stacked: true}, {name: "itemTypes", type: "checkboxes",
        value: p.itemTypes}),
      qualityField.toFormGroup({}, {name: "quality", value: p.quality})
    )

    // Present the dialog
    const data = await foundry.applications.api.DialogV2.prompt({
      window: {title: _loc("ITEM.RANDOMIZE.Title"), icon: "fa-wand-sparkles"},
      position: {width: 520},
      content: dialogHTML,
      ok: {
        label: _loc("ITEM.RANDOMIZE.Generate"),
        icon: "fa-solid fa-wand-sparkles",
        callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
      },
      rejectClose: false
    });
    if ( !data ) return null;
    const itemTypes = data.itemTypes ?? [];

    // Cache form values for subsequent invocations
    Object.assign(p, {
      priceMin: data.priceMin,
      priceMax: data.priceMax,
      baseUuid: data.baseUuid || "",
      itemTypes,
      quality: data.quality || ""
    });

    // Randomize the item
    let item;
    try {
      item = await CrucibleItem.randomize({
        price: {min: data.priceMin, max: data.priceMax},
        quality: data.quality || undefined,
        itemTypes,
        baseUuid: data.baseUuid || undefined
      });
    } catch(err) {
      ui.notifications.error(err.message);
      return null;
    }

    // Build chat message with @Loot enricher string
    const enricherString = item.toLootEnricher();
    const priceLabel = CrucibleItem.formatCurrency(item.system.price);
    const messageContent = `<p>${enricherString} (${priceLabel})</p>`;
    return ChatMessage.implementation.create({content: messageContent});
  }
}

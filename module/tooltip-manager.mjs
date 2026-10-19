/**
 * A TooltipManager which renders Crucible dynamic tooltips and keeps button tooltips unstyled.
 */
export default class CrucibleTooltipManager extends foundry.helpers.interaction.TooltipManager {

  /**
   * The shared template which renders a rule tooltip as a title followed by description content.
   * @type {string}
   */
  static RULE_TOOLTIP_TEMPLATE = "systems/crucible/templates/tooltips/tooltip-rule.hbs";

  /* -------------------------------------------- */
  /*  Tooltip Activation                          */
  /* -------------------------------------------- */

  /** @inheritDoc */
  activate(element, options={}) {
    if ( element.matches("button, a.button") ) options.cssClass ??= element.dataset.tooltipClass ?? "";
    return super.activate(element, options);
  }

  /* -------------------------------------------- */
  /*  Crucible Dynamic Tooltips                   */
  /* -------------------------------------------- */

  /**
   * Prepare the rendering context for {@link CrucibleTooltipManager.RULE_TOOLTIP_TEMPLATE}.
   * @param {string} name       Title displayed above the description
   * @param {string} tooltip    Description content, either HTML or a plain string
   * @returns {Promise<{name: string, tooltip: string}>}
   */
  static async getRuleTooltipContext(name, tooltip) {
    const enriched = await CONFIG.ux.TextEditor.enrichHTML(tooltip);
    return {name, tooltip: enriched.trimStart().startsWith("<p") ? enriched : `<p>${enriched}</p>`};
  }

  /* -------------------------------------------- */

  /**
   * Handle pointer enter events to take control over crucible dynamic system tooltips.
   * @param {PointerEvent} event
   */
  static onPointerEnter(event) {
    if ( !("crucibleTooltip" in event.target.dataset) ) return;
    if ( "tooltipHtml" in event.target.dataset ) return; // Don't double-render
    const cls = CrucibleTooltipManager;
    switch ( event.target.dataset.crucibleTooltip ) {
      case "action":
        return cls.#displayActionTooltip(event);
      case "equipment":
      case "accessory":
      case "activeEffect":
      case "armor":
      case "backpack":
      case "spell":
      case "talent":
      case "toolbelt":
      case "weapon":
        return cls.#displayFromUuid(event);
      case "knowledgeCheck":
        return cls.#displayKnowledgeCheck(event);
      case "loot":
        return cls.#displayLootTooltip(event);
      case "talentCheck":
        return cls.#displayTalentCheck(event);
      case "languageCheck":
        return cls.#displayLanguageCheck(event);
      case "passiveCheck":
        return cls.#displayPassiveCheck(event);
      case "tag":
        return cls.#displayTagTooltip(event);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle pointer leave events to remove the crucible tooltip so it is later regenerated.
   * @param {PointerEvent} event
   */
  static onPointerLeave(event) {
    const element = event.target;
    if ( "crucibleTooltip" in element.dataset ) {
      window.setTimeout(() => {
        if ( (game.tooltip.element === element) || element.matches(":hover") ) return;
        delete element.dataset.tooltipHtml;
      }, 2000);
    }
  }

  /* -------------------------------------------- */

  /**
   * Display an action card as a tooltip.
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #displayActionTooltip(event) {
    const element = event.target;
    const {uuid, actionId} = element.dataset;
    let action;
    if ( uuid === "default" ) action = crucible.api.models.CrucibleAction.getDefaultAction(actionId);
    else {
      const owner = await fromUuid(uuid);
      if ( owner instanceof Actor ) action = owner.actions[actionId];
      else if ( owner instanceof Item ) action = owner.actions.find(a => a.id === actionId);
    }
    if ( !action ) return;
    event.stopImmediatePropagation();

    element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation
    element.dataset.tooltipHtml = await action.renderCard();
    element.dataset.tooltipClass = "crucible crucible-tooltip";
    const pointerover = new event.constructor(event.type, event);
    element.dispatchEvent(pointerover);
  }

  /* -------------------------------------------- */

  /**
   * Display any element retrievable by an uuid which exposes a renderCard function.
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #displayFromUuid(event) {
    const element = event.target;
    const item = await fromUuid(element.dataset.uuid);
    if ( typeof item?.renderCard !== "function" ) return;
    event.stopImmediatePropagation();

    element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation
    element.dataset.tooltipHtml = await item.renderCard();
    element.dataset.tooltipClass = "crucible crucible-tooltip";
    const pointerover = new event.constructor(event.type, event);
    element.dispatchEvent(pointerover);
  }

  /* -------------------------------------------- */

  /**
   * On pointerenter, display a dynamic tooltip for the group knowledge check.
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #displayKnowledgeCheck(event) {
    const element = event.target;
    const knowledgeId = element.dataset.knowledgeId;
    const knowledge = crucible.CONFIG.knowledge[knowledgeId];
    if ( !knowledge || !crucible.party ) return;
    event.stopImmediatePropagation();
    element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation

    const check = async (group, actor) => ({success: actor.hasKnowledge(knowledgeId)});
    element.dataset.tooltipHtml = await crucible.party.system.renderGroupCheckTooltip(check,
      {title: element.innerText});
    element.dataset.tooltipClass = "crucible crucible-tooltip wide";
    const pointerover = new event.constructor(event.type, event);
    element.dispatchEvent(pointerover);
  }

  /* -------------------------------------------- */

  /**
   * On pointerenter, display a dynamic tooltip for the group language check.
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #displayLanguageCheck(event) {
    const element = event.target;
    const languageId = element.dataset.languageId;
    const language = crucible.CONFIG.languages[languageId];
    if ( !language || !crucible.party ) return;
    event.stopImmediatePropagation();
    element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation

    const check = async (group, actor) => ({success: actor.system.details.languages.has(languageId)});
    element.dataset.tooltipHtml = await crucible.party.system.renderGroupCheckTooltip(check,
      {title: element.innerText});
    element.dataset.tooltipClass = "crucible crucible-tooltip wide";
    const pointerover = new event.constructor(event.type, event);
    element.dispatchEvent(pointerover);
  }

  /* -------------------------------------------- */

  /**
   * Display a preview card of the item composed by a loot enrichment.
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #displayLootTooltip(event) {
    const element = event.target;
    event.stopImmediatePropagation();
    element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation
    const loot = JSON.parse(element.dataset.loot);
    let item;
    try {
      item = await Item.implementation.fromDropData({type: "Item", uuid: loot.baseUuid, loot});
    } catch{
      delete element.dataset.tooltipHtml;
      return;
    }
    element.dataset.tooltipHtml = await item.renderCard();
    element.dataset.tooltipClass = "crucible crucible-tooltip";
    const pointerover = new event.constructor(event.type, event);
    element.dispatchEvent(pointerover);
  }

  /* -------------------------------------------- */

  /**
   * On pointerenter, display a dynamic tooltip for the group passive check.
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #displayPassiveCheck(event) {
    if ( !crucible.party ) return;
    const element = event.target;
    event.stopImmediatePropagation();
    element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation

    // Define the passive check
    const skillId = element.dataset.skillId;
    const dc = Number(element.dataset.dc);
    const check = async (_group, actor) => {
      const roll = actor.getSkillCheck(skillId, {dc, passive: true});
      await roll.evaluate();
      return {roll};
    };

    // Construct the tooltip
    element.dataset.tooltipHtml = await crucible.party.system.renderGroupCheckTooltip(check,
      {title: element.innerText});
    element.dataset.tooltipClass = "crucible crucible-tooltip wide";
    const pointerover = new event.constructor(event.type, event);
    element.dispatchEvent(pointerover);
  }

  /* -------------------------------------------- */

  /**
   * Display tag tooltip descriptions.
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #displayTagTooltip(event) {
    const element = event.target;
    let ruleId = element.dataset.ruleId;
    let tooltip = element.dataset.crucibleTooltipText;
    let name = element.innerText;
    let cfg = foundry.utils.getProperty(SYSTEM.RULES, ruleId);

    // Alias a rule so that it resolves via some other
    if ( cfg?.alias ) {
      ruleId = cfg.alias;
      cfg = foundry.utils.getProperty(SYSTEM.RULES, ruleId);
    }

    // A rule id takes precedence over an action tag of the same name, such as the "thrown" weapon property
    if ( !cfg ) tooltip ||= SYSTEM.ACTION.TAGS[element.dataset.tag]?.tooltip;
    else {
      const page = cfg.page ? await fromUuid(cfg.page) : null;
      tooltip ||= _loc(cfg.tooltip) || cfg.description;
      // Maybe derive tooltip content from authoritative journal text
      if ( !tooltip && page ) {
        tooltip = CrucibleTooltipManager.#extractRuleContent(page, ruleId);
        if ( tooltip && cfg.tooltip ) foundry.utils.setProperty(game.i18n.translations, cfg.tooltip, tooltip);
      }
      name = _loc(cfg.name) ?? _loc(cfg.label) ?? page?.name;
    }
    if ( !tooltip ) return;
    event.stopImmediatePropagation();
    element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation

    const cls = CrucibleTooltipManager;
    element.dataset.tooltipHtml = await foundry.applications.handlebars.renderTemplate(cls.RULE_TOOLTIP_TEMPLATE,
      await cls.getRuleTooltipContext(name, tooltip));
    element.dataset.tooltipClass = "crucible crucible-tooltip";
    const pointerover = new event.constructor(event.type, event);
    element.dispatchEvent(pointerover);
  }

  /* -------------------------------------------- */

  /**
   * On pointerenter, display a tooltip for which group members have a specific talent.
   * @param {PointerEvent} event
   * @returns {Promise<void>}
   */
  static async #displayTalentCheck(event) {
    const element = event.target;
    if ( !crucible.party ) return;
    event.stopImmediatePropagation();
    element.dataset.tooltipHtml = ""; // Placeholder to prevent double-activation

    const parsed = foundry.utils.parseUuid(element.dataset.talentUuid);
    if ( !parsed?.id ) return;
    const check = async (group, actor) => ({success: actor.talentIds.has(parsed.id)});
    element.dataset.tooltipHtml = await crucible.party.system.renderGroupCheckTooltip(check,
      {title: element.innerText});
    element.dataset.tooltipClass = "crucible crucible-tooltip wide";
    const pointerover = new event.constructor(event.type, event);
    element.dispatchEvent(pointerover);
  }

  /* -------------------------------------------- */

  /**
   * Extract the source HTML which documents a rule from the journal page it lives on.
   * Content is returned un-enriched; enrichment happens once for every rule tooltip in
   * {@link CrucibleTooltipManager.getRuleTooltipContext}.
   * @param {JournalEntryPage} page   The page which documents this rule
   * @param {string} ruleId           Dot-path id of the rule, matched against a `data-rule` attribute
   * @returns {string}                Source HTML, or an empty string if an annotated page does not document this rule
   */
  static #extractRuleContent(page, ruleId) {
    const content = page.text?.content;
    if ( !content ) return "";
    const doc = new DOMParser().parseFromString(content, "text/html");
    const el = doc.querySelector(`[data-rule="${ruleId}"]`);
    if ( el ) return el.innerHTML.trim();
    // Pages without a matching selector contribute their whole content (e.g. conditions)
    return doc.querySelector("[data-rule]") ? "" : content;
  }
}

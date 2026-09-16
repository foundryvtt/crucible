import CrucibleTalentTreeNode from "./talent-tree-node.mjs";
import CrucibleTalentTreeTalent from "./talent-tree-talent.mjs";
import CrucibleTalentNode from "../../const/talent-node.mjs";
import CrucibleTalentItem from "../../models/item-talent.mjs";
import {getRuleTooltipContext, RULE_TOOLTIP_TEMPLATE} from "../../interaction.mjs";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;

/**
 * An Application instance that renders a HUD tooltip in the CrucibleTalentTree
 */
export default class CrucibleTalentHUD extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "crucible-talent-hud",
    classes: ["crucible", "crucible-tooltip"],
    tag: "aside",
    window: {
      frame: false
    }
  };

  /** @override */
  static PARTS = {
    node: {
      template: "systems/crucible/templates/hud/talent-tree-node.hbs"
    },
    talent: {
      template: CrucibleTalentItem.CARD_TEMPLATE_PATH,
      templates: ["systems/crucible/templates/sheets/item/talent-summary.hbs"]
    },
    ability: {
      template: RULE_TOOLTIP_TEMPLATE
    }
  };

  /**
   * The target of the HUD: a Node, a Talent, or an ability score text.
   * @type {CrucibleTalentTreeNode|CrucibleTalentTreeTalent|foundry.canvas.containers.PreciseText}
   */
  target;

  /**
   * Which of the PARTS the current target renders through.
   * @type {"node"|"talent"|"ability"}
   */
  get targetType() {
    if ( this.target instanceof CrucibleTalentTreeNode ) return "node";
    if ( this.target instanceof CrucibleTalentTreeTalent ) return "talent";
    return "ability";
  }

  /* -------------------------------------------- */

  /** @override */
  _configureRenderParts(options) {
    const partId = this.targetType;
    return {[partId]: foundry.utils.deepClone(this.constructor.PARTS[partId])};
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(_options) {
    switch ( this.targetType ) {
      case "node": return this.#getNodeContext();
      case "talent": return this.#getTalentContext();
      case "ability": return this.#getAbilityContext();
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context data for a Node.
   * @returns {Promise<object>}
   */
  async #getNodeContext() {
    const actor = game.system.tree.actor;
    const node = this.target.node;
    const state = game.system.tree.state.get(node);
    const tagGroups = [];

    // Node tags
    const nodeTags = [{label: _loc("TALENT.Tier", {tier: node.tier})}, {label: node.id}];
    if ( state.banned ) {
      nodeTags.push({label: _loc("TALENT.SignatureLimit"), class: "unmet"});
      const max = CrucibleTalentNode.getSignatureAllowance(actor.system.advancement.level);
      if ( max < SYSTEM.TALENT.SIGNATURE_MAX ) {
        nodeTags.push({label: _loc("TALENT.SignatureNext", {level: (max + 1) * SYSTEM.TALENT.SIGNATURE_LEVEL_INTERVAL})});
      }
    }
    else if ( !state.unlocked ) nodeTags.push({label: _loc("TALENT.Locked"), class: "unmet"});
    if ( !node.talents.size ) nodeTags.push({label: _loc("TALENT.Empty"), class: "unmet"});
    const nodeType = _loc(`TALENT.NODES.${node.type.capitalize()}`);
    tagGroups.push({
      id: node.type,
      label: _loc("TALENT.NodeSpecific", {nodeType}),
      tags: nodeTags
    });

    // Prerequisite tags
    const requirements = CrucibleTalentNode.preparePrerequisites(node.requirements);
    const reqTags = CrucibleTalentItem.testPrerequisites(actor, requirements);
    for ( const tag of Object.values(reqTags) ) {
      tag.label = tag.tag;
      tag.cssClass = tag.met ? "met" : "unmet";
    }
    tagGroups.push({
      id: "prerequisites",
      label: _loc("TALENT.Prerequisites"),
      tags: reqTags
    });
    return {id: node.id, tagGroups};
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context data for an ability score.
   * @returns {Promise<object>}
   */
  async #getAbilityContext() {
    const cfg = SYSTEM.RULES.ability[this.target.abilityId];
    return getRuleTooltipContext(cfg.label, cfg.tooltip);
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context data for a Talent.
   * @returns {Promise<object>}
   */
  async #getTalentContext() {
    const actor = game.system.tree.actor;
    const talent = this.target.talent;

    // Talent Tags
    const reqs = CrucibleTalentItem.testPrerequisites(actor, talent.system.prerequisites);

    // Banned Signature
    if ( talent.system.isSignature && !actor.talentIds.has(talent.id) ) {
      for ( const node of talent.system.nodes ) {
        const state = game.system.tree.state.get(node);
        if ( state.banned ) {
          reqs.signature = {tag: _loc("TALENT.SignatureLimit"), met: false};
          break;
        }
      }
    }

    // Return context
    const training = talent.system.training;
    return {
      source: talent.toObject(),
      uuid: talent.uuid,
      descriptionHTML: await CONFIG.ux.TextEditor.enrichHTML(talent.system.description, {relativeTo: talent}),
      actions: await talent.prepareActionsContext(),
      prerequisites: reqs,
      training: training
        ? _loc("TALENT.TrainingGrant", {training: SYSTEM.PROFICIENCIES[training].label})
        : null
    };
  }

  /* -------------------------------------------- */

  /** @override */
  _insertElement(element) {
    const existing = document.getElementById(element.id);
    if ( existing ) existing.replaceWith(element);
    const hud = document.getElementById("hud");
    hud.appendChild(element);
  }

  /* -------------------------------------------- */

  /** @override */
  _replaceHTML(result, content, options) {
    const existing = document.getElementById(content.id);
    if ( existing ) {
      content.replaceChildren(); // Always clear
      return super._replaceHTML(result, content, options);
    }
    const hud = document.getElementById("hud");
    hud.appendChild(content);
  }

  /* -------------------------------------------- */

  /** @override */
  _updatePosition({left, top}={}) {
    return {width: "auto", height: "auto", left, top, scale: 1.0};
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.classList.remove("hidden");
  }

  /* -------------------------------------------- */

  /**
   * Activate this HUD element, binding it to a target.
   * @param {CrucibleTalentTreeNode|CrucibleTalentTreeTalent|foundry.canvas.containers.PreciseText} target
   * @returns {Promise<*>}
   */
  async activate(target) {
    this.target = target;
    const position = {
      left: target.x + (target.width / 2) + 10,
      top: target.y - (target.height / 2)
    };
    if ( target instanceof CrucibleTalentTreeTalent ) {
      position.left += target.node.x;
      position.top += target.node.y;
    }
    return this.render({force: true, position});
  }

  /* -------------------------------------------- */

  /**
   * Temporarily hide the HUD element.
   */
  clear() {
    if ( !this.rendered ) return;
    this.element.classList.add("hidden");
  }
}

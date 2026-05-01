import StandardCheckDialog from "./standard-check-dialog.mjs";

/**
 * Prompt the user to activate an action which may involve the rolling of a standard dice pool.
 * @extends {StandardCheckDialog}
 */
export default class ActionUseDialog extends StandardCheckDialog {
  constructor({action, actor, targets, ...options}) {
    super(options);
    this.action = action;
    this.actor = actor;
    this.targets = targets;
    this.#weaponChoice = action.usage.weapon?.id || "";
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["action-roll"],
    position: {
      width: 400
    },
    window: {
      minimizable: true
    },
    actions: {
      placeRegion: ActionUseDialog.#onPlaceRegion,
      planMovement: ActionUseDialog.#onPlanMovement
    },
    form: {
      closeOnSubmit: false
    }
  };

  /** @override */
  static TEMPLATE = "systems/crucible/templates/dice/action-use-dialog.hbs";

  /**
   * Targets acquired from the most recently placed region for this Action.
   * @type {ActionUseTarget[]|null}
   */
  #regionTargets = null;

  /**
   * A lazy action clone used for per-frame target preview during movement planning.
   * Only set when the action has target.type === "movement". Cleared after planning ends.
   * @type {CrucibleAction|null}
   */
  #previewMovementAction = null;

  /**
   * The canvas preview object created after region placement, kept alive for the dialog's lifetime.
   * @type {RegionObject|null}
   */
  #regionPreview = null;

  /**
   * Tracks whether the dialog was submitted successfully via _onRoll.
   * Used by #clearMovementPlan to avoid cancelling planned movement on a successful submission,
   * since _onClose fires for both cancellation and submission.
   * @type {boolean}
   */
  #submitted = false;

  /**
   * The Action being performed
   * @type {CrucibleAction}
   */
  action;

  /**
   * The Actor performing the action.
   * @type {CrucibleActor}
   */
  actor;

  /**
   * The Tokens which are targeted by the action.
   * @type {CrucibleToken[]}
   */
  targets;

  /**
   * The current weapon choice made by the user
   * @type {string}
   */
  #weaponChoice;

  /* -------------------------------------------- */

  /** @override */
  get title() {
    return `[${this.actor.name}] ${this.action.name}`;
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const tags = this._getTags();
    const targets = this.#prepareTargets();
    const requiresRegion = this.action.requiresRegion;
    const requiresMovement = this.action.requiresMovement;
    const involvesRegion = requiresRegion || this.action.region;
    const involvesMovement = requiresMovement || this.action.movement;
    const submitDisabled = targets.some(t => t.error) || ((this.action.target.type === "single") && !targets.length);
    const submitTooltip = submitDisabled ? `<p>${_loc("ACTION.WARNINGS.InvalidTargetsGeneric")}</p>` : "";
    return foundry.utils.mergeObject(context, {
      action: this.action,
      actor: this.actor,
      tags,
      hasActionTags: !tags.action.empty,
      hasContextTags: !tags.context.empty,
      hasTargetTags: !["self", "none"].includes(this.action.target.type) || involvesRegion || involvesMovement,
      hasDice: this.action.usage.hasDice ?? false,
      involvesRegion,
      involvesMovement,
      requiresRegion,
      requiresMovement,
      tagRegion: this.action.region && !targets.length,
      tagMovement: this.action.movement,
      targets,
      submitDisabled,
      submitLabel: _loc("ACTION.UseAction"),
      submitTooltip,
      weaponChoice: this.#prepareWeaponChoice()
    });
  }

  /* -------------------------------------------- */

  /**
   * Prepare the field and value for choosing which weapon to use if the action supports weapon choice.
   * @returns {{field: StringField, value: string}|null}
   */
  #prepareWeaponChoice() {
    if ( !this.action.allowWeaponChoice ) return null;
    const baseActionCost = this.action.cost.action - (this.action.usage.weapon?.system.actionCost ?? 0);
    const maxCost = this.actor.resources.action.value - baseActionCost;
    const choices = this.action.getValidWeaponChoices({strict: true, maxCost});
    if ( choices.length <= 1 ) return null;
    const weapon = new foundry.data.fields.StringField({blank: true, required: true, choices,
      label: _loc("ACTION.ChooseWeaponLabel"), hint: _loc("ACTION.ChooseWeaponHint")});
    weapon.name = "weapon";
    return {field: weapon, value: this.#weaponChoice};
  }

  /* -------------------------------------------- */

  /**
   * Prepare the list of targets for rendering in the action use dialog.
   * @returns {ActionUseTarget[]}
   */
  #prepareTargets() {
    if ( this.action.usage.summons?.length ) {
      return this.action.usage.summons.map(({actorUuid}) => ({
        uuid: actorUuid,
        name: fromUuidSync(actorUuid)?.name ?? "Unknown" // Shouldn't be possible, but just in case
      }));
    }
    const targetMap = this.#regionTargets ?? this.action.acquireTargets({strict: false});
    const targets = Array.from(targetMap.values());
    for ( const t of targets ) {
      t.cssClass = t.error ? "unmet" : "";
      t.tooltip = t.error ?? null;
      t.hidden = t.token?.isVisible === false;
    }
    return targets;
  }

  /* -------------------------------------------- */

  /**
   * Get the tags that apply to this dialog.
   * @returns {ActionTags}
   * @protected
   */
  _getTags() {
    return this.action.getTags();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if ( !context.requiresRegion ) return;
    const regionConfig = SYSTEM.ACTION.TARGET_TYPES[this.action.target.type]?.region;
    if ( !regionConfig ) return;
    const autoPlace = (regionConfig.anchor === "self") && (["emanation", "circle"].includes(regionConfig.shape));
    if ( autoPlace ) await ActionUseDialog.#onPlaceRegion.call(this);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);
    if ( event.target.name === "weapon" ) {
      const weapons = this.action.actor.equipment.weapons;
      const c = this.#weaponChoice = event.target.value;
      let weapon;
      if ( c === "mainhandUnarmed" ) weapon = weapons.mainhand;
      else if ( c === "offhandUnarmed" ) weapon = weapons.offhand;
      else weapon = this.action.actor.items.get(c);
      this.action.usage.weapon = weapon;
      this.action.reset();
      this.roll = crucible.api.dice.StandardCheck.fromAction(this.action);
      this.render();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onSubmit(target, event) {
    if ( this.action.requiresRegion || this.action.requiresMovement ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if ( this.action.requiresRegion ) {
        await ActionUseDialog.#onPlaceRegion.call(this);
        if ( !this.#regionPreview ) return;
      }
      if ( this.action.requiresMovement ) {
        await ActionUseDialog.#onPlanMovement.call(this);
        if ( !this.action.movement ) return;
      }

      // If targets are invalid following this selection, don't proceed with submission
      try {
        this.action.acquireTargets({strict: true});
      } catch(err) {
        return;
      }
    }
    await super._onSubmit(target, event);
    this.close({submitted: true});
  }

  /* -------------------------------------------- */

  /**
   * Resolve dialog submission to enact a Roll.
   * @param {Event} _event
   * @param {HTMLButtonElement} _button
   * @param {Dialog} _dialog
   * @returns {StandardCheck}
   * @protected
   */
  _onRoll(_event, _button, _dialog) {
    this.#submitted = true;
    this.action.usage.messageMode = this.messageMode;
    if ( "special" in this.roll.data.boons ) this.action.usage.boons.special = this.roll.data.boons.special;
    if ( "special" in this.roll.data.banes ) this.action.usage.banes.special = this.roll.data.banes.special;
    return this.action;
  }

  /* -------------------------------------------- */
  /*  Target Management                           */
  /* -------------------------------------------- */

  /**
   * Respond when the set of User Targets changes by re-rendering currently visible action use apps.
   */
  static debounceChangeTarget = foundry.utils.debounce(() => {
    for ( const app of foundry.applications.instances.values() ) {
      if ( app instanceof ActionUseDialog ) app.render();
    }
  }, 20);

  /* -------------------------------------------- */
  /*  Region Management                           */
  /* -------------------------------------------- */

  /**
   * Handle left-click events to begin the region targeting workflow.
   * @this {ActionUseDialog}
   * @param {Event} event
   * @returns {Promise<void>}
   */
  static async #onPlaceRegion(event) {
    this.#clearRegionPreview();
    const {range, token, target} = this.action;
    const targetConfig = SYSTEM.ACTION.TARGET_TYPES[target.type];
    if ( !targetConfig.region ) return;
    const regionConfig = targetConfig?.region;

    // Resolve the size of the first summon if applicable
    if ( (target.type === "summon") && this.action.usage.summons.length ) {
      const summon1 = await fromUuid(this.action.usage.summons[0].actorUuid);
      if ( summon1 ) target.size = summon1.size;
    }

    // Build initial region document data
    const origin = token?.getCenterPoint(token._source) ?? canvas.dimensions.rect.center;
    const regionData = this.#getRegionData(origin, token, range, target, targetConfig);
    const autoPlace = (regionConfig.anchor === "self") && (["emanation", "circle"].includes(regionConfig.shape));

    // Clear existing targets before placement begins
    canvas.tokens.setTargets([]);

    // Create a lazy clone of the action for use during preview target acquisition
    const previewAction = this.action.clone({}, {lazy: true});

    // Build what will be the onChange callback - fires after each position update with fresh constraints
    const setNewTargets = ({action=previewAction, document}) => {
      Object.defineProperty(action, "region", {value: document, configurable: true});
      this.#regionTargets = action.acquireTargets({strict: false});
      const newTargets = this.#regionTargets.size ? Array.from(this.#regionTargets.values()).map(t => t.token.id) : [];
      canvas.tokens.setTargets(newTargets);
    };
    let region;
    if ( autoPlace ) region = new CONFIG.Region.documentClass(regionData, {parent: canvas.scene});
    else {
      // Minimize open windows
      const minimizedWindows = [];
      for ( const app of foundry.applications.instances.values() ) {
        if ( !app.minimized && !app.window.windowId ) minimizedWindows.push(app);
      }
      await Promise.allSettled(minimizedWindows.map(app => app.minimize()));

      // Build the onMove callback
      const onMove = ({shape, position, document, snap}) => {
        switch (regionConfig.anchor) {
          case "self": // Lock position and rotate based on mouse position
            if ( regionConfig.directionDelta ) {
              const rawAngle = Math.toDegrees(Math.atan2(position.y - origin.y, position.x - origin.x));
              const snappedAngle = rawAngle.toNearest(regionConfig.directionDelta);
              shape.updateSource({rotation: snappedAngle});
            }
            return false; // Prevent core handling
          case "vertex":
            const maxDistance = range.maximum ?? 0;
            if ( maxDistance === 0 ) Object.assign(position, origin);
            else {
              origin.elevation ??= 0;
              const elevation = Math.clamp(origin.elevation, document.elevation.bottom, document.elevation.top);
              const d = canvas.grid.measurePath([origin, {elevation, ...position}]).distance;
              if ( d <= maxDistance ) return;
              const rawAngle = Math.toDegrees(Math.atan2(position.y - origin.y, position.x - origin.x));
              Object.assign(position, canvas.grid.getTranslatedPoint(origin, rawAngle, maxDistance));
            }
            break; // Allow core handling
        }
      };

      // Place the region and record its created data
      region = await canvas.regions.placeRegion(regionData, {create: false, onMove, onChange: setNewTargets});
      await Promise.allSettled(minimizedWindows.map(app => app.maximize()));
    }

    // Handle user workflow cancellation
    if ( !region ) {
      this.#regionTargets = null;
      canvas.tokens.setTargets([]);
      return;
    }

    // Acquire targets for the final region
    region.updateShapeConstraints();
    setNewTargets({action: this.action, document: region});

    // Keep the placed region visible as a canvas preview for the remainder of the dialog
    this.#regionPreview = new foundry.canvas.placeables.Region(region);
    this.#regionPreview._previewType = "creation";
    canvas.regions.addChild(this.#regionPreview);
    // noinspection ES6MissingAwait
    this.#regionPreview.draw();

    // Re-render the dialog
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Build the initial RegionDocument data for a placement workflow.
   * @param {Point} origin                     The origin point in canvas pixels
   * @param {CrucibleToken} token              The token performing the action
   * @param {ActionRange} range                The action's range configuration
   * @param {ActionTarget} target              The action's target configuration
   * @param {ActionTargetType} targetConfig    The region config for this target type
   * @returns {Partial<RegionData>}            RegionDocument data with a single shape
   */
  #getRegionData(origin, token, range, target, targetConfig) {
    const regionConfig = targetConfig.region;
    const d = canvas.dimensions.distancePixels;

    // Determine relevant ranges
    const maxRange = range.maximum ?? 0;
    const baseRange = target.size ? target.size : maxRange;
    const addRange = regionConfig.addSize ? (this.actor.size / 2) : 0;

    // Get token data
    const levels = token?.level ? [token.level] : [];
    const tokenElevation = token?._source.elevation ?? 0;
    const tokenDepth = token?._source.depth ?? 0;
    const elevation = this.action.usage.region.elevation ?? {bottom: tokenElevation, top: tokenElevation + tokenDepth};
    const attachment = {};

    // Common configurations based on the shape
    let shape;
    switch ( regionConfig.shape ) {
      case "circle":
        shape = {
          type: "circle",
          x: origin.x,
          y: origin.y,
          radius: (baseRange + addRange) * d
        };
        elevation.bottom -= baseRange;
        elevation.top += baseRange;
        break;
      case "cone":
        shape = {
          type: "cone",
          x: origin.x,
          y: origin.y,
          radius: (baseRange + addRange) * d,
          angle: regionConfig.angle ?? 60,
          rotation: 0,
          curvature: (regionConfig.angle ?? 60) <= 90 ? "flat" : "round"
        };
        break;
      case "emanation":
        if ( !token ) {
          const warn = _loc("ACTION.WARNINGS.AuraNoToken");
          ui.notifications.warn(warn);
          throw new Error(warn);
        }
        shape = {
          type: "emanation",
          x: origin.x,
          y: origin.y,
          radius: (baseRange + addRange) * d,
          base: {type: "token", x: token.x, y: token.y, width: token.width, height: token.height, shape: token.shape}
        };
        attachment.token = token.id;
        break;
      case "line":
        shape = {
          type: "line",
          x: origin.x,
          y: origin.y,
          length: (maxRange + addRange) * d,
          width: (regionConfig.width ?? 1) * d,
          rotation: 0
        };
        break;
      case "rectangle":
        const size = regionConfig.width ?? 1;
        shape = {
          type: "rectangle",
          x: origin.x,
          y: origin.y,
          width: size * d,
          height: maxRange * d,
          anchorX: 0.5,
          anchorY: 0.5,
          rotation: 0
        };
        elevation.top = elevation.bottom + size;
        break;
      default:
        throw new Error(`Unsupported region shape "${regionConfig.shape}" for action ${this.action.id}`);
    }

    // Custom configurations based on the target type
    switch ( target.type ) {
      case "summon":
        const size = (target.size ?? regionConfig.size ?? 1);
        shape.height = shape.width = size * d;
        shape.anchorX = shape.anchorY = 0;
        elevation.top = elevation.bottom + size;
        break;
      case "wall":
        elevation.top = elevation.bottom = null; // Span the full level
        break;
    }

    // Return the RegionData
    return {
      name: this.action.name,
      color: this.action.usage.region.color ?? game.user.color,
      displayMeasurements: true,
      restriction: {enabled: this.action.usage.region.wallRestriction ?? true, type: "move"},
      elevation,
      levels,
      shapes: [shape],
      attachment
    };
  }

  /* -------------------------------------------- */

  /**
   * Expose an internal method that subclasses can use to clear a target region.
   * @internal
   */
  _clearTargetRegion() {
    this.#clearRegionPreview();
    if ( this.#regionTargets ) canvas.tokens.setTargets([]);
    this.#regionTargets = null;
    Object.defineProperty(this.action, "region", {value: null, configurable: true});
  }

  /* -------------------------------------------- */

  /**
   * Destroy the current canvas region preview, if one exists.
   */
  #clearRegionPreview() {
    this.#regionPreview?.destroy({children: true});
    this.#regionPreview = null;
  }

  /* -------------------------------------------- */
  /*  Movement Planning                           */
  /* -------------------------------------------- */

  /**
   * Get the active movement planning dialog for the given token, if any.
   * Returns non-null only while the movement drag is in flight (not after the plan is confirmed).
   * @param {CrucibleToken|string} token    The token document or its ID
   * @returns {ActionUseDialog|null}
   */
  static getActiveMovementPlan(token) {
    const id = typeof token === "string" ? token : token.id;
    if ( canvas.tokens._movementPlanningContext?.object?.document?.id !== id ) return null;
    for ( const app of foundry.applications.instances.values() ) {
      if ( (app instanceof ActionUseDialog) && (app.action.token?.id === id) ) return app;
    }
    return null;
  }

  /* -------------------------------------------- */

  /**
   * Handle left-click events to begin the movement planning workflow.
   * @this {ActionUseDialog}
   * @param {PointerEvent} _event
   * @returns {Promise<void>}
   */
  static async #onPlanMovement(_event) {
    const {token, target, usage} = this.action;
    const movementUsage = usage.movement;

    // Minimize open windows
    const minimizedWindows = [];
    for ( const app of foundry.applications.instances.values() ) {
      if ( !app.minimized && !app.window.windowId ) minimizedWindows.push(app);
    }
    await Promise.allSettled(minimizedWindows.map(app => app.minimize()));

    // Initialize real-time target preview for movement-type actions
    if ( target.type === "movement" ) {
      canvas.tokens.setTargets([]);
      this.#previewMovementAction = this.action.clone({}, {lazy: true});
    }

    // Await the movement plan
    const plan = await token.object.planMovement({
      allowedActions: movementUsage.action ? [movementUsage.action] : null,
      minCost: this.action.range?.minimum ?? undefined,
      maxCost: this.action.range?.maximum ?? undefined,
      direct: movementUsage.direct ?? true,
      constrainOptions: movementUsage.constrainOptions ?? {}
    });
    this.#previewMovementAction = null;

    // Restore minimized windows
    await Promise.allSettled(minimizedWindows.map(app => app.maximize()));

    // Handle user cancellation
    if ( !plan ) {
      canvas.tokens.setTargets([]);
      await this.render();
      return;
    }

    // Measure the cost of the planned path, then store the movement on the action
    const {cost} = token.object.measureMovementPath([plan.origin, ...plan.waypoints]);
    const movement = {id: plan.id, origin: plan.origin, waypoints: plan.waypoints, cost, plan};
    Object.defineProperty(this.action, "movement", {value: movement, configurable: true});
    this.action.prepare();
    this.roll = crucible.api.dice.StandardCheck.fromAction(this.action);

    // Acquire targets from the planned movement path and highlight on canvas
    this.action.acquireTargets({strict: false});
    const targetTokenIds = Array.from(this.action.targets.values()).map(t => t.token?.id).filter(Boolean);
    canvas.tokens.setTargets(targetTokenIds);
    await this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle per-frame movement preview updates during the movement planning workflow.
   * Called by CrucibleTokenObject#_refreshRuler when this dialog has an active movement plan.
   * Simulate target acquisition based on the planned movement.
   * @param {object|undefined} plannedMovement    Current _plannedMovement for the user
   * @internal
   */
  _onPreviewMovement(plannedMovement) {
    if ( !this.#previewMovementAction ) return;
    if ( !plannedMovement?.foundPath?.length ) {
      canvas.tokens.setTargets([]);
      return;
    }
    const foundPath = plannedMovement.foundPath;
    const previewMovement = {origin: foundPath[0], waypoints: foundPath.slice(1)};
    Object.defineProperty(this.#previewMovementAction, "movement", {value: previewMovement, configurable: true});
    this.#previewMovementAction.acquireTargets({strict: false});
    const targetTokenIds = Array.from(this.#previewMovementAction.targets.values()).map(t => t.token?.id).filter(Boolean);
    canvas.tokens.setTargets(targetTokenIds);
  }

  /* -------------------------------------------- */

  /**
   * Clear any in-progress movement plan, cancelling a planned token movement if one exists.
   */
  #clearMovementPlan() {
    this.#previewMovementAction = null;
    if ( this.#submitted ) return;
    const token = this.action.token;

    // Cancel in-flight planning if this dialog's token is the active planner
    if ( canvas.tokens._movementPlanningContext?.object?.document === token ) {
      canvas.tokens._cancelMovementPlanning();
    }

    // Cancel any already-confirmed movement stored on this action
    if ( this.action.movement ) {
      token?.stopMovement();
      Object.defineProperty(this.action, "movement", {value: null, configurable: true});
    }
    canvas.tokens.setTargets([]);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClose(options) {
    this.#clearMovementPlan();
    this.#clearRegionPreview();
    super._onClose(options);
  }
}

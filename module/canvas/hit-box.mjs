/**
 * A canvas layer which renders Crucible token hitboxes using the CrucibleHitBoxShader batch plugin.
 * Displayed above the Grid layer and below the Tokens layer (zIndex 90).
 */
export default class CrucibleHitboxLayer extends foundry.canvas.layers.CanvasLayer {
  constructor() {
    super();
    this.eventMode = "none";
  }

  /** @override */
  static get layerOptions() {
    return {name: "crucibleHitboxes", zIndex: 90};
  }

  /* ---------------------------------------- */

  /**
   * Collect the tokens whose hitboxes should be drawn.
   * @returns {Token[]|null} Visible tokens if at least one is controlled, otherwise null
   */
  _collect() {
    const anyControlled = canvas.tokens.controlled.length > 0;
    if ( !anyControlled ) return null;
    return canvas.tokens.placeables.filter(t => t?.visible);
  }

  /* ---------------------------------------- */

  /** @override */
  _draw() {}

  /* ---------------------------------------- */

  /** @override */
  _tearDown() {}

  /* ---------------------------------------- */

  /** @override */
  render(renderer) {
    if ( !this.worldVisible || this.worldAlpha <= 0 ) return;

    // Get the crucible batched shader plugin
    const plugin = renderer?.plugins?.batchCrucibleHitBox;
    if ( !plugin ) return;

    // Collecting tokens where the hitbox should be displayed
    const list = this._collect();
    if ( !list ) {
      super.render(renderer);
      return;
    }
    // Start the plugin manually
    plugin.start();

    // Rendering each hit box
    for ( const t of list ) {
      const elem = t.mesh;
      if ( !elem ) continue;

      // Update the batch data and pushing additional informations
      elem._updateBatchData();
      elem._batchData.blendMode = PIXI.BLEND_MODES.NORMAL;
      elem._batchData.worldAlpha = 1;
      elem._batchData.worldTransform = t.mesh.worldTransform;
      plugin.render(elem._batchData);
    }

    // Flush and clean
    plugin.flush();
    plugin.stop();

    super.render(renderer);
  }
}

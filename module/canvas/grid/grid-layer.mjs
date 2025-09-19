import CrucibleTokenObject from "../token.mjs";
import CrucibleSelectiveGridShader from "./grid-shader.mjs";

export default class CrucibleGridLayer extends foundry.canvas.layers.GridLayer {

  /** @override */
  initializeMesh({style, ...options}={}) {
    if ( !canvas.scene.useMicrogrid ) return super.initializeMesh({style, ...options});
    const {shaderClass, shaderOptions} = CONFIG.Canvas.gridStyles[style] ?? {};
    this.mesh.initialize(options);
    const defaultShader = shaderClass === foundry.canvas.rendering.shaders.GridShader;
    this.mesh.setShaderClass(defaultShader ? CrucibleSelectiveGridShader : shaderClass);
    this.mesh.shader.configure(shaderOptions ?? {});
  }

  /* -------------------------------------------- */

  /** @override */
  render(renderer) {
    super.render(renderer);

    // Microgrid activated for this scene?
    if ( !canvas.scene.useMicrogrid || !this.worldVisible || (this.worldAlpha <= 0) ) return;

    // Get the crucible batched shader plugin
    const plugin = renderer?.plugins?.batchCrucibleHitBox;
    if ( !plugin ) return;

    const anyControlled = canvas.tokens.controlled.length > 0;
    const tokens = CrucibleTokenObject.visibleTokens;

    // Start the plugin manually
    plugin.start();

    // Rendering each hit box
    for ( const t of tokens ) {
      const elem = t.mesh;
      if ( !anyControlled && t.hasNoActiveHitBoxState() ) continue;
      if ( !elem || elem.destroyed ) continue;

      // Update the batch data if not present
      if ( !elem._hitBoxBatchData ) {
        elem._hitBoxBatchData = {
          crucibleToken: t,
          blendMode: PIXI.BLEND_MODES.NORMAL,
          worldAlpha: 1,
          _texture: PIXI.Texture.WHITE,
          vertexData: elem._batchData.vertexData,
          indices: elem._batchData.indices,
          uvs: elem._batchData.uvs
        };
      }
      plugin.render(elem._hitBoxBatchData);
    }

    // Flush and clean
    plugin.flush();
    plugin.stop();
  }
}

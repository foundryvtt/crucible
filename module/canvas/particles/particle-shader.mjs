/**
 * Batch shader for Crucible particles with exposure.
 */
export default class CrucibleParticleShader extends foundry.canvas.rendering.shaders.BaseSamplerShader {

  /** @override */
  static classPluginName = "batchCrucibleParticle";

  /** @override */
  static batchGeometry = [
    {id: "aVertexPosition", size: 2, normalized: false, type: PIXI.TYPES.FLOAT},
    {id: "aTextureCoord", size: 2, normalized: false, type: PIXI.TYPES.FLOAT},
    {id: "aColor", size: 4, normalized: true, type: PIXI.TYPES.UNSIGNED_BYTE},
    {id: "aTextureId", size: 1, normalized: false, type: PIXI.TYPES.FLOAT},
    {id: "aExposure", size: 1, normalized: false, type: PIXI.TYPES.FLOAT}
  ];

  /** @override */
  static batchVertexSize = 7;

  /* -------------------------------------------- */

  /** @override */
  static _packInterleavedGeometry(element, attributeBuffer, indexBuffer, aIndex, iIndex) {
    const {float32View, uint32View} = attributeBuffer;

    // Write indices into buffer
    const packedVertices = aIndex / this.vertexSize;
    const indices = element.indices;
    for ( let i = 0; i < indices.length; i++ ) {
      indexBuffer[iIndex++] = packedVertices + indices[i];
    }

    // Prepare attributes
    const vertexData = element.vertexData;
    const uvs = element.uvs;
    const baseTexture = element._texture.baseTexture;
    const alpha = Math.min(element.worldAlpha, 1.0);
    const argb = PIXI.Color.shared.setValue(element._tintRGB).toPremultiplied(alpha, baseTexture.alphaMode > 0);
    const textureId = baseTexture._batchLocation;
    const exposure = Math.clamp(element.object?.exposure ?? 0, -1, 1);

    // Write attributes into buffer
    const vertexSize = this.vertexSize;
    for ( let i = 0, j = 0; i < vertexData.length; i += 2, j += vertexSize ) {
      let k = aIndex + j;
      float32View[k++] = vertexData[i];
      float32View[k++] = vertexData[i + 1];
      float32View[k++] = uvs[i];
      float32View[k++] = uvs[i + 1];
      uint32View[k++] = argb;
      float32View[k++] = textureId;
      float32View[k++] = exposure;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  static get batchVertexShader() {
    return `
    #version 300 es
    precision ${PIXI.Program.defaultVertexPrecision} float;
    
    in vec2 aVertexPosition;
    in vec2 aTextureCoord;
    in vec4 aColor;
    in float aTextureId;
    in float aExposure;
    
    uniform mat3 projectionMatrix;
    uniform mat3 translationMatrix;
    uniform vec4 tint;
    
    out vec2 vTextureCoord;
    flat out vec4 vColor;
    flat out float vTextureId;
    flat out float vExposure;
    
    void main() {
      gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
      vTextureCoord = aTextureCoord;
      vColor = aColor * tint;
      vTextureId = aTextureId;
      vExposure = aExposure;
    }
    `;
  }

  /* -------------------------------------------- */

  /** @override */
  static get batchFragmentShader() {
    return `
    #version 300 es
    
    ${this.GLSL1_COMPATIBILITY_FRAGMENT}
    
    precision ${PIXI.Program.defaultFragmentPrecision} float;
    
    in vec2 vTextureCoord;
    flat in vec4 vColor;
    flat in float vTextureId;
    flat in float vExposure;
    
    uniform sampler2D uSamplers[%count%];

    out vec4 fragColor;

    // Exposure response. vExposure in [-1, 1]: the [-0.5, 0.5] band gives moderate shifts while [-1, 1] is extreme.
    const float EXPOSURE_HOT_GAIN = 2.0;
    const float EXPOSURE_WHITE = 1.5;

    void main() {
      vec4 color;
      %forloop%
      color *= vColor;
      float e = vExposure;
      float gain = (e > 0.0) ? (1.0 + (e * EXPOSURE_HOT_GAIN)) : (1.0 + e);
      color.rgb *= max(gain, 0.0);
      color.rgb += vec3(color.a) * (max(e, 0.0) * EXPOSURE_WHITE);
      fragColor = color;
    }
    `;
  }
}

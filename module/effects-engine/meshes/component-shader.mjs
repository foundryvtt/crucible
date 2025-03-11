/**
 * @import {ComponentMeshBatchData}  from "./component-mesh.mjs"
 */

/**
 *
 */
export class ComponentShader extends BaseSamplerShader {
  /* -------------------------------------------- */
  /*  Batched version Rendering                   */
  /* -------------------------------------------- */

  /** @override */
  static classPluginName = "batchComponent"
  classPluginName = "batchComponent"

  /* ---------------------------------------- */

  /** @override */
  static batchGeometry = [
    {
      id: "aVertexPosition",
      size: 2,
      normalized: false,
      type: PIXI.TYPES.FLOAT,
    },
    { id: "aTextureCoord", size: 2, normalized: false, type: PIXI.TYPES.FLOAT },
    { id: "aColor", size: 4, normalized: false, type: PIXI.TYPES.FLOAT },
    {
      id: "aTextureId",
      size: 1,
      normalized: false,
      type: PIXI.TYPES.UNSIGNED_SHORT,
    },
    {
      id: "aBlendMode",
      size: 1,
      normalized: false,
      type: PIXI.TYPES.UNSIGNED_SHORT,
    },
  ]

  /* -------------------------------------------- */

  /** @override */
  static batchVertexSize = 9

  /* -------------------------------------------- */

  /** @override */
  static defaultUniforms = {
    screenDimensions: [1, 1],
    sampler: null,
    tintAlpha: [1, 1, 1, 1],
  }

  /* -------------------------------------------- */

  /** @override */
  static batchDefaultUniforms() {
    return {
      screenDimensions: [1, 1],
    }
  }

  /* -------------------------------------------- */

  /**
   * @override
   * @param {BatchRenderer} batchRenderer
   */
  static _preRenderBatch(batchRenderer) {
    const uniforms = batchRenderer._shader.uniforms
    uniforms.screenDimensions = canvas.screenDimensions
  }

  /* ---------------------------------------- */

  /**
   * @override
   *
   * @param {ComponentMeshBatchData} element
   * @param {PIXI.ViewableBuffer} attributeBuffer
   * @param {Uint16Array} indexBuffer
   * @param {number} aIndex
   * @param {number} iIndex
   */
  static _packInterleavedGeometry(
    element,
    attributeBuffer,
    indexBuffer,
    aIndex,
    iIndex,
  ) {
    const { float32View, uint8View, uint16View, uint32View } = attributeBuffer

    // Write indices into buffer
    const packedVertices = aIndex / this.vertexSize
    const indices = element.indices
    for (let i = 0; i < indices.length; i++) {
      indexBuffer[iIndex++] = packedVertices + indices[i]
    }

    // Prepare attributes
    const vertexData = element.vertexData
    const uvs = element.uvs
    const baseTexture = element._texture.baseTexture
    const color = element._tintRGB
    const textureId = baseTexture._batchLocation
    const blendMode = element.mode
    // Write attributes into buffer
    const vertexSize = this.vertexSize
    for (let i = 0, j = 0; i < vertexData.length; i += 2, j += vertexSize) {
      let k = aIndex + j
      float32View[k++] = vertexData[i]
      float32View[k++] = vertexData[i + 1]
      float32View[k++] = uvs[i]
      float32View[k++] = uvs[i + 1]
      float32View[k++] = color[0]
      float32View[k++] = color[1]
      float32View[k++] = color[2]
      float32View[k++] = color[3]
      k <<= 1
      uint16View[k++] = textureId
      k <<= 1
      uint8View[k++] = blendMode
    }
  }

  /* -------------------------------------------- */

  /** @override */
  static get batchVertexShader() {
    return /* glsl */ `#version 300 es
      #define SHADER_NAME component-vert
      
      precision highp float;

      in vec2 aVertexPosition;
      in vec2 aTextureCoord;
      in vec4 aColor;
      in float aBlendMode;

      uniform mat3 translationMatrix;
      uniform vec2 screenDimensions;

      in float aTextureId;
      in vec2 aOcclusionAlphas;
      in vec4 aOcclusionData;

      uniform mat3 projectionMatrix;

      out vec2 vTextureCoord;
      out vec2 vScreenCoord;
      flat out vec4 vColor;
      flat out float vBlendMode;
      flat out float vTextureId;

      void main() {
        vec2 vertexPosition = (translationMatrix * vec3(aVertexPosition, 1.0)).xy;

        gl_Position = vec4((projectionMatrix * vec3(vertexPosition, 1.0)).xy, 0.0, 1.0);
        vTextureCoord = aTextureCoord;
        vScreenCoord = vertexPosition / screenDimensions;
        vColor = aColor;
        vBlendMode = aBlendMode;
        vTextureId = aTextureId;
      }
    `
  }

  /* ---------------------------------------- */

  /** @override */
  static get batchFragmentShader() {
    return /* glsl */ `#version 300 es
      #define SHADER_NAME component-frag
			#define texture2D texture

      precision mediump float;

      in vec2 vTextureCoord;
      in vec2 vScreenCoord;
      flat in vec4 vColor;
      flat in float vBlendMode;
      flat in float vTextureId;

      uniform sampler2D uSamplers[%count%];

      out vec4 fragColor;

      void main() {
				vec4 color;
        %forloop%
        color *= vColor; // tint
        color.rgb *= color.a; // premultiply alpha
				// Apply blend mode. 0 for additive, 1 for normal blending.
				// Recap: Additive blend func: (src * 1) + (dst * 1)
				// Recap: Normal blend func: (src * src_alpha) + (dst * (1 - src_alpha))
				// By using a blend func of (src * 1) + (dst * (1 - src_alpha)), we can handle both
				// as long as we multiply the src alpha manually.
				// src * 1 implicityly becomes src * src_alpha by multiplying the color with alpha component.
				// We then simply have set src alpha to 0 for additive blending and 1 for normal blending.
        color.a *= vBlendMode;
        fragColor = color;
        
      }
    `
  }
}

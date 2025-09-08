/**
 * Render Crucible batched grid-aligned token hitboxes.
 * Rendered just after the Grid and before Tokens interface (ERASE will punch through).
 */
export default class CrucibleHitBoxShader extends foundry.canvas.rendering.shaders.BaseSamplerShader {

  /** @override */
  static classPluginName = "batchCrucibleHitBox";

  /** @override */
  static pausable = false;

  /** @override */
  static batchGeometry = [
    {id:"aColor", size:4, normalized: true,  type: PIXI.TYPES.UNSIGNED_BYTE},
    {id:"aCenter", size:2, normalized: false, type: PIXI.TYPES.FLOAT},
    {id:"aHalfSize", size:2, normalized: false, type: PIXI.TYPES.FLOAT},
    {id:"aCorner", size:2, normalized: false, type: PIXI.TYPES.FLOAT}
  ];

  /** @override */
  static batchVertexSize = 7;

  /** @override */
  static batchDefaultUniforms() {
    return {
      time: 0,
      gridSize: 100,
      thickness: 25,
      dashCount: 12,
      dashNormLength: 1,
      dashBlur: 0.15,
      dashCyclePerSecond: 1,
      zoomScale: 1.0
    };
  }

  /* -------------------------------------------- */

  /** @override */
  static _preRenderBatch(batchRenderer) {
    const u = batchRenderer._shader?.uniforms;
    if ( !u ) return;
    u.time = canvas.app.ticker.lastTime / 1000;
    u.gridSize = canvas?.grid?.size ?? u.gridSize;
    u.zoomScale = canvas?.stage?.scale.x || 1.0;
  }

  /* -------------------------------------------- */

  /** @override */
  static _packInterleavedGeometry(element, attributeBuffer, indexBuffer, aIndex, iIndex) {
    const {float32View, uint32View} = attributeBuffer;

    // Indices data
    const baseVertex = aIndex / this.vertexSize;
    const idx = element.indices;
    for ( let n = 0; n < idx.length; n++ ) indexBuffer[iIndex++] = baseVertex + idx[n];

    // Token data
    const token = element.object?.object || element.object;
    const hb = token.getHitboxCache();
    const abgr = hb.abgr;
    const hitboxCenterX = hb.hitboxCenterX;
    const hitboxCenterY = hb.hitboxCenterY;
    const hitboxHalfWidth = hb.hitboxHalfWidth;
    const hitboxHalfHeight = hb.hitboxHalfHeight;

    // The four corners to deduct the viewport from center and grid size
    const corners = [-1, -1, 1, -1, 1, 1, -1, 1];

    // Packing data
    const vs = this.vertexSize;
    for ( let i = 0, j = 0; i < corners.length; i += 2, j += vs ) {
      let k = aIndex + j;
      uint32View[k++] = abgr;
      float32View[k++] = hitboxCenterX;
      float32View[k++] = hitboxCenterY;
      float32View[k++] = hitboxHalfWidth;
      float32View[k++] = hitboxHalfHeight;
      float32View[k++] = corners[i];
      float32View[k++] = corners[i + 1];
    }
  }

  /* -------------------------------------------- */

  /** @override */
  static get batchVertexShader() {
    return `#version 300 es
    precision ${PIXI.settings.PRECISION_VERTEX} float;
    
    in vec2 aCenter;
    in vec2 aHalfSize;
    in vec4 aColor;
    in vec2 aCorner;
    
    uniform mat3 projectionMatrix;
    uniform vec4 tint;
    
    out vec2 vLocal;
    flat out vec2 vHalfSize;
    flat out vec4 vColor;

    void main() {
      vec2 pos = aCenter + aCorner * aHalfSize;
      gl_Position = vec4((projectionMatrix * vec3(pos, 1.0)).xy, 0.0, 1.0);
     
      vLocal = aCorner * aHalfSize;
      vHalfSize = aHalfSize;
      vColor = aColor * tint;
    }
    `;
  }

  /* -------------------------------------------- */

  /** @override */
  static get batchFragmentShader() {
    return `#version 300 es
    precision ${PIXI.settings.PRECISION_FRAGMENT} float;
    #define texture2D texture
    
    in vec2 vLocal;
    flat in vec2 vHalfSize;
    flat in vec4 vColor;
    
    uniform float time;
    uniform float thickness;
    uniform float zoomScale;
    
    uniform float dashCount;
    uniform float dashNormLength;
    uniform float dashBlur;
    uniform float dashCyclePerSecond;
    
    // Will be ignored by the GPU compilator. Necessary to make the shader generator happy
    uniform sampler2D uSamplers[%count%];
    
    out vec4 fragColor;
    
    float sdBox(in vec2 p, in vec2 b){
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }
    
    void main(){
      float d = sdBox(vLocal, vHalfSize);
      float aa = max(fwidth(d), 1e-4);
      float halfW = 0.5 * max(thickness * zoomScale, 0.75);
      float stroke = 1.0 - smoothstep(halfW - aa, halfW + aa, abs(d));
    
      vec2 b = vHalfSize;
      vec2 p = vLocal;
      float lx = 2.0 * b.x; 
      float ly = 2.0 * b.y;
      float P = 2.0 * (lx + ly);
      float dx = b.x - abs(p.x);
      float dy = b.y - abs(p.y);
      bool  vertical = dx < dy;
      float s;
      if ( vertical ) {
        float u = p.y + b.y;
        s = (p.x < 0.0) ? u : (ly + lx + (ly - u));
      } 
      else {
        float u = p.x + b.x;
        s = (p.y > 0.0) ? (ly + u) : (ly + lx + ly + (lx - u));
      }
      float sn = (P > 0.0) ? fract(s / P) : 0.0;
    
      float cycles = max(dashCount, 1.0);
      float duty = clamp(dashNormLength, 0.0, 1.0);
      float x = fract(sn * cycles - time * dashCyclePerSecond);
      float tri = abs(x - 0.5) * 2.0;
      float halfOn = 0.5 * duty;
      float blurDist = max(dashBlur, 1e-4);
      float dash = 1.0 - smoothstep(halfOn, halfOn + blurDist, tri);
    
      float m = stroke * dash;
      fragColor = vec4(vColor.rgb * m, vColor.a * m);
    
      // Will be ignored by the GPU compilator. Necessary to make the shader generator happy
      // FIXME: this is hacky (we should find a better solution with another shader generator)
      if ( false ) {
        const float vTextureId = 0.0;
        vec4 color = vec4(0.0);
        vec2 vTextureCoord = vec2(0.0);
        %forloop%
      }
    }
    `;
  }
}

/**
 * Render Crucible batched grid-aligned token hitboxes.
 * Rendered just after the Grid and before Tokens interface (ERASE will punch through).
 *
 * aAnimationTypes bit flags:
 *  bit 1 => const int OPT_SOLID_STROKE = 0x01 = 1;
 *  bit 2 => const int OPT_SOLID_FILL = 0x02 = 2;
 *  bit 3 => const int OPT_CELL_FADE_FILL = 0x04 = 4;
 *  bit 4 => const int OPT_GRID_RIPPLES = 0x08 = 8;
 *  bit 5 => const int OPT_RADAR_SWEEP = 0x10 = 16;
 *  All other bits RESERVED for Foundry CORE or CRUCIBLE SYSTEM!
 */
export default class CrucibleHitBoxShader extends foundry.canvas.rendering.shaders.BaseSamplerShader {

  static classPluginName = "batchCrucibleHitBox";
  static pausable = false;

  static batchGeometry = [
    {id:"aColor", size:4, normalized:true,  type: PIXI.TYPES.UNSIGNED_BYTE},
    {id:"aAnimationTypes", size:1, normalized:false, type: PIXI.TYPES.FLOAT},
    {id:"aDashOffsetPx", size:1, normalized:false, type: PIXI.TYPES.FLOAT},
    {id:"aCenterWorld", size:2, normalized:false, type: PIXI.TYPES.FLOAT},
    {id:"aObjectCells", size:1, normalized:false, type: PIXI.TYPES.FLOAT},
    {id:"aCorner", size:2, normalized:false, type: PIXI.TYPES.FLOAT}
  ];

  static batchVertexSize = 8;

  static batchDefaultUniforms() {
    return {
      time: 0,
      gridSize: 100,
      zoomScale: 1.0,
      cameraPos: [0, 0],
      cameraPivot: [0, 0],
      targetIndicatorColor: [0.4, 1, 0.5, 1],
      thickness: 8,
      dashCount: 12,
      dashNormLength: 0.75,
      dashBlur: 0,
      dashCyclePerSecond: 1,
      dashBorderPixels: 2,
      hoverPulsePx: -10,
      hoverPulseHz:  1.0,
      perimPhasePx: 35 // TODO to refine later
    };
  }

  /**
   * Bitmask options
   * @type {{solidStroke: boolean, solidFill: boolean, cellFadeFill: boolean, gridRipples: boolean, radarSweep: boolean}}
   */
  static STATES = {
    hovered: false,      // 0x01
    controlled: false,   // 0x02
    targetted: false,    // 0x04
    solidFill: false,    // 0x08
    cellFadeFill: false, // 0x10
    gridRipples: false,  // 0x20
    radarSweep: false,   // 0x40
  };

  /* -------------------------------------------- */

  /** @override */
  static _preRenderBatch(batchRenderer) {
    const u = batchRenderer._shader?.uniforms;
    if ( !u ) return;

    const stage = canvas?.stage;
    const grid  = canvas?.grid;

    u.time = canvas.app.ticker.lastTime / 1000;
    u.zoomScale = stage?.scale?.x || 1.0;
    u.cameraPos = [stage?.position?.x ?? 0, stage?.position?.y ?? 0];
    u.cameraPivot = [stage?.pivot?.x ?? 0, stage?.pivot?.y ?? 0];

    let gs = grid?.size ?? (u.gridSize || 100);
    const subdiv = (grid?.micro?.size ?? null) ?? (grid?.subdivisions ?? null);
    if ( typeof grid?.micro?.size === "number" && grid.micro.size > 0 ) gs = grid.micro.size;
    else if ( typeof subdiv === "number" && subdiv > 1 ) gs = gs / subdiv;
    u.gridSize = gs;
  }

  /* -------------------------------------------- */

  /** @override */
  static _packInterleavedGeometry(element, attributeBuffer, indexBuffer, aIndex, iIndex) {
    const {float32View, uint32View} = attributeBuffer;

    const baseVertex = aIndex / this.vertexSize;
    const idx = element.indices;
    for ( let n = 0; n < idx.length; n++ ) indexBuffer[iIndex++] = baseVertex + idx[n];

    const token = element.crucibleToken;
    const hb = token.getHitBoxData();
    const abgr = token.getHitBoxBorderColor();

    const cxWorld = hb.centerX;
    const cyWorld = hb.centerY;
    const objectCells = hb.sizeUnits ?? 4;

    const animationTypes = hb.animationTypes.valueOf() ?? 0;
    const dashOffsetPx = hb.dashOffsetPx ?? 0;

    const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
    const vs = this.vertexSize;

    for ( let i = 0, j = 0; i < corners.length; i += 2, j += vs ) {
      let k = aIndex + j;
      uint32View[k++] = abgr;
      float32View[k++] = animationTypes;
      float32View[k++] = dashOffsetPx;
      float32View[k++] = cxWorld;
      float32View[k++] = cyWorld;
      float32View[k++] = objectCells;
      float32View[k++] = corners[i];
      float32View[k++] = corners[i + 1];
    }
  }

  /* -------------------------------------------- */

  /** @override */
  static get batchVertexShader() {
    return `
    #version 300 es
    precision highp float;
    
    in vec2 aCenterWorld;
    in float aObjectCells;
    in vec4 aColor;
    in vec2 aCorner;
    in float aAnimationTypes;
    in float aDashOffsetPx;
    
    uniform mat3 projectionMatrix;
    uniform vec4 tint;
    uniform float zoomScale;
    uniform vec2 cameraPos;
    uniform vec2 cameraPivot;
    uniform float gridSize;
    
    out vec2 vNormGridExt;
    out vec2 vNormGrid;
    flat out float vObjectCells;
    
    flat out vec4 vVertexColor;
    flat out uint vAnimationTypes;
    flat out float vDashOffsetPx;
    
    out vec2 vLocalPx;
    out vec2 vLocalExPx;
    flat out vec2 vHalfSizePx;
    
    vec2 worldToScreen(in vec2 world){
      return (world - cameraPivot) * zoomScale + cameraPos;
    }
    
    void main(){
      float objectSizeWorld = aObjectCells * gridSize;
      float halfObjectWorld = 0.5 * objectSizeWorld;
      float halfExtendedWorld = halfObjectWorld + 0.5 * gridSize;
    
      vec2 localExtendedWorld = aCorner * halfExtendedWorld;
      vec2 localNormalWorld = aCorner * halfObjectWorld;
    
      vec2 screenExtended = worldToScreen(aCenterWorld + localExtendedWorld);
      gl_Position = vec4((projectionMatrix * vec3(screenExtended, 1.0)).xy, 0.0, 1.0);
    
      vNormGridExt = (localExtendedWorld + halfExtendedWorld) / (objectSizeWorld + gridSize);
      vec2 localRemappedWorld = localExtendedWorld + halfExtendedWorld - vec2(0.5 * gridSize);
      vNormGrid = localRemappedWorld / objectSizeWorld;
    
      vLocalExPx = localExtendedWorld * zoomScale;
      vLocalPx = localNormalWorld * zoomScale;
      vHalfSizePx = vec2(halfObjectWorld * zoomScale);
    
      vVertexColor = aColor * tint;
      vAnimationTypes = uint(round(aAnimationTypes));
      vDashOffsetPx = aDashOffsetPx;
      vObjectCells = aObjectCells;
    }
    `;
  }

  /* -------------------------------------------- */

  /** @override */
  static get batchFragmentShader() {
    return `
    #version 300 es
    precision highp float;     // Note: a lot of uniforms here need high precision => so be it for the whole frag!
    #define texture2D texture
    
    in vec2 vNormGridExt;
    in vec2 vNormGrid;
    flat in float vObjectCells;
    
    in vec2 vLocalPx;
    in vec2 vLocalExPx;
    flat in vec2 vHalfSizePx;
    
    flat in vec4 vVertexColor;
    flat in uint vAnimationTypes;
    flat in float vDashOffsetPx;
    
    uniform float time;
    uniform float zoomScale;
    
    uniform float thickness;
    uniform float dashBorderPixels;
    uniform float dashCount;
    uniform float dashNormLength;
    uniform float dashBlur;
    uniform float dashCyclePerSecond;
    
    uniform float gridSize;
    uniform float perimPhasePx;
    
    uniform vec4 targetIndicatorColor;
    uniform float hoverPulsePx;
    uniform float hoverPulseHz;
    
    // FIXME: Use a dedicated shader generator to avoid this hack
    uniform sampler2D uSamplers[%count%];
    
    out vec4 fragColor;
    
    ${foundry.utils.BitMask.generateShaderBitMaskConstants(Object.keys(this.STATES))}
    
    const float SOLID_ALPHA  = 0.33;
    const float RIPPLE_ALPHA = 0.75;
    
    ${this.CONSTANTS}
    
    float signedDistanceBox(in vec2 p, in vec2 b) {
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }
      
    float stripeMask(in float s, in float period, in float halfOn, in float phase, in float aa, in float blur) {
      float q = mod(s - phase + 0.5 * period, period) - 0.5 * period;
      float edge = halfOn - abs(q);
      return smoothstep(-aa - blur, aa + blur, edge);
    }
    
    void accumulateOver(inout vec4 acc, in vec3 rgb, in float a) {
      float k = 1.0 - acc.a;
      float w = k * a;
      acc.rgb += rgb * w;
      acc.a += w;
    }
    
    // FIXME: Need to use better hash
    float hash12(in vec2 p) {
      return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123);
    }
    
    float gridClipMask() {
      vec2 d = min(vNormGrid, 1.0 - vNormGrid);
      vec2 aa = fwidth(vNormGrid);
      vec2 m = smoothstep(vec2(0.0), aa, d);
      return m.x * m.y;
    }
    
    float ringsPerCell(in vec2 ng) {
      vec2 cellCoord = ng * vObjectCells;
      vec2 cellIdx = floor(cellCoord + 1e-6);
      vec2 cellCenter = (cellIdx + 0.5) / vObjectCells;
      float cs = gridSize * zoomScale;
      vec2 delta = (ng - cellCenter) * vObjectCells;
      float r = length(delta) * cs;
      float rMax = 0.5 * cs - 1.0;
      if ( r > rMax ) return 0.0;
      float j = hash12(cellIdx);
      float spacing = max(0.18 * cs, 1.0);
      float speed = 0.20 * cs;
      float phase = (time + j) * speed;
      float saw = abs(mod(r + phase, spacing) - 0.5*spacing);
      float aa = max(fwidth(r), 1e-4);
      float ring = smoothstep(1.0 + aa, 1.0 - aa, saw);
      float edgeFade = 1.0 - smoothstep(rMax - 2.0, rMax, r);
      return ring * edgeFade;
    }
    
    float cellFade(in vec2 ng) {
      vec2 cellIdx = floor(ng * vObjectCells + 1e-6);
      float j = hash12(cellIdx);
      float freq = 0.40 + 0.35 * j;
      float t = fract((time + j) * freq);
      float tri = 1.0 - abs(2.0 * t - 1.0);
      return 0.5 * tri;
    }
       
    struct SideUV {
      float s;
      float aa;
    };
    
    SideUV sidePerimeter(in vec2 p, in vec2 halfPx) {
      float w = halfPx.x;
      float h = halfPx.y;
    
      float dx = w - abs(p.x);
      float dy = h - abs(p.y);
    
      const float cornerTol = 1.0;
      float horizMask = step(dy - dx, cornerTol);
      float vertMask = 1.0 - horizMask;
    
      float topMask = step(0.0, p.y);
      float bottomMask = 1.0 - topMask;
      float rightMask = step(0.0, p.x);
      float leftMask = 1.0 - rightMask;
    
      float sBottom = (p.x + w);
      float sTop = (2.0 * w + 2.0 * h) + (w - p.x);
      float sRight = (2.0 * w) + (p.y + h);
      float sLeft = (2.0 * w + 2.0 * h + 2.0 * w) + (h - p.y);
    
      float sHoriz = bottomMask * sBottom + topMask * sTop;
      float sVert = rightMask  * sRight  + leftMask * sLeft;
    
      float s = horizMask * sHoriz + vertMask * sVert;
      float aaH = max(fwidth(p.x), 1e-4);
      float aaV = max(fwidth(p.y), 1e-4);
      float aa = mix(aaV, aaH, horizMask);
    
      SideUV outv;
      outv.s = s;
      outv.aa = aa;
      return outv;
    }
    
    float lineToPointDistance2D(in vec2 a, in vec2 b, in vec2 p) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      float h = clamp(dot(pa,ba) / max(dot(ba,ba), 1e-6), 0.0, 1.0);
      return length(pa - ba*h);
    }
    
    float ringAntiAlias(in float r, in float r0, in float halfPx) {
      float d = abs(r - r0);
      float aa = max(fwidth(r), 1e-4);
      return smoothstep(halfPx + aa, halfPx - aa, d);
    }
    
    float boxAntiAlias(in float x, in float a, in float b, in float aa) { 
      float enter = smoothstep(a - aa, a + aa, x);
      float exit = 1.0 - smoothstep(b - aa, b + aa, x);
      return clamp(enter * exit, 0.0, 1.0);
    }
    
    float radarBeam() {
      vec2 halfExPx = vHalfSizePx + vec2(0.5 * gridSize * zoomScale);
      float rMax = min(halfExPx.x, halfExPx.y) - 2.0;
    
      vec2 p = vLocalExPx;
      float r = length(p);
      float theta = atan(p.y, p.x);
    
      float head = time * 1.2;
    
      vec2 a = vec2(0.0);
      vec2 b = vec2(cos(head), sin(head)) * rMax;
      float dist = lineToPointDistance2D(a, b, p);
      float aa = max(fwidth(dist), 1e-4);
      float lineWidthPx = 1.8;
      float core = smoothstep(lineWidthPx + aa * 2.0, lineWidthPx - aa * 2.0, dist);
    
      float d = head - theta;
      d = mod(d + PI, TWOPI) - PI;
      float behind = step(0.0, d);
    
      float trailAngle = 0.8;
      float wedge = behind * exp(-d / max(trailAngle, 1e-3));
    
      float inner = smoothstep(0.0, rMax * 0.15, r);
      float outer = 1.0 - smoothstep(rMax - 4.0, rMax + 1.0, r);
      float radial = inner * outer * (r / max(rMax, 1.0));
    
      float rim = ringAntiAlias(r, rMax, 2.5);
      return clamp((0.95 * core + 0.85 * wedge) * radial + 0.85 * rim, 0.0, 1.0);
    }
    
    void main(){
      float clipMask = gridClipMask();
    
      float sdClip = signedDistanceBox(vLocalPx, vHalfSizePx);
      float sdDash = signedDistanceBox(vLocalExPx, vHalfSizePx);
      float aaClip = max(fwidth(sdClip), 1e-4);
      float insideBox = smoothstep(0.0, aaClip, -sdClip);

      bool targetted = ((vAnimationTypes & TARGETTED) != 0U);
      bool hovered = ((vAnimationTypes & HOVERED) != 0U);
      bool controlled= ((vAnimationTypes & CONTROLLED) != 0U);
    
      float thicknessPx = max(thickness * zoomScale, 0.0);
      float borderPx = max(dashBorderPixels * zoomScale, 0.0);
      
      float deltaPx = vDashOffsetPx * zoomScale;
      if ( targetted ) {
        float k = (hoverPulsePx * cos(TWOPI * hoverPulseHz * time) + 1.0) * 0.5 * zoomScale;
        deltaPx += k;
      }
      
      float aaDash = max(fwidth(sdDash), 1e-4);
      float eps = aaDash * 0.5;
      float aAll = -deltaPx - thicknessPx;
      float bAll = -deltaPx - (1.0 - step(aaDash, abs(deltaPx))) * eps;
      float bandAll = boxAntiAlias(sdDash, aAll, bAll, aaDash);
    
      float aFill = aAll + borderPx;
      float bFill = bAll - borderPx;
      float bandFill = (thicknessPx > 2.0 * borderPx) ? boxAntiAlias(sdDash, aFill, bFill, aaDash) : 0.0;
    
      float w = vHalfSizePx.x;
      float h = vHalfSizePx.y;
      float perim = 4.0 * (w + h);
    
      SideUV uv = sidePerimeter(vLocalPx, vHalfSizePx);
    
      float N = max(1.0, round(dashCount));
      float period = perim / N;
      float halfOn = 0.5 * clamp(dashNormLength, 0.0, 1.0) * period;
      float phase = perimPhasePx - time * dashCyclePerSecond * period;
      float blur = clamp(dashBlur, 0.0, 0.25) * period;
       
      float tAll = (controlled || hovered) ? 1.0 : stripeMask(uv.s, period, halfOn, phase, uv.aa, blur);
    
      float shrink = clamp(dashNormLength - (2.0 * borderPx) / max(period, 1e-4), 0.0, 1.0);
      float halfOnFill = 0.5 * shrink * period;
      float tFill = (controlled || hovered) ? 1.0 : (halfOnFill > 0.0 ? stripeMask(uv.s, period, halfOnFill, phase, uv.aa, blur) : 0.0);
    
      float dashAll = bandAll * tAll;
      float dashFill = bandFill * tFill;
      float dashOutline = max(dashAll - dashFill, 0.0);
    
      vec4 outColor = vec4(0.0);
      float fxMask = insideBox * clipMask;
    
      // SOLID FILL OPTION
      if ( (vAnimationTypes & SOLIDFILL) != 0U ){
        accumulateOver(outColor, vVertexColor.rgb, vVertexColor.a * SOLID_ALPHA * fxMask);
      }

      // GRID RIPPLES OPTION
      if ( (vAnimationTypes & GRIDRIPPLES) != 0U ){
        float rip = ringsPerCell(vNormGrid) * fxMask;
        accumulateOver(outColor, vVertexColor.rgb, vVertexColor.a * RIPPLE_ALPHA * rip);
        float ripOut = smoothstep(0.4, 0.6, rip);
        accumulateOver(outColor, vec3(0.0), ripOut * fxMask);
      }

      // CELL FADING OPTION
      if ( (vAnimationTypes & CELLFADEFILL) != 0U || ((hovered && !controlled) || targetted) ){
        float cA = cellFade(vNormGrid) * fxMask;
        accumulateOver(outColor, vVertexColor.rgb, vVertexColor.a * cA);
      }
    
      // RADAR SWEEP OPTION
      if ( (vAnimationTypes & RADARSWEEP) != 0U ){
        float beam = radarBeam();
        accumulateOver(outColor, targetIndicatorColor.rgb, targetIndicatorColor.a * beam);
      }
    
      float aDashFill = clamp(vVertexColor.a * dashFill, 0.0, 1.0);
      outColor.rgb = mix(outColor.rgb, vVertexColor.rgb, aDashFill);
      outColor.a = max(outColor.a, aDashFill);
    
      float aOutline = clamp(dashOutline, 0.0, 1.0);
      outColor.rgb = mix(outColor.rgb, vec3(0.0), aOutline);
      outColor.a = max(outColor.a, aOutline);
    
      // OUTPUT RESULT
      fragColor = outColor;
    
      // FIXME: Use a dedicated shader generator to avoid this hack
      if ( false ){
        const float vTextureId = 0.0;
        vec4 color = vec4(0.0);
        vec2 vTextureCoord = vec2(0.0);
        %forloop%
      }
    }
    `;
  }
}

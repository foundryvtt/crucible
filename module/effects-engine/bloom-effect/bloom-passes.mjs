const bloomShaderVert = /* glsl */ `#version 300 es
  #define SHADER_NAME hdr-bloom-vert
  
  precision highp float;
  
  in vec2 aVertexPosition;
  
  uniform mat3 projectionMatrix;
  
  uniform vec4 inputSize;
  uniform vec4 outputFrame;
  
  out vec2 vTextureCoord;
  
  vec4 filterVertexPosition(void) {
    vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.f)) + outputFrame.xy;
  
    return vec4((projectionMatrix * vec3(position, 1.0f)).xy, 0.0f, 1.0f);
  }
  
  vec2 filterTextureCoord(void) {
    return aVertexPosition * inputSize.zw;
  }
  
  void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
  }
`

const bloomUpsampleShaderFrag = /* glsl */ `#version 300 es
#define SHADER_NAME hdr-bloom-upsampler

precision mediump float;

in vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform bool uIsLastPass;
uniform bool uToneMap;
uniform vec2 uTexelSize;
uniform float uSampleScale;
uniform float uSampleWeight;

out vec4 finalColor;

float luminance(vec3 color) {
  return dot(color, vec3(0.30f, 0.59f, 0.11f));
}

// Narkowicz 2015, "ACES Filmic Tone Mapping Curve"
vec3 aces(vec3 x) {
  const float a = 2.51f;
  const float b = 0.03f;
  const float c = 2.43f;
  const float d = 0.59f;
  const float e = 0.14f;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0f, 1.0f);
}

vec3 reinhardJodie(vec3 x) {
  float l = luminance(x);
  vec3 tx = x / (1.0f + x);
  return mix(x / (1.0f + l), tx, tx);
}

vec3 uncharted2TonemapPartial(vec3 x) {
  float A = 0.15f;
  float B = 0.50f;
  float C = 0.10f;
  float D = 0.20f;
  float E = 0.02f;
  float F = 0.30f;
  return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}

vec3 uncharted2Filmic(vec3 x) {
  float exposure_bias = 2.0f;
  vec3 curr = uncharted2TonemapPartial(x * exposure_bias);

  vec3 W = vec3(11.2f);
  vec3 white_scale = vec3(1.0f) / uncharted2TonemapPartial(W);
  return curr * white_scale;
}

// 4-tap bilinear upsampler (tent filter)
vec4 upsampleTent(sampler2D tex, vec2 uv, vec2 texelSize, float sampleScale) {
  vec4 A = texture(tex, uv + texelSize * vec2(-1, 1));
  vec4 B = texture(tex, uv + texelSize * vec2(1, 1));
  vec4 C = texture(tex, uv + texelSize * vec2(-1, -1));
  vec4 D = texture(tex, uv + texelSize * vec2(1, -1));

  return (A + B + C + D) * .25f;
}

void main(void) {
  if(uIsLastPass) {
    finalColor = texture(uSampler, vTextureCoord);
  } else {
    vec4 upsampled = upsampleTent(uSampler, vTextureCoord, uTexelSize, uSampleScale);
    finalColor = vec4(upsampled.rgb * uSampleWeight, clamp(upsampled.a, 0.0f, 1.0f));
    if(uToneMap) {
      finalColor = vec4(aces(finalColor.rgb), finalColor.a);
    }
    // vec2 textureCoord = vTextureCoord;
    // finalColor = texture(uSampler, textureCoord);
  }
}
`

/** @extends PIXI.Filter */
export class BloomUpsampleFilterPass extends PIXI.Filter {
  constructor() {
    super(bloomShaderVert, bloomUpsampleShaderFrag, {
      uIsLastPass: false,
      uSampleWeight: 1,
      uToneMap: false,
      uTexelSize: new Float32Array(2),
    })
    this.legacy = false
    this.blendMode = PIXI.BLEND_MODES.ADD
  }
}

const bloomDownsampleShaderFrag = /* glsl */ `#version 300 es
  #define SHADER_NAME hdr-bloom-downsampler
  
  precision mediump float;
  
  in vec2 vTextureCoord;
  
  uniform bool uApplyLuminanceThreshold;
  uniform vec2 uTexelSize;
  uniform vec4 uThreshold;
  uniform sampler2D uSampler;
  
  out vec4 finalColor;
  
  // Quadratic color thresholding
  // curve = (threshold - knee, knee * 2, 0.25 / knee)
  vec4 quadraticThreshold(vec4 color, float threshold, vec3 curve) {
    // Pixel brightness
    float lum = dot(color.rgb, vec3(0.30f, 0.59f, 0.11f));
  
    float rq = clamp(lum - curve.x, 0.0f, curve.y);
    rq = curve.z * rq * rq;
  
      // Combine and apply the brightness response curve
    color *= max(rq, lum - threshold) / max(lum, 1e-4f);
  
    return color;
  }
  
  // Better, temporally stable box filtering
  // [Jimenez14] http://goo.gl/eomGso
  // . . . . . . .
  // . A . B . C .
  // . . D . E . .
  // . F . G . H .
  // . . I . J . .
  // . K . L . M .
  // . . . . . . .
  vec4 downsampleBox13Tap(sampler2D tex, vec2 uv, vec2 texelSize) {
    vec4 A = texture(tex, (uv + texelSize * vec2(-1.0f, -1.0f)));
    vec4 B = texture(tex, (uv + texelSize * vec2(0.0f, -1.0f)));
    vec4 C = texture(tex, (uv + texelSize * vec2(1.0f, -1.0f)));
    vec4 D = texture(tex, (uv + texelSize * vec2(-0.5f, -0.5f)));
    vec4 E = texture(tex, (uv + texelSize * vec2(0.5f, -0.5f)));
    vec4 F = texture(tex, (uv + texelSize * vec2(-1.0f, 0.0f)));
    vec4 G = texture(tex, (uv));
    vec4 H = texture(tex, (uv + texelSize * vec2(1.0f, 0.0f)));
    vec4 I = texture(tex, (uv + texelSize * vec2(-0.5f, 0.5f)));
    vec4 J = texture(tex, (uv + texelSize * vec2(0.5f, 0.5f)));
    vec4 K = texture(tex, (uv + texelSize * vec2(-1.0f, 1.0f)));
    vec4 L = texture(tex, (uv + texelSize * vec2(0.0f, 1.0f)));
    vec4 M = texture(tex, (uv + texelSize * vec2(1.0f, 1.0f)));
  
    vec2 div = (1.0f / 4.0f) * vec2(0.5f, 0.125f);
  
    vec4 o = (D + E + I + J) * div.x;
    o += (A + B + G + F) * div.y;
    o += (B + C + H + G) * div.y;
    o += (F + G + L + K) * div.y;
    o += (G + H + M + L) * div.y;
  
    return o;
  }
  
  vec4 prefilter(vec4 color, vec2 uv) {
    // color = min(_Params.x, color); // clamp to max
    color = quadraticThreshold(color, uThreshold.x, uThreshold.yzw);
    return color;
  }
  
  // TODO: implement
  void main(void) {
    vec4 color = downsampleBox13Tap(uSampler, vTextureCoord, uTexelSize);
    if(uApplyLuminanceThreshold) {
      finalColor = prefilter(color, vTextureCoord);
    } else {
      finalColor = color;
    // finalColor = texture(uSampler, vTextureCoord);
    }
  }
`

/** @extends PIXI.Filter */
export class BloomDownsampleFilterPass extends PIXI.Filter {
  /**
   * @param {{ threshold: number; knee: number }} options
   */
  constructor({ threshold, knee }) {
    const uThreshold = new Float32Array(4)
    uThreshold[0] = threshold
    uThreshold[1] = threshold - knee
    uThreshold[2] = knee * 2
    uThreshold[3] = 0.25 / knee
    super(bloomShaderVert, bloomDownsampleShaderFrag, {
      uApplyLuminanceThreshold: false,
      uThreshold,
      uTexelSize: new Float32Array(2),
    })
    this.legacy = false
    this.blendMode = PIXI.BLEND_MODES.NORMAL
  }
}

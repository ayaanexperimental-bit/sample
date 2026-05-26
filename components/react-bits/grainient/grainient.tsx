"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import "./grainient.css";

type GrainientProps = {
  timeSpeed?: number;
  colorBalance?: number;
  warpStrength?: number;
  warpFrequency?: number;
  warpSpeed?: number;
  warpAmplitude?: number;
  blendAngle?: number;
  blendSoftness?: number;
  rotationAmount?: number;
  noiseScale?: number;
  grainAmount?: number;
  grainScale?: number;
  grainAnimated?: boolean;
  contrast?: number;
  gamma?: number;
  saturation?: number;
  centerX?: number;
  centerY?: number;
  zoom?: number;
  color1?: string;
  color2?: string;
  color3?: string;
  frameRate?: number;
  lowPowerFrameRate?: number;
  className?: string;
};

const hexToRgb = (hex: string) => {
  const result = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!result) {
    return [1, 1, 1];
  }

  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ];
};

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uTimeSpeed;
uniform float uColorBalance;
uniform float uWarpStrength;
uniform float uWarpFrequency;
uniform float uWarpSpeed;
uniform float uWarpAmplitude;
uniform float uBlendAngle;
uniform float uBlendSoftness;
uniform float uRotationAmount;
uniform float uNoiseScale;
uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform vec2 uCenterOffset;
uniform float uZoom;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
out vec4 fragColor;
#define S(a,b,t) smoothstep(a,b,t)
mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}
void mainImage(out vec4 o, vec2 C){
  float t=iTime*uTimeSpeed;
  vec2 uv=C/iResolution.xy;
  float ratio=iResolution.x/iResolution.y;
  vec2 tuv=uv-0.5+uCenterOffset;
  tuv/=max(uZoom,0.001);

  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);
  tuv.y*=1.0/ratio;
  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));
  tuv.y*=ratio;

  float frequency=uWarpFrequency;
  float ws=max(uWarpStrength,0.001);
  float amplitude=uWarpAmplitude/ws;
  float warpTime=t*uWarpSpeed;
  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;
  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);

  vec3 colLav=uColor1;
  vec3 colOrg=uColor2;
  vec3 colDark=uColor3;
  float b=uColorBalance;
  float s=max(uBlendSoftness,0.0);
  mat2 blendRot=Rot(radians(uBlendAngle));
  float blendX=(tuv*blendRot).x;
  float edge0=-0.3-b-s;
  float edge1=0.2-b+s;
  float v0=0.5-b+s;
  float v1=-0.3-b-s;
  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));
  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));
  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));

  vec2 grainUv=uv*max(uGrainScale,0.001);
  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);}
  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);
  col+=(grain-0.5)*uGrainAmount;

  col=(col-0.5)*uContrast+0.5;
  float luma=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(vec3(luma),col,uSaturation);
  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));
  col=clamp(col,0.0,1.0);

  o=vec4(col,1.0);
}
void main(){
  vec4 o=vec4(0.0);
  mainImage(o,gl_FragCoord.xy);
  fragColor=o;
}
`;

const ctxMap = new WeakMap<
  HTMLDivElement,
  {
    renderer: Renderer;
    program: Program;
    mesh: Mesh;
  }
>();

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const LOW_POWER_VISUAL_QUERY = "(max-width: 760px), (pointer: coarse)";
const DEFAULT_FRAME_RATE = 18;
const DEFAULT_LOW_POWER_FRAME_RATE = 12;

export default function Grainient({
  timeSpeed = 0.25,
  colorBalance = 0,
  warpStrength = 1,
  warpFrequency = 5,
  warpSpeed = 2,
  warpAmplitude = 50,
  blendAngle = 0,
  blendSoftness = 0.05,
  rotationAmount = 500,
  noiseScale = 2,
  grainAmount = 0.1,
  grainScale = 2,
  grainAnimated = false,
  contrast = 1.5,
  gamma = 1,
  saturation = 1,
  centerX = 0,
  centerY = 0,
  zoom = 0.9,
  color1 = "#FF9FFC",
  color2 = "#5227FF",
  color3 = "#B497CF",
  frameRate = DEFAULT_FRAME_RATE,
  lowPowerFrameRate = DEFAULT_LOW_POWER_FRAME_RATE,
  className = ""
}: GrainientProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRatesRef = useRef({ frameRate, lowPowerFrameRate });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const lowPowerVisuals = window.matchMedia(LOW_POWER_VISUAL_QUERY);

    if (reducedMotion.matches) {
      return;
    }

    let renderer: Renderer;

    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: true,
        antialias: false,
        preserveDrawingBuffer: false,
        powerPreference: "low-power",
        dpr: Math.min(
          window.devicePixelRatio || 1,
          lowPowerVisuals.matches ? 1 : window.innerWidth >= 1280 ? 1.25 : 1
        )
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    const canvas = gl.canvas;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uTimeSpeed: { value: 0.25 },
        uColorBalance: { value: 0 },
        uWarpStrength: { value: 1 },
        uWarpFrequency: { value: 5 },
        uWarpSpeed: { value: 2 },
        uWarpAmplitude: { value: 50 },
        uBlendAngle: { value: 0 },
        uBlendSoftness: { value: 0.05 },
        uRotationAmount: { value: 500 },
        uNoiseScale: { value: 2 },
        uGrainAmount: { value: 0.1 },
        uGrainScale: { value: 2 },
        uGrainAnimated: { value: 0 },
        uContrast: { value: 1.5 },
        uGamma: { value: 1 },
        uSaturation: { value: 1 },
        uCenterOffset: { value: new Float32Array([0, 0]) },
        uZoom: { value: 0.9 },
        uColor1: { value: new Float32Array([1, 1, 1]) },
        uColor2: { value: new Float32Array([1, 1, 1]) },
        uColor3: { value: new Float32Array([1, 1, 1]) }
      }
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctxMap.set(container, { renderer, program, mesh });

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height);
      const resolution = program.uniforms.iResolution.value as Float32Array;
      resolution[0] = gl.drawingBufferWidth;
      resolution[1] = gl.drawingBufferHeight;
      renderer.render({ scene: mesh });
    };

    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(container);
    setSize();

    let animationFrame = 0;
    let isPageVisible = !document.hidden;
    let isVisualAllowed = !reducedMotion.matches;
    let lastRender = 0;
    const startTime = performance.now();

    const loop = (time: number) => {
      const requestedFrameRate = lowPowerVisuals.matches
        ? frameRatesRef.current.lowPowerFrameRate
        : frameRatesRef.current.frameRate;
      const frameInterval = 1000 / Math.max(1, requestedFrameRate);

      if (time - lastRender >= frameInterval) {
        program.uniforms.iTime.value = (time - startTime) * 0.001;
        renderer.render({ scene: mesh });
        lastRender = time;
      }

      animationFrame = requestAnimationFrame(loop);
    };

    const tryStart = () => {
      if (isPageVisible && isVisualAllowed && animationFrame === 0) {
        animationFrame = requestAnimationFrame(loop);
      }
    };

    const tryStop = () => {
      if (animationFrame !== 0) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    };

    const syncPlayback = () => {
      isPageVisible = !document.hidden;
      isVisualAllowed = !reducedMotion.matches;

      if (isPageVisible && isVisualAllowed) {
        tryStart();
      } else {
        tryStop();
      }
    };

    document.addEventListener("visibilitychange", syncPlayback);
    reducedMotion.addEventListener("change", syncPlayback);
    lowPowerVisuals.addEventListener("change", syncPlayback);
    tryStart();

    return () => {
      tryStop();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      reducedMotion.removeEventListener("change", syncPlayback);
      lowPowerVisuals.removeEventListener("change", syncPlayback);
      ctxMap.delete(container);
      canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [frameRate, lowPowerFrameRate]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const ctx = ctxMap.get(container);
    if (!ctx) {
      return;
    }

    const uniforms = ctx.program.uniforms;
    frameRatesRef.current = { frameRate, lowPowerFrameRate };
    uniforms.uTimeSpeed.value = timeSpeed;
    uniforms.uColorBalance.value = colorBalance;
    uniforms.uWarpStrength.value = warpStrength;
    uniforms.uWarpFrequency.value = warpFrequency;
    uniforms.uWarpSpeed.value = warpSpeed;
    uniforms.uWarpAmplitude.value = warpAmplitude;
    uniforms.uBlendAngle.value = blendAngle;
    uniforms.uBlendSoftness.value = blendSoftness;
    uniforms.uRotationAmount.value = rotationAmount;
    uniforms.uNoiseScale.value = noiseScale;
    uniforms.uGrainAmount.value = grainAmount;
    uniforms.uGrainScale.value = grainScale;
    uniforms.uGrainAnimated.value = grainAnimated ? 1 : 0;
    uniforms.uContrast.value = contrast;
    uniforms.uGamma.value = gamma;
    uniforms.uSaturation.value = saturation;
    uniforms.uCenterOffset.value = new Float32Array([centerX, centerY]);
    uniforms.uZoom.value = zoom;
    uniforms.uColor1.value = new Float32Array(hexToRgb(color1));
    uniforms.uColor2.value = new Float32Array(hexToRgb(color2));
    uniforms.uColor3.value = new Float32Array(hexToRgb(color3));
    ctx.renderer.render({ scene: ctx.mesh });
  }, [
    blendAngle,
    blendSoftness,
    centerX,
    centerY,
    color1,
    color2,
    color3,
    colorBalance,
    contrast,
    frameRate,
    gamma,
    grainAmount,
    grainAnimated,
    grainScale,
    lowPowerFrameRate,
    noiseScale,
    rotationAmount,
    saturation,
    timeSpeed,
    warpAmplitude,
    warpFrequency,
    warpSpeed,
    warpStrength,
    zoom
  ]);

  return <div ref={containerRef} className={`grainient-container ${className}`.trim()} />;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { getPresetById, LiquidShaderConfig } from "@/lib/backgrounds";

const vertexShaderSource = `#version 300 es
layout(location = 0) in vec4 a_position;
void main() {
  gl_Position = a_position;
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;
uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;
out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
  vec3 color1 = c1.rgb * c1.a;
  vec3 color2 = c2.rgb * c2.a;
  vec3 color3 = c3.rgb * c3.a;
  float r1 = smoothstep(0.0 + 0.35 * edgesWidth, 0.7 - 0.35 * edgesWidth + 0.5 * edge_blur, mixer);
  float r2 = smoothstep(0.3 + 0.35 * edgesWidth, 1.0 - 0.35 * edgesWidth + edge_blur, mixer);
  vec3 blended_color_2 = mix(color1, color2, r1);
  float blended_opacity_2 = mix(c1.a, c2.a, r1);
  vec3 c = mix(blended_color_2, color3, r2);
  float o = mix(blended_opacity_2, c3.a, r2);
  return vec4(c, o);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = 0.5 * u_time;
  float noise_scale = 0.0005 + 0.006 * u_scale;
  uv -= 0.5;
  uv *= (noise_scale * u_resolution);
  uv = rotate(uv, u_rotation * 0.5 * PI);
  uv /= u_pixelRatio;
  uv += 0.5;
  float n1 = noise(uv * 1.0 + t);
  float n2 = noise(uv * 2.0 - t);
  float angle = n1 * TWO_PI;
  uv.x += 4.0 * u_distortion * n2 * cos(angle);
  uv.y += 4.0 * u_distortion * n2 * sin(angle);
  float iterations_number = ceil(clamp(u_swirlIterations, 1.0, 25.0));
  for (float i = 1.0; i <= iterations_number; i++) {
    uv.x += clamp(u_swirl, 0.0, 2.0) / i * cos(t + i * 1.5 * uv.y);
    uv.y += clamp(u_swirl, 0.0, 2.0) / i * cos(t + i * 1.0 * uv.x);
  }
  float proportion = clamp(u_proportion, 0.0, 1.0);
  float shape = 0.0;
  float mixer = 0.0;
  if (u_shape < 0.5) {
    vec2 checks_shape_uv = uv * (0.5 + 3.5 * u_shapeScale);
    shape = 0.5 + 0.5 * sin(checks_shape_uv.x) * cos(checks_shape_uv.y);
    mixer = shape + 0.48 * sign(proportion - 0.5) * pow(abs(proportion - 0.5), 0.5);
  } else if (u_shape < 1.5) {
    vec2 stripes_shape_uv = uv * (0.25 + 3.0 * u_shapeScale);
    float f = fract(stripes_shape_uv.y);
    shape = smoothstep(0.0, 0.55, f) * smoothstep(1.0, 0.45, f);
    mixer = shape + 0.48 * sign(proportion - 0.5) * pow(abs(proportion - 0.5), 0.5);
  } else {
    float sh = 1.0 - uv.y;
    sh -= 0.5;
    sh /= (noise_scale * u_resolution.y);
    sh += 0.5;
    float shape_scaling = 0.2 * (1.0 - u_shapeScale);
    shape = smoothstep(0.45 - shape_scaling, 0.55 + shape_scaling, sh + 0.3 * (proportion - 0.5));
    mixer = shape;
  }
  vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer, 1.0 - clamp(u_softness, 0.0, 1.0), 0.01 + 0.01 * u_scale);
  fragColor = vec4(color_mix.rgb, color_mix.a);
}
`;

function hexToRgba(hex: string): [number, number, number, number] {
  let c = hex.replace(/^#/, "");
  if (c.length === 3) {
    c = c.split("").map((ch) => ch + ch).join("");
  }
  if (c.length === 6) {
    c += "ff";
  }
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const a = parseInt(c.slice(6, 8), 16) / 255;
  return [r || 0, g || 0, b || 0, Number.isFinite(a) ? a : 1];
}

interface AnimatedLiquidBackgroundProps {
  className?: string;
  presetId?: string;
  config?: Partial<LiquidShaderConfig>;
}

export function AnimatedLiquidBackground({
  className = "",
  presetId = "lava",
  config,
}: AnimatedLiquidBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webGlSupported, setWebGlSupported] = useState(true);

  // Compute active shader configuration
  const activePreset = getPresetById(presetId);
  const activeConfig: LiquidShaderConfig = {
    ...activePreset.config,
    ...(config || {}),
  };

  const configRef = useRef(activeConfig);
  configRef.current = activeConfig;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      setWebGlSupported(false);
      return;
    }

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) {
      setWebGlSupported(false);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setWebGlSupported(false);
      return;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      setWebGlSupported(false);
      return;
    }

    gl.useProgram(program);

    // Quad geometry
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const posAttr = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const locs = {
      u_time: gl.getUniformLocation(program, "u_time"),
      u_pixelRatio: gl.getUniformLocation(program, "u_pixelRatio"),
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_scale: gl.getUniformLocation(program, "u_scale"),
      u_rotation: gl.getUniformLocation(program, "u_rotation"),
      u_color1: gl.getUniformLocation(program, "u_color1"),
      u_color2: gl.getUniformLocation(program, "u_color2"),
      u_color3: gl.getUniformLocation(program, "u_color3"),
      u_proportion: gl.getUniformLocation(program, "u_proportion"),
      u_softness: gl.getUniformLocation(program, "u_softness"),
      u_shape: gl.getUniformLocation(program, "u_shape"),
      u_shapeScale: gl.getUniformLocation(program, "u_shapeScale"),
      u_distortion: gl.getUniformLocation(program, "u_distortion"),
      u_swirl: gl.getUniformLocation(program, "u_swirl"),
      u_swirlIterations: gl.getUniformLocation(program, "u_swirlIterations"),
    };

    let animationFrameId: number;
    let lastTime = performance.now();
    let totalTime = (configRef.current.offset || 0) * 10;

    // Apply uniforms
    const applyUniforms = (cfg: LiquidShaderConfig) => {
      const color1 = hexToRgba(cfg.color1);
      const color2 = hexToRgba(cfg.color2);
      const color3 = hexToRgba(cfg.color3);

      gl.uniform1f(locs.u_scale, cfg.scale);
      gl.uniform1f(locs.u_rotation, (cfg.rotation * Math.PI) / 180);
      gl.uniform4fv(locs.u_color1, color1);
      gl.uniform4fv(locs.u_color2, color2);
      gl.uniform4fv(locs.u_color3, color3);
      gl.uniform1f(locs.u_proportion, cfg.proportion ?? 1.0);
      gl.uniform1f(locs.u_softness, cfg.softness);
      gl.uniform1f(locs.u_shape, cfg.shape);
      gl.uniform1f(locs.u_shapeScale, cfg.shapeScale);
      gl.uniform1f(locs.u_distortion, cfg.distortion);
      gl.uniform1f(locs.u_swirl, cfg.swirl);
      gl.uniform1f(locs.u_swirlIterations, cfg.swirlIterations);
    };

    applyUniforms(configRef.current);

    // Resize handling with optimized resolution for buttery-smooth performance
    let needsResize = true;
    const handleResize = () => {
      if (!canvas) return;
      // Cap render buffer dimensions: ambient liquid gradients are visually identical with bilinear filtering, but use 80% less GPU
      const targetW = Math.min(canvas.clientWidth || 1280, 1280);
      const targetH = Math.min(canvas.clientHeight || 720, 720);
      const displayWidth = Math.max(Math.floor(targetW), 320);
      const displayHeight = Math.max(Math.floor(targetH), 200);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        needsResize = true;
      }
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(canvas);
    handleResize();

    let isDocumentHidden = typeof document !== "undefined" ? document.hidden : false;
    const handleVisibilityChange = () => {
      isDocumentHidden = document.hidden;
      if (!isDocumentHidden) {
        lastTime = performance.now();
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Render loop with adaptive frame pacing (~33fps for smooth ambient liquid without GPU strain)
    const render = (now: number) => {
      if (isDocumentHidden) {
        return;
      }

      const elapsed = now - lastTime;
      if (elapsed < 30) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const delta = elapsed / 1000;
      lastTime = now;

      const currentCfg = configRef.current;
      const speed = (currentCfg.speed / 100) * 1.8;
      totalTime += delta * speed;

      gl.useProgram(program);
      applyUniforms(currentCfg);
      gl.uniform1f(locs.u_time, totalTime);

      if (needsResize) {
        gl.uniform2f(locs.u_resolution, canvas.width, canvas.height);
        gl.uniform1f(locs.u_pixelRatio, 1.0);
        needsResize = false;
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resizeObserver.disconnect();
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div
      id="animated-lava-bg-container"
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {webGlSupported ? (
        <canvas
          ref={canvasRef}
          id="lava-webgl-canvas"
          className="w-full h-full block object-cover"
        />
      ) : (
        /* Fallback if WebGL2 is disabled */
        <div
          id="lava-css-fallback"
          className="w-full h-full bg-gradient-to-br from-[#120502] via-[#2a0802] to-[#070709]"
        />
      )}

      {/* Atmospheric dark depth vignette gradient */}
      <div
        id="lava-vignette-overlay"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,5,8,0.45)_75%,rgba(5,5,8,0.85)_100%)] pointer-events-none"
      />

      {/* Subtle film grain texture overlay */}
      <div
        id="lava-film-grain"
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"
      />
    </div>
  );
}

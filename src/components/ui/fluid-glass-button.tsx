"use client";

import React, { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

interface FluidGlassButtonProps {
  text?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  baseColor?: [number, number, number]; // RGB 0-1
  glassColor?: [number, number, number]; // RGB 0-1
  hoverSpeed?: number;
  icon?: boolean;
}

const VERTEX_SHADER_SRC = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uHover;
uniform float uClick;
uniform vec3 uBaseColor;
uniform vec3 uGlassColor;
uniform vec2 uResolution;

// Hash function for pseudo-randomness
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Simplex-style noise
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Fractal Brownian Motion for liquid distortion
float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    for(int i = 0; i < 4; i++) {
        f += amp * noise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return f;
}

void main() {
    // Aspect-corrected coordinates for perfect pill shape math
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= aspect;

    // Center calculations for the liquid click surge
    vec2 center = vec2(0.5);
    vec2 dirToCenter = normalize(vUv - center + vec2(0.0001));
    float distToCenter = length(vUv - center);

    // 1. SDF (Signed Distance Field) for a Pill Shape
    float r = 1.0; 
    vec2 b = vec2(max(aspect - 1.0, 0.0), 0.0);
    vec2 d = abs(p) - b;
    float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
    
    // Normalized distance from edge (0 = edge, 1 = center)
    float innerDist = clamp(abs(dist), 0.0, 1.0);

    // 2. Dynamic Liquid Noise Field
    float t = uTime;
    
    // Stretch noise horizontally
    vec2 noiseUv = vUv * vec2(2.0, 1.0);
    
    // Dynamic warping on hover + Liquid Surge on Click
    vec2 warp = vec2(fbm(noiseUv + t * 0.5), fbm(noiseUv + t * 0.5 + 12.34)) * mix(0.0, 0.4, uHover);
    warp -= dirToCenter * uClick * 0.25 * smoothstep(0.8, 0.0, distToCenter);
    
    float n1 = fbm(noiseUv + warp + vec2(t, 0.0));
    float n2 = fbm(noiseUv + warp + vec2(n1, t * 1.2));

    // 3. Glassy Rim & Specular Highlights
    float rimWidth = mix(0.15, 0.35, n2) * mix(1.0, 1.4, uHover);
    rimWidth += uClick * 0.15; // Rim expands on click
    float rim = smoothstep(rimWidth, 0.0, innerDist);
    
    float specDist = abs(innerDist - 0.12 + n1 * 0.08);
    float specular = smoothstep(0.03, 0.0, specDist);

    float rightBias = smoothstep(0.2, 1.0, vUv.x);
    rim *= mix(0.6, 1.5, rightBias);
    specular *= mix(0.5, 2.0, rightBias);

    // 4. Highly Dynamic Stars / Particles
    vec2 starUv = vUv * vec2(aspect * 6.0, 6.0);
    
    starUv.x -= uTime * 0.2; 
    starUv.y += sin(uTime * 0.5 + starUv.x) * mix(0.2, 0.6, uHover);
    
    // Star Burst on Click
    starUv += dirToCenter * uClick * 1.5;

    vec2 id = floor(starUv);
    vec2 gv = fract(starUv) - 0.5;

    float nStar = hash(id);
    float star = 0.0;
    
    float starThreshold = mix(0.94, 0.86, uHover);
    
    if (nStar > starThreshold) {
        float sizeMod = mix(0.5, 2.5, hash(id + 13.37));
        
        vec2 localWiggle = vec2(
            sin(uTime * 2.0 + nStar * 50.0),
            cos(uTime * 2.3 + nStar * 40.0)
        ) * 0.25 * uHover;

        float starDist = length(gv - localWiggle) * sizeMod;
        
        star = smoothstep(0.12, 0.0, starDist);
        star += smoothstep(0.25, 0.0, starDist) * 0.3;

        float twinklePhase = uTime * mix(5.0, 15.0, hash(id + 42.0));
        star *= sin(twinklePhase + nStar * 100.0) * 0.5 + 0.5;
        
        star *= smoothstep(0.05, 0.2, innerDist);
    }

    // 5. Compositing
    vec3 color = uBaseColor;
    
    float innerLiquid = smoothstep(0.2, 0.9, n2) * (1.0 - innerDist) * mix(0.2, 0.45, uHover);
    color += uGlassColor * innerLiquid;
    
    color += uGlassColor * rim * mix(0.6, 1.2, uHover);
    color += vec3(1.0) * specular * mix(0.8, 2.0, uHover);
    
    color += vec3(1.0) * star * mix(0.8, 1.5, uHover);

    // Click Flash Effects
    color += uGlassColor * rim * uClick * 0.8;
    color += vec3(1.0) * specular * uClick * 1.5;
    color += uGlassColor * exp(-distToCenter * 6.0) * uClick * 0.6;

    color *= smoothstep(1.5, 0.2, length(vUv - 0.5));

    // Alpha handling for true transparent glass effect
    float alpha = clamp(innerDist * 0.85 + rim * 0.5 + specular * 0.6 + star * 0.8, 0.35, 0.95);
    gl_FragColor = vec4(color, alpha);
}
`;

export function FluidGlassButton({
  text = "Upgrade",
  onClick,
  className = "",
  baseColor = [0.08, 0.08, 0.12], // Deep glossy tint
  glassColor = [0.75, 0.8, 0.95], // Crisp silvery-blue specular reflection
  hoverSpeed = 0.6,
  icon = true,
}: FluidGlassButtonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLButtonElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const hoverValRef = useRef(0);
  const clickValRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    // Vertex shader
    const vs = gl.createShader(gl.VERTEX_SHADER);
    if (!vs) return;
    gl.shaderSource(vs, VERTEX_SHADER_SRC);
    gl.compileShader(vs);

    // Fragment shader
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fs) return;
    gl.shaderSource(fs, FRAGMENT_SHADER_SRC);
    gl.compileShader(fs);

    // Program
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Shader program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Quad geometry: 2 triangles covering [-1, 1]
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosLoc = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniform locations
    const uTimeLoc = gl.getUniformLocation(program, "uTime");
    const uHoverLoc = gl.getUniformLocation(program, "uHover");
    const uClickLoc = gl.getUniformLocation(program, "uClick");
    const uBaseColorLoc = gl.getUniformLocation(program, "uBaseColor");
    const uGlassColorLoc = gl.getUniformLocation(program, "uGlassColor");
    const uResolutionLoc = gl.getUniformLocation(program, "uResolution");

    gl.uniform3f(uBaseColorLoc, baseColor[0], baseColor[1], baseColor[2]);
    gl.uniform3f(uGlassColorLoc, glassColor[0], glassColor[1], glassColor[2]);

    let animationFrameId: number;
    let timeAccumulator = 0;
    let lastTime = performance.now();
    let currentHoverValue = 0;
    let currentClickValue = 0;
    let isIntersecting = true;

    const render = (time: number) => {
      animationFrameId = requestAnimationFrame(render);
      if (!isIntersecting) {
        lastTime = time;
        return;
      }

      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Smooth hover interpolation
      const targetHover = hoverValRef.current;
      currentHoverValue += (targetHover - currentHoverValue) * Math.min(delta * 4, 1);

      // Consume click surge
      if (clickValRef.current > 0) {
        currentClickValue = clickValRef.current;
        clickValRef.current = 0;
      }
      currentClickValue += (0 - currentClickValue) * Math.min(delta * 6, 1);

      const currentSpeed = 0.15 + (hoverSpeed - 0.15) * currentHoverValue;
      timeAccumulator += delta * currentSpeed;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(uTimeLoc, timeAccumulator);
      gl.uniform1f(uHoverLoc, currentHoverValue);
      gl.uniform1f(uClickLoc, currentClickValue);
      gl.uniform2f(uResolutionLoc, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    animationFrameId = requestAnimationFrame(render);

    // Resize handling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.round(width * dpr);
          canvas.height = Math.round(height * dpr);
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        isIntersecting = entry.isIntersecting;
      }
    });

    intersectionObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
    };
  }, [baseColor, glassColor, hoverSpeed]);

  const handleMouseEnter = () => {
    hoverValRef.current = 1;
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverValRef.current = 0;
    setIsHovered(false);
    setIsPressed(false);
  };

  const handleMouseDown = () => {
    clickValRef.current = 1;
    setIsPressed(true);
  };

  const handleMouseUp = () => {
    setIsPressed(false);
  };

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={`group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full px-3 py-1 text-xs font-semibold text-white select-none transition-all duration-300 active:scale-95 cursor-pointer ${className}`}
      style={{
        background: "rgba(18, 18, 26, 0.75)",
        boxShadow: isHovered
          ? "inset 0 0 0 1px rgba(255, 255, 255, 0.35), 0 0 16px -2px rgba(255, 255, 255, 0.25), 0 4px 12px rgba(0, 0, 0, 0.5)"
          : "inset 0 0 0 1px rgba(255, 255, 255, 0.18), 0 2px 8px rgba(0, 0, 0, 0.4)",
        transform: isPressed ? "scale(0.96)" : isHovered ? "scale(1.02)" : "scale(1)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* WebGL Fluid Glass Shader Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full rounded-full"
        style={{ opacity: 0.95 }}
      />

      {/* Subtle iridescent glass reflection overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full transition-opacity duration-300"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.02) 50%, rgba(180,200,255,0.15) 100%)",
          opacity: isHovered ? 1 : 0.6,
        }}
      />

      {/* Content */}
      <span className="relative z-10 flex items-center gap-1.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
        {icon && (
          <Sparkles
            className={`size-3 transition-transform duration-300 ${
              isHovered ? "scale-110 rotate-12 text-amber-300" : "text-amber-400/90"
            }`}
          />
        )}
        <span
          className="tracking-wide text-[11px] font-medium transition-colors duration-200"
          style={{
            textShadow: isHovered
              ? "0 0 12px rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.8)"
              : "0 1px 2px rgba(0,0,0,0.8)",
          }}
        >
          {text}
        </span>
      </span>
    </button>
  );
}

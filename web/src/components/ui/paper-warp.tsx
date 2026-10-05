"use client";

import { useEffect, useMemo, useRef } from "react";
import type { WarpProps } from "@paper-design/shaders-react";
import { ShaderMount, WarpPatterns, getShaderColorFromString, getShaderNoiseTexture, warpFragmentShader } from "@paper-design/shaders";

type Props = Required<Pick<WarpProps, "colors" | "proportion" | "softness" | "distortion" | "swirl" | "swirlIterations" | "shape" | "shapeScale" | "scale" | "rotation" | "speed" | "frame" | "minPixelRatio" | "maxPixelCount">> & Pick<WarpProps, "style">;

export default function Warp({ colors, proportion, softness, distortion, swirl, swirlIterations, shape, shapeScale, scale, rotation, speed, frame, minPixelRatio, maxPixelCount, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mount = useRef<ShaderMount | null>(null);
  const options = useRef({ speed, frame, minPixelRatio, maxPixelCount });
  options.current = { speed, frame, minPixelRatio, maxPixelCount };
  const uniforms = useMemo(() => ({
    u_colors: colors.map(getShaderColorFromString), u_colorsCount: colors.length,
    u_proportion: proportion, u_softness: softness, u_distortion: distortion,
    u_swirl: swirl, u_swirlIterations: swirlIterations, u_shape: WarpPatterns[shape],
    u_shapeScale: shapeScale, u_scale: scale, u_rotation: rotation,
    u_fit: 0, u_originX: 0.5, u_originY: 0.5, u_offsetX: 0, u_offsetY: 0, u_worldWidth: 0, u_worldHeight: 0,
  }), [colors, proportion, softness, distortion, swirl, swirlIterations, shape, shapeScale, scale, rotation]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const clear = () => {
      mount.current?.dispose();
      mount.current = null;
      for (const canvas of el.querySelectorAll("canvas")) {
        try {
          canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
        } catch { /* A failed context can also reject cleanup queries. */ }
      }
      el.replaceChildren();
    };
    // Paper's React initializer has no rejection handler. Use its public Warp
    // shader/mount API so image or GPU failures leave the underlying gradient.
    const init = async () => {
      const noise = getShaderNoiseTexture();
      await noise?.decode();
      if (cancelled) return;
      const current = options.current;
      mount.current = new ShaderMount(el, warpFragmentShader, { ...uniforms, u_noiseTexture: noise }, undefined, current.speed, current.frame, current.minPixelRatio, current.maxPixelCount);
    };
    void init().catch(() => { if (!cancelled) clear(); });
    el.addEventListener("webglcontextlost", clear, true);
    return () => {
      cancelled = true;
      el.removeEventListener("webglcontextlost", clear, true);
      clear();
    };
  }, [uniforms]);
  useEffect(() => { mount.current?.setSpeed(speed); }, [speed]);
  useEffect(() => { mount.current?.setFrame(frame); }, [frame]);
  useEffect(() => { mount.current?.setMinPixelRatio(minPixelRatio); }, [minPixelRatio]);
  useEffect(() => { mount.current?.setMaxPixelCount(maxPixelCount); }, [maxPixelCount]);
  return <div ref={ref} style={style} />;
}

import { useEffect, useState, type RefObject } from "react";

export type SurfaceTheme = "auto" | "dark" | "light";
export type ResolvedSurfaceTheme = Exclude<SurfaceTheme, "auto">;

export function observeMediaQuery(query: MediaQueryList, update: () => void) {
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }
  if (typeof query.addListener === "function") {
    query.addListener(update);
    return () => query.removeListener(update);
  }
  return () => {};
}

export function useSurfaceTheme(
  surface: RefObject<HTMLElement | null>,
  theme: SurfaceTheme = "dark",
): ResolvedSurfaceTheme {
  const [detected, setDetected] = useState<ResolvedSurfaceTheme>("dark");

  useEffect(() => {
    if (theme !== "auto" || typeof window === "undefined" || typeof document === "undefined") return;

    const query = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
    const update = () => {
      let element = surface.current;
      while (element) {
        if (element.classList.contains("dark")) return setDetected("dark");
        if (element.classList.contains("light")) return setDetected("light");
        const declared = element.getAttribute("data-theme");
        if (declared === "dark" || declared === "light") return setDetected(declared);
        element = element.parentElement;
      }
      setDetected(query ? (query.matches ? "dark" : "light") : "dark");
    };

    update();
    const unsubscribe = query ? observeMediaQuery(query, update) : () => {};
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(update);
    observer?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
      childList: true,
      subtree: true,
    });
    return () => {
      unsubscribe();
      observer?.disconnect();
    };
  }, [surface, theme]);

  return theme === "auto" ? detected : theme;
}

export default useSurfaceTheme;

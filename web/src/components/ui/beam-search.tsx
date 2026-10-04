import {
  Suspense, forwardRef, lazy, useEffect, useImperativeHandle, useRef, useState,
  type ComponentType, type InputHTMLAttributes, type ReactNode,
} from "react";
import type { BorderBeamColorVariant, BorderBeamProps } from "border-beam";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { observeMediaQuery, useSurfaceTheme, type SurfaceTheme } from "./beam-search-utils/use-surface-theme";

const BorderBeam = lazy<ComponentType<BorderBeamProps>>(() => import("border-beam")
  .then(module => ({ default: module.BorderBeam }))
  .catch(() => ({ default: () => null })),
);

export interface BeamSearchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "onSubmit" | "children"
> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  alwaysOn?: boolean;
  colorVariant?: BorderBeamColorVariant;
  theme?: SurfaceTheme;
  trailing?: ReactNode;
}

function useBeamMotion() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined" || typeof window.matchMedia !== "function") return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    // BorderBeam 1.4.1 calls the modern media-query API even with an explicit theme.
    const supported = [motion, scheme].every(query =>
      typeof query.addEventListener === "function" && typeof query.removeEventListener === "function",
    );
    const update = () => setEnabled(supported && !motion.matches && document.visibilityState !== "hidden");
    update();
    const unsubscribe = observeMediaQuery(motion, update);
    document.addEventListener("visibilitychange", update);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return enabled;
}

export const BeamSearch = forwardRef<HTMLInputElement, BeamSearchProps>(function BeamSearch({
  value,
  defaultValue = "",
  onChange,
  onSubmit,
  placeholder = "Search",
  alwaysOn = false,
  colorVariant = "gold",
  theme = "dark",
  trailing,
  className,
  disabled = false,
  readOnly = false,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  ...inputProps
}, forwardedRef) {
  const inputRef = useRef<HTMLInputElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const currentValue = value ?? internalValue;
  const resolvedTheme = useSurfaceTheme(surfaceRef, theme);
  const motionEnabled = useBeamMotion();
  const highlighted = !disabled && (focused || alwaysOn);
  const animate = highlighted && motionEnabled;
  const canClear = currentValue.length > 0 && !disabled && !readOnly;

  useImperativeHandle(forwardedRef, () => inputRef.current!, []);

  function change(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
  }

  function clear() {
    change("");
    inputRef.current?.focus();
  }

  return (
    <div
      className={cn("beam-search", className)}
      data-beam-theme={resolvedTheme}
      data-color-variant={colorVariant}
      data-focused={!disabled && focused}
      data-highlighted={highlighted}
      data-disabled={disabled}
    >
      <div
        ref={surfaceRef}
        className="beam-search-control"
        onFocus={() => setFocused(true)}
        onBlur={event => {
          composing.current = false;
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
      >
        <Search className="beam-search-icon" aria-hidden="true" size={18} />
        <input
          {...inputProps}
          ref={inputRef}
          type={inputProps.type ?? "text"}
          className="beam-search-input"
          placeholder={placeholder}
          value={currentValue}
          disabled={disabled}
          readOnly={readOnly}
          onChange={event => change(event.currentTarget.value)}
          onCompositionStart={event => {
            composing.current = true;
            onCompositionStart?.(event);
          }}
          onCompositionEnd={event => {
            composing.current = false;
            onCompositionEnd?.(event);
          }}
          onKeyDown={event => {
            onKeyDown?.(event);
            if (event.defaultPrevented) return;
            const isComposing = composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
            if (event.key === "Enter") {
              if (isComposing) event.preventDefault();
              else if (onSubmit) {
                event.preventDefault();
                onSubmit(event.currentTarget.value);
              }
            } else if (event.key === "Escape" && !isComposing && canClear) {
              event.preventDefault();
              clear();
            }
          }}
        />
        <button
          type="button"
          className="beam-search-clear"
          aria-label="Clear search"
          title="Clear search"
          aria-hidden={!canClear || undefined}
          data-visible={canClear}
          disabled={!canClear}
          tabIndex={canClear ? 0 : -1}
          onMouseDown={event => event.preventDefault()}
          onClick={clear}
        >
          <X aria-hidden="true" size={16} />
        </button>
        {trailing != null && <div className="beam-search-trailing">{trailing}</div>}
        {/* Keep the input outside the beam: unmounting decoration bypasses its animationend-dependent fade. */}
        {animate && (
          <Suspense fallback={null}>
            <BorderBeam
              size="line"
              colorVariant={colorVariant}
              theme={resolvedTheme}
              borderRadius={8}
              strength={0.65}
              staticColors={colorVariant === "gold"}
              className="beam-search-beam"
              aria-hidden="true"
            >
              <div className="beam-search-beam-surface" />
            </BorderBeam>
          </Suspense>
        )}
      </div>
    </div>
  );
});

export default BeamSearch;

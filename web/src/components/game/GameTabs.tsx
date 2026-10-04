import * as React from "react";
import { cn } from "@/lib/utils";

export interface GameTab<K extends string> {
  key: K;
  label: React.ReactNode;
  aria?: string;
}

interface Props<K extends string> {
  tabs: GameTab<K>[];
  value: K;
  onChange: (k: K) => void;
  label: string;
  className?: string;
}

/** Gold-bordered tab row (role=tablist). The selected tab glows with ether and a gold underline. */
export function GameTabs<K extends string>({ tabs, value, onChange, label, className }: Props<K>) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === value}
          aria-label={t.aria}
          onClick={() => onChange(t.key)}
          className="game-tab px-3 py-1.5 text-sm font-medium"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WingMark } from "./Ornaments";

interface Props {
  children: ReactNode;
  id?: string;
  /** heading level, default h2 */
  as?: "h1" | "h2" | "h3";
  caption?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** wings on both sides of the title (page headers, hero) vs a left wing only */
  wings?: "both" | "left";
}

/** Serif section heading with wing ornaments and a fading gold rule. Caption sits below, actions to the right. */
export function SectionTitle({ children, id, as: H = "h2", caption, actions, className, wings = "left" }: Props) {
  const size = H === "h1" ? "text-[24px] sm:text-[30px]" : H === "h2" ? "text-xl" : "text-base";
  return (
    <div className={cn("mb-4", className)}>
      <div className="section-title">
        <WingMark />
        <H id={id} className={cn("min-w-0 leading-tight", size)}>
          {children}
        </H>
        {wings === "both" ? <WingMark flip /> : null}
        <span aria-hidden className="rule" />
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {caption && <p className="mt-1.5 text-sm text-dim">{caption}</p>}
    </div>
  );
}

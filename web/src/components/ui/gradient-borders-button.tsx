"use client";

/**
 * Gradient Borders Button - @emerald-ui, MIT, v1.0.0 (2026-02-11).
 * https://emerald-ui.com
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

interface GradientBordersButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export default function GradientBordersButton({
  className,
  children,
  asChild = false,
  type = "button",
  ...props
}: GradientBordersButtonProps) {
  const Comp = asChild ? Slot : "button";
  const child = asChild ? React.Children.only(children) as React.ReactElement<{ children?: React.ReactNode }> : null;
  const content = (
    <>
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full" aria-hidden="true">
        <span className="gradient-borders-button-glow absolute inset-0 rounded-full bg-[radial-gradient(75%_100%_at_50%_0%,rgba(189,56,222,1)_0%,rgba(56,189,248,1)_75%)] opacity-40 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none dark:bg-[radial-gradient(75%_100%_at_50%_0%,rgba(189,56,222,0.8)_0%,rgba(56,189,248,0.4)_75%)] dark:opacity-0" />
      </span>
      <span className="gradient-borders-button-content relative z-10 flex h-8 items-center justify-center rounded-full bg-slate-100 px-4 text-black/80 ring-2 ring-white/10 dark:bg-slate-950 dark:text-white/80">
        <span className="inline-flex items-center gap-2">{child ? child.props.children : children ?? "Gradient Borders"}</span>
      </span>
      <span className="gradient-borders-button-line pointer-events-none absolute bottom-0 left-4.5 h-px w-[calc(100%-2.25rem)] bg-linear-to-r from-emerald-400/0 via-emerald-400/90 to-emerald-400/0 transition-opacity duration-500 group-hover:opacity-40 group-focus-visible:opacity-40 motion-reduce:transition-none" aria-hidden="true" />
    </>
  );

  return (
    <Comp
      className={cn(
        "gradient-borders-button group relative inline-block cursor-pointer rounded-full border-none bg-slate-100 p-0.5 text-xs leading-6 font-semibold text-white no-underline outline-none focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:focus-visible:ring-slate-400 dark:focus-visible:ring-offset-slate-950",
        className,
      )}
      type={asChild ? undefined : type}
      {...props}
    >
      {child ? React.cloneElement(child, undefined, content) : content}
    </Comp>
  );
}

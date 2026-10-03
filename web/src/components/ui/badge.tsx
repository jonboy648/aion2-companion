import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    tone: {
      neutral: "border-border bg-surface2 text-dim",
      gold: "border-gold-lo bg-gold/10 text-gold",
      info: "border-cyan/40 bg-cyan/10 text-cyan",
      ok: "border-ok/40 bg-ok/10 text-ok",
      warn: "border-warn/40 bg-warn/10 text-warn",
      error: "border-error/40 bg-error/10 text-error",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

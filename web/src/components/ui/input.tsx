import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground placeholder:text-faint outline-none focus-visible:border-gold disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

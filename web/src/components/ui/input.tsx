import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "game-input h-9 w-full min-w-0 px-3 text-sm text-foreground placeholder:text-faint disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

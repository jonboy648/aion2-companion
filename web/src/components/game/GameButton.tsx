import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva("game-btn", {
  variants: {
    variant: { default: "", primary: "", secondary: "", ghost: "", destructive: "" },
    size: { default: "h-9 px-4", sm: "h-8 px-3 text-[13px]", lg: "h-11 px-6 text-base", icon: "size-9" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export interface GameButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/** Gold-bordered game button with a pressed state. default/primary = gold metal, secondary = dark bronze-rimmed. */
export function GameButton({ className, variant, size, asChild = false, ...props }: GameButtonProps) {
  const Comp = asChild ? Slot : "button";
  const v = !variant || variant === "default" ? "primary" : variant;
  return <Comp data-variant={v} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

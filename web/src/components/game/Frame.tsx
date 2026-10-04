import * as React from "react";
import { cn } from "@/lib/utils";

/** Quiet double-line bronze frame without corners, for dense rows and list items. */
export function Frame({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("frame", className)} {...props} />;
}

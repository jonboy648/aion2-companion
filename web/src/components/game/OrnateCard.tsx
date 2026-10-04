import * as React from "react";
import { cn } from "@/lib/utils";

interface Props extends React.ComponentProps<"div"> {
  /** corner size: sm 18px, md 26px (default), lg 34px */
  size?: "sm" | "md" | "lg";
  hover?: boolean;
}

/** Card with textured surface, bronze frame and gold filigree corners (CSS `.ornate`, corners are our own SVG). */
export function OrnateCard({ className, size = "md", hover, ...props }: Props) {
  return <div className={cn("ornate text-card-foreground", size === "sm" && "ornate-sm", size === "lg" && "ornate-lg", hover && "ornate-hover", className)} {...props} />;
}

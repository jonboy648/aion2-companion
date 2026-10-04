import { useState } from "react";
import { cn } from "@/lib/utils";

export function BrandCrest({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? "/brand/cube-crest.webp" : "/brand/cube-crest-prismatic.png"}
      alt=""
      aria-hidden="true"
      width={42}
      height={42}
      decoding="async"
      className={cn("brand-crest", className)}
      onError={() => setFailed(true)}
    />
  );
}

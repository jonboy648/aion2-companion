import { useEffect, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { FeatureShaderCard } from "./feature-shader-cards";
import { Link } from "react-router-dom";
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import "./logo-cloud-2.css";

type Logo = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  srcSet?: string;
  sizes?: string;
  objectPosition?: CSSProperties["objectPosition"];
};

export interface LogoCloudItem {
  id: string;
  title: string;
  href: string;
  logo: Logo;
  fallback?: ReactNode;
}

type LogoCloudProps = ComponentProps<"div"> & {
  items: readonly LogoCloudItem[];
  loading?: boolean;
  shaderCaptions?: boolean;
};

const cellStyles = [
  "border-r border-b bg-secondary dark:bg-secondary/30",
  "border-b md:border-r",
  "border-r border-b md:bg-secondary dark:md:bg-secondary/30",
  "border-b bg-secondary md:bg-background dark:bg-secondary/30 md:dark:bg-background",
  "border-r border-b bg-secondary md:border-b-0 md:bg-background dark:bg-secondary/30 md:dark:bg-background",
  "border-b bg-background md:border-r md:border-b-0 md:bg-secondary dark:md:bg-secondary/30",
  "border-r",
  "bg-secondary dark:bg-secondary/30",
];

/** The supplied LogoCloud divider layout, with class art in contained portrait windows. */
export function LogoCloud({ items, loading = false, shaderCaptions = false, className, ...props }: LogoCloudProps) {
  const [graphics, setGraphics] = useState({ enabled: false, animated: false, compact: true });
  useEffect(() => {
    if (!shaderCaptions || typeof window.matchMedia !== "function") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 639px)");
    const update = () => setGraphics({ enabled: !document.hidden, animated: !reduced.matches && !document.hidden, compact: compact.matches });
    update();
    reduced.addEventListener("change", update);
    compact.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      reduced.removeEventListener("change", update);
      compact.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [shaderCaptions]);
  return (
    <div className={cn("logo-cloud-2 relative grid grid-cols-2 border-x md:grid-cols-4", className)} role="list" aria-busy={loading} {...props}>
      <div className="logo-cloud-line pointer-events-none absolute -top-px left-1/2 w-screen -translate-x-1/2 border-t" aria-hidden="true" />
      {loading && items.length === 0 && Array.from({ length: 8 }, (_, index) => (
        <div key={index} className={cn("logo-cloud-cell logo-cloud-placeholder", cellStyles[index])} aria-hidden="true" />
      ))}
      {items.map((item, index) => <LogoCard key={item.id} item={item} index={index} shaderCaptions={shaderCaptions} graphics={graphics} />)}
      <div className="logo-cloud-line pointer-events-none absolute -bottom-px left-1/2 w-screen -translate-x-1/2 border-b" aria-hidden="true" />
    </div>
  );
}

function LogoCard({ item, index, shaderCaptions, graphics }: { item: LogoCloudItem; index: number; shaderCaptions: boolean; graphics: { enabled: boolean; animated: boolean; compact: boolean } }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { logo } = item;
  const failed = failedSrc === logo.src;
  return (
    <div className={cn("logo-cloud-cell relative bg-background", cellStyles[index % cellStyles.length])} role="listitem">
      <Link to={item.href} className="logo-cloud-link" aria-label={item.title}>
        {shaderCaptions && <FeatureShaderCard index={index} enabled={graphics.enabled && index < (graphics.compact ? 2 : 8)} animated={graphics.animated} compact className="class-portrait-shader">{null}</FeatureShaderCard>}
        <span className="logo-cloud-media">
          {failed ? (
            <span className="logo-cloud-fallback" aria-hidden="true">{item.fallback}</span>
          ) : (
            <img
              alt={logo.alt}
              className="logo-cloud-image pointer-events-none select-none"
              width={logo.width ?? 640}
              height={logo.height ?? 640}
              src={logo.src}
              srcSet={logo.srcSet}
              sizes={logo.sizes}
              style={{ objectPosition: logo.objectPosition }}
              loading="lazy"
              decoding="async"
              onError={() => setFailedSrc(logo.src)}
            />
          )}
        </span>
        <span className="logo-cloud-caption">
          <span className="logo-cloud-title">{item.title}</span>
        </span>
      </Link>
      {(index === 0 || index === 2 || index === 4) && (
        <PlusIcon className={cn("logo-cloud-intersection pointer-events-none absolute -right-[12.5px] -bottom-[12.5px] z-10 size-6", index === 4 && "md:hidden")} strokeWidth={1} aria-hidden="true" />
      )}
      {index === 2 && (
        <PlusIcon className="logo-cloud-intersection pointer-events-none absolute -bottom-[12.5px] -left-[12.5px] z-10 hidden size-6 md:block" strokeWidth={1} aria-hidden="true" />
      )}
    </div>
  );
}

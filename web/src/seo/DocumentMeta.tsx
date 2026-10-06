import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { resolveKey } from "@/features/items/logic";
import seo from "./routes.json";

export interface PageMeta {
  title: string;
  description: string;
  /** keep this page out of search results */
  noindex: boolean;
  canonicalPath: string;
}

const BY_PATH = new Map(seo.routes.map((r) => [r.path, r]));
const HOME = seo.routes[0];

/**
 * Title, description and canonical for a path. Fixed pages are indexable. Endless or personal URLs (a character, a compare
 * link with characters in it, the owner dashboard) and unknown paths are not; they get a generic title.
 */
export function metaFor(pathname: string): PageMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const known = BY_PATH.get(path);
  if (known) return { title: known.title, description: known.description, noindex: false, canonicalPath: known.path };
  // /items/<group | category | id>: prerendered folder pages, indexable; the page sets the precise title once it knows the item
  const items = BY_PATH.get("/items");
  if (items && /^\/items\/[a-z0-9-]+$/.test(path) && resolveKey(path.slice(7)).kind !== "unknown") return { title: items.title, description: items.description, noindex: false, canonicalPath: path };
  if (/^\/c\/[^/]+\/[^/]+\/[^/]+$/.test(path)) {
    return { title: `Aion 2 character build | ${seo.site.name}`, description: HOME.description, noindex: true, canonicalPath: path };
  }
  const compare = BY_PATH.get("/compare");
  if (compare && path.startsWith("/compare/")) return { title: compare.title, description: compare.description, noindex: true, canonicalPath: "/compare" };
  return { title: HOME.title, description: HOME.description, noindex: true, canonicalPath: path };
}

function setMeta(selector: string, make: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = make();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

const meta = (key: "name" | "property", id: string) => () => {
  const m = document.createElement("meta");
  m.setAttribute(key, id);
  return m;
};

/** Keeps <title>, description, canonical, Open Graph and robots in step with the route (client-side navigation). */
export function DocumentMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const m = metaFor(pathname);
    // GitHub Pages serves each fixed page as a folder, at its trailing-slash URL; the canonical must be that URL
    const folder = BY_PATH.has(m.canonicalPath) || m.canonicalPath.startsWith("/items/");
    const url = `${seo.site.url}${m.canonicalPath === "/" || !folder ? m.canonicalPath : `${m.canonicalPath}/`}`;
    document.title = m.title;
    setMeta('meta[name="description"]', meta("name", "description"), "content", m.description);
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", url);
    setMeta('meta[property="og:title"]', meta("property", "og:title"), "content", m.title);
    setMeta('meta[property="og:description"]', meta("property", "og:description"), "content", m.description);
    setMeta('meta[property="og:url"]', meta("property", "og:url"), "content", url);
    setMeta('meta[name="twitter:title"]', meta("name", "twitter:title"), "content", m.title);
    setMeta('meta[name="twitter:description"]', meta("name", "twitter:description"), "content", m.description);
    const robots = document.head.querySelector('meta[name="robots"]');
    if (m.noindex) setMeta('meta[name="robots"]', meta("name", "robots"), "content", "noindex");
    else robots?.remove();
  }, [pathname]);
  return null;
}

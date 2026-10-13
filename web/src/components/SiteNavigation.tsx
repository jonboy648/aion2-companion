import { useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { GlobalSearch } from "@/features/search/GlobalSearch";
import { isNavigationItemCurrent, NAVIGATION_GROUPS } from "./navigation";
import { NavigationLink } from "./NavigationLink";
import "./site-navigation.css";

export function SiteNavigation() {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const id = useId();
  const navigation = useRef<HTMLElement>(null);
  const mobileToggle = useRef<HTMLButtonElement>(null);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const panels = useRef<Record<string, HTMLDivElement | null>>({});
  const focusLast = useRef(false);
  const { pathname, search, key: locationKey } = useLocation();

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [locationKey]);

  useEffect(() => {
    if (!openGroup && !mobileOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !navigation.current?.contains(event.target)) {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [openGroup, mobileOpen]);

  useEffect(() => {
    if (!openGroup) return;
    const links = panels.current[openGroup]?.querySelectorAll<HTMLAnchorElement>("a[href]");
    links?.[focusLast.current ? links.length - 1 : 0]?.focus();
  }, [openGroup]);

  useEffect(() => {
    if (mobileOpen) triggers.current[NAVIGATION_GROUPS[0].label]?.focus();
  }, [mobileOpen]);

  return (
    <nav
      ref={navigation}
      aria-label="Main"
      className="site-navigation"
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
          setOpenGroup(null);
          setMobileOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || (!openGroup && !mobileOpen)) return;
        event.preventDefault();
        event.stopPropagation();
        if (mobileOpen) mobileToggle.current?.focus();
        else if (openGroup) triggers.current[openGroup]?.focus();
        setOpenGroup(null);
        setMobileOpen(false);
      }}
    >
      <NavLink to="/" end className="site-nav-primary">Home</NavLink>
      <NavLink to="/guide" className="site-nav-primary">Start here</NavLink>
      <div id={`${id}-groups`} className="site-nav-groups" data-mobile-open={mobileOpen}>
      {NAVIGATION_GROUPS.map((group) => (
        <div
          key={group.label}
          className="site-nav-group"
          onBlur={(event) => {
            if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
              setOpenGroup((current) => current === group.label ? null : current);
            }
          }}
        >
          <button
            ref={(element) => { triggers.current[group.label] = element; }}
            type="button"
            className="site-nav-trigger"
            data-active={group.items.some((item) => isNavigationItemCurrent(item, pathname, search))}
            aria-expanded={openGroup === group.label}
            aria-controls={`${id}-${group.label}`}
            onClick={() => {
              focusLast.current = false;
              setOpenGroup(openGroup === group.label ? null : group.label);
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              focusLast.current = event.key === "ArrowUp";
              setOpenGroup(group.label);
            }}
          >
            {group.label}<ChevronDown size={14} aria-hidden />
          </button>
          {openGroup === group.label && (
            <div
              ref={(element) => { panels.current[group.label] = element; }}
              id={`${id}-${group.label}`}
              role="group"
              aria-label={`${group.label} tools`}
              className="site-nav-dropdown"
              onKeyDown={(event) => {
                const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[href]"));
                const index = links.indexOf(document.activeElement as HTMLAnchorElement);
                let next: number;
                if (event.key === "ArrowDown") next = (index + 1) % links.length;
                else if (event.key === "ArrowUp") next = (index - 1 + links.length) % links.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = links.length - 1;
                else return;
                event.preventDefault();
                links[next]?.focus();
              }}
            >
              {group.items.map((item) => (
                <NavigationLink key={item.to} item={item} onClick={() => { setOpenGroup(null); setMobileOpen(false); }} />
              ))}
            </div>
          )}
        </div>
      ))}
      </div>
      <GlobalSearch />
      <button
        ref={mobileToggle}
        type="button"
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        title={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen}
        aria-controls={`${id}-groups`}
        className="site-nav-mobile-toggle"
        onClick={() => { setMobileOpen(!mobileOpen); setOpenGroup(null); }}
      >
        {mobileOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
      </button>
    </nav>
  );
}

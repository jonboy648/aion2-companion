import { codexSection } from "@/features/codex/view";

export interface NavigationItem {
  label: string;
  to: string;
  reloadDocument?: boolean;
}

export function isNavigationItemCurrent(item: NavigationItem, pathname: string, search: string) {
  const target = new URL(item.to, "https://becomecube.com");
  const currentPath = pathname.replace(/\/$/, "") || "/";
  const targetPath = target.pathname.replace(/\/$/, "") || "/";
  if (currentPath !== targetPath && !currentPath.startsWith(`${targetPath}/`)) return false;
  if (targetPath === "/codex") {
    return codexSection(new URLSearchParams(search)) === codexSection(target.searchParams);
  }
  return true;
}

export const NAVIGATION_GROUPS: { label: string; items: NavigationItem[] }[] = [
  {
    label: "Plan",
    items: [
      { label: "Class guides", to: "/codex" },
      { label: "Build planner", to: "/build" },
      { label: "Daevanion", to: "/daevanion" },
      { label: "Compare characters", to: "/compare" },
      { label: "Quickslots and macros", to: "/keybinds" },
      { label: "Enhancement calculator", to: "/enhance" },
    ],
  },
  {
    label: "Database",
    items: [
      { label: "Skill encyclopedia", to: "/codex?view=skills" },
      { label: "Items", to: "/items" },
      { label: "Compare equipment", to: "/gear-viewer" },
      { label: "Crafting", to: "/crafting" },
      { label: "Progression road map", to: "/roadmap" },
    ],
  },
  {
    label: "World",
    items: [
      { label: "Map", to: "/map/", reloadDocument: true },
      { label: "Timers", to: "/timers" },
      { label: "Daily and weekly checklist", to: "/checklist" },
    ],
  },
];

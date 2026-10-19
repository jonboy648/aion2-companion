import type { MouseEventHandler } from "react";
import { Link, useLocation } from "react-router-dom";
import { isNavigationItemCurrent, type NavigationItem } from "./navigation";

export function NavigationLink({ item, onClick }: { item: NavigationItem; onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  const { pathname, search } = useLocation();
  return (
    <Link
      to={item.to}
      reloadDocument={item.reloadDocument}
      aria-current={isNavigationItemCurrent(item, pathname, search) ? "page" : undefined}
      onClick={onClick}
    >
      {item.label}
    </Link>
  );
}

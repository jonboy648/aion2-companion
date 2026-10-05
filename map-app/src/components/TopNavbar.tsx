import { useState } from "react";
import { Link } from "@tanstack/react-router";
import ThemeDropdown from "@/components/ThemeDropdown";
import "./become-cube-header.css";

export default function TopNavbar() {
  const [themeOpen, setThemeOpen] = useState(false);
  return (
    <header className="cube-map-header">
      <a href="/" className="cube-map-brand">
        <img src="/brand/cube-crest-prismatic.png" width="36" height="36" alt="" />
        <span>Become Cube</span>
      </a>
      <nav aria-label="Map navigation">
        <Link to="/" activeOptions={{ exact: true }} activeProps={{ "aria-current": "page" }}>Map</Link>
        <Link to="/crafting/" activeProps={{ "aria-current": "page" }}>Crafting</Link>
        <Link to="/about/" activeProps={{ "aria-current": "page" }}>About & credits</Link>
      </nav>
      <ThemeDropdown isOpen={themeOpen} onOpenChange={setThemeOpen} />
    </header>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import GradientBordersButton from "@/components/ui/gradient-borders-button";
import "./ruixen-moon-chat.css";

export const HOME_SCENES = [
  { src: "/brand/scenes/moonlit-city.png", name: "Moonlit Sky City" },
  { src: "/brand/scenes/celestial-cathedral.png", name: "Celestial Cathedral" },
  { src: "/brand/scenes/emerald-gorge.png", name: "Emerald Gorge" },
  { src: "/brand/scenes/crimson-eclipse.png", name: "Crimson Eclipse" },
] as const;

export interface MoonQuickAction {
  label: string;
  href: string;
  icon: ReactNode;
  featured?: boolean;
}

interface RuixenMoonChatProps {
  title: string;
  description: string;
  children: ReactNode;
  actions: readonly MoonQuickAction[];
  recent?: ReactNode;
}

/** The supplied Moon Chat composition, with the real search supplied by its caller. */
export default function RuixenMoonChat({ title, description, children, actions, recent }: RuixenMoonChatProps) {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set());
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setMotionAllowed(!preference.matches);
    const syncVisibility = () => setVisible(!document.hidden);
    syncMotion(); syncVisibility();
    preference.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      preference.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);
  useEffect(() => {
    if (paused || !motionAllowed || !visible) return;
    const timer = window.setInterval(() => setScene(current => (current + 1) % HOME_SCENES.length), 14000);
    return () => window.clearInterval(timer);
  }, [paused, motionAllowed, visible]);
  return (
    <section className="original-home-artwork moon-home" aria-label="Character lookup" data-motion={motionAllowed && !paused && visible ? "running" : "paused"}>
      <div className="original-home-scene" aria-hidden="true">
        <img src="/brand/sky-citadel.png" alt="" width={1176} height={469} decoding="async" className="home-scene-fallback" />
        {HOME_SCENES.map((image, index) => (
          <img key={image.src} src={image.src} alt="" width={1672} height={941}
            fetchPriority={index === 0 ? "high" : "low"} decoding="async"
            className="home-rotating-scene" data-active={index === scene && loaded.has(index) && !failed.has(index)}
            onLoad={() => setLoaded(previous => new Set(previous).add(index))}
            onError={() => setFailed(previous => new Set(previous).add(index))} />
        ))}
      </div>
      <div className="moon-home-content">
        <h1>{title}</h1>
        <p className="moon-home-description">{description}</p>
        <div className="moon-home-search">{children}</div>
        <nav className="moon-quick-actions" aria-label="Quick actions">
          {actions.map(action => action.featured ? (
            <GradientBordersButton key={action.href} asChild className="moon-start-action">
              <Link to={action.href}>
                <span aria-hidden="true">{action.icon}</span>
                <span>{action.label}</span>
              </Link>
            </GradientBordersButton>
          ) : (
            <Button key={action.href} asChild variant="secondary" className="moon-quick-action">
              <Link to={action.href}>
                <span aria-hidden="true">{action.icon}</span>
                <span>{action.label}</span>
              </Link>
            </Button>
          ))}
        </nav>
        {recent && <div className="moon-home-recent">{recent}</div>}
      </div>
      <div className="home-scene-controls" aria-label="Background scenery">
        <span>{HOME_SCENES[scene].name}</span>
        <div role="group" aria-label="Choose scenery">
          {HOME_SCENES.map((image, index) => <button key={image.src} type="button" aria-label={image.name} aria-pressed={scene === index} title={image.name} onClick={() => { setScene(index); setPaused(true); }} />)}
        </div>
        <button type="button" aria-label={paused || !motionAllowed ? "Play background rotation" : "Pause background rotation"}
          title={paused || !motionAllowed ? "Play background rotation" : "Pause background rotation"}
          disabled={!motionAllowed} onClick={() => setPaused(value => !value)}>
          {paused || !motionAllowed ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
        </button>
      </div>
    </section>
  );
}

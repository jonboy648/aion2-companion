"use client";

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import GradientBordersButton from "@/components/ui/gradient-borders-button";
import "./ruixen-moon-chat.css";

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
  return (
    <section className="original-home-artwork moon-home" aria-label="Character lookup">
      <div className="original-home-scene" aria-hidden="true">
        <img src="/brand/sky-citadel.png" alt="" width={1176} height={469} fetchPriority="high" decoding="async" />
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
    </section>
  );
}

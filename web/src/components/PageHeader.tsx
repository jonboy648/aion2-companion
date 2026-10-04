import type { ReactNode } from "react";
import { SectionTitle } from "@/components/game/SectionTitle";

export function PageHeader({ title, caption, children }: { title: string; caption?: string; children?: ReactNode }) {
  return (
    <SectionTitle as="h1" caption={caption} actions={children} className="mb-6">
      {title}
    </SectionTitle>
  );
}

export function Stub({ wave = "Wave 1", children }: { wave?: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-dim">
      <p>This page is scaffolded; the real UI lands in {wave}.</p>
      {children}
    </div>
  );
}

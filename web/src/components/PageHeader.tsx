import type { ReactNode } from "react";

export function PageHeader({ title, caption, children }: { title: string; caption?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-l-4 border-gold pl-3">
      <div>
        <h1 className="text-[26px] font-semibold leading-tight">{title}</h1>
        {caption && <p className="mt-1 text-sm text-dim">{caption}</p>}
      </div>
      {children}
    </div>
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

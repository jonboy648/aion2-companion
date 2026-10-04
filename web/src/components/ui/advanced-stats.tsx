"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./advanced-stats.css";

// Layout adapted from UI Layouts' MIT Advanced Stats component on 21st.dev.
export interface DashboardMetric {
  key: string;
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}

export interface AdvancedStatsProps {
  main: ReactNode;
  supporting?: ReactNode;
  metrics?: readonly DashboardMetric[];
  className?: string;
}

export default function AdvancedStats({ main, supporting, metrics = [], className }: AdvancedStatsProps) {
  return (
    <div className={cn("dashboard-page", className)}>
      <div className={cn("dashboard-layout", supporting != null && "dashboard-layout-with-rail")}>
        <section aria-label="Main workspace" className="dashboard-workspace">{main}</section>
        {supporting != null && <aside aria-label="Supporting controls" className="dashboard-rail">{supporting}</aside>}
      </div>
      {metrics.length > 0 && (
        <ul aria-label="Summary metrics" className="dashboard-metrics">
          {metrics.map(metric => (
            <li key={metric.key} className="dashboard-metric">
              <div className="dashboard-metric-label">
                {metric.icon && <span aria-hidden>{metric.icon}</span>}
                {metric.label}
              </div>
              <div className="dashboard-metric-value">{metric.value}</div>
              {metric.hint && <div className="dashboard-metric-hint">{metric.hint}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

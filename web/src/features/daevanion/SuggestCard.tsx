import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DaevanionSuggestion } from "@/lib/types";

interface Props {
  points: number;
  onPoints: (n: number) => void;
  running: boolean;
  error: string | null;
  suggestion: DaevanionSuggestion | null;
  onRun: () => void;
  onApply: () => void;
  onClear: () => void;
}

/** "Max power path": asks the engine for the best next nodes for a point budget. */
export function SuggestCard({ points, onPoints, running, error, suggestion, onRun, onApply, onClear }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Max power path</CardTitle>
        <p className="text-xs text-dim">Best next nodes by estimated DPS per point, from what you have picked.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-dim">
            Points to spend
            <Input
              type="number"
              min={1}
              max={200}
              value={points}
              onChange={(e) => onPoints(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="w-24"
            />
          </label>
          <Button onClick={onRun} disabled={running}>
            {running ? "Searching..." : "Suggest"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        {suggestion && (
          <div className="space-y-2" data-testid="suggestion">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="gold">{suggestion.spent} pt</Badge>
              <Badge tone="ok">~+{suggestion.gain_pct.toFixed(1)}% DPS</Badge>
            </div>
            <ol className="max-h-56 list-decimal space-y-0.5 overflow-auto pl-5 text-sm">
              {suggestion.nodes.map((n) => (
                <li key={n.id}>
                  <span>{n.name}</span> <span className="text-faint">({n.board}, {n.cost} pt)</span>
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              <Button size="sm" onClick={onApply}>
                Apply path
              </Button>
              <Button size="sm" variant="ghost" onClick={onClear}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

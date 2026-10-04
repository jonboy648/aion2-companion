import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/** Just enough Markdown for the setup sheet (headings, tables, lists, paragraphs, **bold**, `code`). No HTML is ever injected. */
export type Block =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,3}) (.*)$/.exec(line);
    if (h) {
      out.push({ type: "h", level: h[1].length as 1 | 2 | 3, text: h[2].trim() });
      i++;
      continue;
    }
    if (line.trim().startsWith("|") && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      out.push({ type: "table", head, rows });
      continue;
    }
    if (/^- /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2).trim());
      out.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, "").trim());
      out.push({ type: "ol", items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3} |- |\d+\. |\|)/.test(lines[i])) para.push(lines[i++].trim());
    out.push({ type: "p", text: para.join(" ") });
  }
  return out;
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1)
      return (
        <code key={i} className="rounded bg-surface3 px-1 py-0.5 text-[0.85em] text-gold-hi">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    return part;
  });
}

function cell(text: string): ReactNode {
  if (text === "lowest_known") return <Badge tone="ok">lowest known</Badge>;
  if (text === "caution") return <Badge tone="warn">caution</Badge>;
  return inline(text);
}

export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-dim">
      {parseMarkdown(source).map((b, i) => {
        switch (b.type) {
          case "h":
            if (b.level === 1) return null; // the page supplies the title
            return b.level === 2 ? (
              <h3 key={i} className="mt-5 border-b border-[var(--metal-lo)] pb-1 text-[17px] font-bold text-gold first:mt-0">
                {inline(b.text)}
              </h3>
            ) : (
              <h4 key={i} className="mt-4 text-sm font-semibold text-gold">
                {inline(b.text)}
              </h4>
            );
          case "p":
            return <p key={i}>{inline(b.text)}</p>;
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5 marker:text-gold-lo">
                {b.items.map((t, j) => (
                  <li key={j}>{inline(t)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-gold-lo">
                {b.items.map((t, j) => (
                  <li key={j}>{inline(t)}</li>
                ))}
              </ol>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-md border border-border-soft">
                <table className="w-full min-w-max border-collapse text-left text-[13px]">
                  <thead className="bg-surface2 text-xs uppercase tracking-wide text-faint">
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-t border-border-soft odd:bg-surface/40">
                        {r.map((c, k) => (
                          <td key={k} className="px-3 py-1.5 align-top">
                            {cell(c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}

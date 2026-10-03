import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "./markdown";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadText(filename: string, text: string, mime = "text/markdown"): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SetupSheet({ markdown, filename }: { markdown: string; filename: string }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const onCopy = async () => {
    setCopied((await copyText(markdown)) ? "ok" : "fail");
    setTimeout(() => setCopied("idle"), 2000);
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={onCopy} variant="secondary" size="sm">
          {copied === "ok" ? <Check /> : <Copy />}
          {copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed, select the text" : "Copy sheet"}
        </Button>
        <Button onClick={() => downloadText(filename, markdown)} variant="secondary" size="sm">
          <Download /> Download .md
        </Button>
        <span className="text-xs text-faint">Nothing here is sent to the game. You enter it once, by hand.</span>
      </div>
      <Markdown source={markdown} />
    </div>
  );
}

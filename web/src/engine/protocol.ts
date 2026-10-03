/** Message shapes between pyodide-client.ts (main thread) and worker.ts (module Web Worker). */

/** api.ts function name -> aion2c.webapi function name. */
export const PY_NAME = {
  listClasses: "list_classes",
  gamedata: "gamedata",
  importCharacter: "import_character",
  compare: "compare",
  optimize: "optimize",
  marginal: "marginal",
  keybinds: "keybinds",
  daevanionSuggest: "daevanion_suggest",
  shopping: "shopping",
  roadmap: "roadmap",
  iconUrls: "icon_urls",
} as const;

export type Method = keyof typeof PY_NAME;

/** Methods that report progress (the trailing JS callback is wired to webapi's `progress=`). */
export const PROGRESS_METHODS: ReadonlySet<Method> = new Set<Method>(["compare", "optimize"]);

export interface InitConfig {
  /** Site base, e.g. "/" (import.meta.env.BASE_URL). Engine files live at `${base}engine/...`. */
  base: string;
  pyodideUrl: string;
}

export type ToWorker = { id: number; method: Method; args: unknown[]; config: InitConfig };

export type FromWorker =
  | { id: number; type: "progress"; message: string }
  | { id: number; type: "result"; json: string }
  | { id: number; type: "error"; message: string; pyType?: string };

/** Which class's game data a call needs loaded first (null = none). */
export function classKeyFor(method: Method, args: unknown[]): string | null {
  switch (method) {
    case "gamedata":
    case "shopping":
    case "roadmap":
    case "iconUrls":
      return typeof args[0] === "string" ? args[0] : null;
    case "compare":
    case "optimize":
    case "marginal":
    case "keybinds":
    case "daevanionSuggest": {
      const b = args[0] as { class_key?: string } | null | undefined;
      return b?.class_key ?? null;
    }
    default:
      return null;
  }
}

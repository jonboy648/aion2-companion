export function codexSection(params: URLSearchParams): "guide" | "skills" {
  return params.has("skill") || params.get("view") === "skills" ? "skills" : "guide";
}

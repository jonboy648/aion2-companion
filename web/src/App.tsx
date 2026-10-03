import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { BuildPage } from "@/pages/BuildPage";
import { CharacterPage } from "@/pages/CharacterPage";
import { CodexPage } from "@/pages/CodexPage";
import { CraftingPage } from "@/pages/CraftingPage";
import { DaevanionPage } from "@/pages/DaevanionPage";
import { HomePage } from "@/pages/HomePage";
import { KeybindsPage } from "@/pages/KeybindsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RoadmapPage } from "@/pages/RoadmapPage";

/** Route table. Each page group is owned by one Wave 1 team; keep paths stable (they are shareable links). */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="c/:region/:serverId/:name" element={<CharacterPage />} />
        <Route path="build" element={<BuildPage />} />
        <Route path="daevanion" element={<DaevanionPage />} />
        <Route path="codex/:classKey?" element={<CodexPage />} />
        <Route path="keybinds" element={<KeybindsPage />} />
        <Route path="crafting" element={<CraftingPage />} />
        <Route path="roadmap" element={<RoadmapPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

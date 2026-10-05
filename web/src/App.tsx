import { Route, Routes } from "react-router-dom";
import { DocumentMeta } from "@/seo/DocumentMeta";
import { Layout } from "@/components/Layout";
import { AdminPage } from "@/pages/AdminPage";
import { Board } from "@/pages/Board";
import { Maps } from "@/pages/Maps";
import { BuildPage } from "@/pages/BuildPage";
import { CharacterPage } from "@/pages/CharacterPage";
import { CodexPage } from "@/pages/CodexPage";
import { Compare as ComparePage } from "@/pages/Compare";
import { CraftingPage } from "@/pages/CraftingPage";
import { DaevanionPage } from "@/pages/DaevanionPage";
import { GuidePage } from "@/pages/GuidePage";
import { HomePage } from "@/pages/HomePage";
import { KeybindsPage } from "@/pages/KeybindsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RoadmapPage } from "@/pages/RoadmapPage";
import { TimersPage } from "@/pages/Timers";
import { ServerStatusPage } from "@/pages/ServerStatus";

/** Route table. Each page group is owned by one Wave 1 team; keep paths stable (they are shareable links). */
export default function App() {
  return (
    <>
      <DocumentMeta />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="c/:region/:serverId/:name" element={<CharacterPage />} />
          <Route path="board" element={<Board />} />
          <Route path="maps" element={<Maps />} />
          <Route path="timers" element={<TimersPage />} />
          <Route path="server-status" element={<ServerStatusPage />} />
          <Route path="compare/:a?/:b?" element={<ComparePage />} />
          <Route path="guide" element={<GuidePage />} />
          <Route path="build" element={<BuildPage />} />
          <Route path="daevanion" element={<DaevanionPage />} />
          <Route path="codex/:classKey?" element={<CodexPage />} />
          <Route path="keybinds" element={<KeybindsPage />} />
          <Route path="crafting" element={<CraftingPage />} />
          <Route path="roadmap" element={<RoadmapPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}

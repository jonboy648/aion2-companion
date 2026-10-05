import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { BookOpen, Compass } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodexView } from "@/features/codex/CodexView";
import { ManualBuild } from "./ManualBuild";

export function CodexPage() {
  const { classKey = "sorcerer" } = useParams();
  const [params] = useSearchParams();
  const [view, setView] = useState(params.has("skill") ? "skills" : "guide");
  useEffect(() => {
    if (params.has("skill")) setView("skills");
  }, [params]);
  return (
    <>
      <PageHeader title="Codex" caption="Class guides, skills, stigmas and rank tables." />
      <Tabs value={view} onValueChange={setView}>
        <TabsList aria-label="Codex sections" className="mb-5">
          <TabsTrigger value="guide" className="inline-flex items-center gap-2"><Compass size={17} aria-hidden /> Class guide</TabsTrigger>
          <TabsTrigger value="skills" className="inline-flex items-center gap-2"><BookOpen size={17} aria-hidden /> Skill encyclopedia</TabsTrigger>
        </TabsList>
        <TabsContent value="guide" forceMount hidden={view !== "guide"}><ManualBuild key={classKey} guideClass={classKey} /></TabsContent>
        <TabsContent value="skills"><CodexView classKey={classKey} /></TabsContent>
      </Tabs>
    </>
  );
}

export default CodexPage;

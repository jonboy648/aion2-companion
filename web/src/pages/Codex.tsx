import { useParams, useSearchParams } from "react-router-dom";
import { BookOpen, Compass } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodexView } from "@/features/codex/CodexView";
import { codexSection } from "@/features/codex/view";
import { ManualBuild } from "./ManualBuild";

export function CodexPage() {
  const { classKey = "sorcerer" } = useParams();
  const [params, setParams] = useSearchParams();
  const view = codexSection(params);
  function setView(next: string) {
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (next === "skills") updated.set("view", "skills");
      else {
        updated.delete("view");
        updated.delete("skill");
      }
      return updated;
    });
  }
  return (
    <>
      {view === "skills" && <PageHeader title="Skill encyclopedia" caption="Skills, stigmas, specialties and rank tables by class." />}
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

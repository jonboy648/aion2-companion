import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { CodexView } from "@/features/codex/CodexView";

export function CodexPage() {
  const { classKey = "sorcerer" } = useParams();
  return (
    <>
      <PageHeader title="Codex" caption="Every skill, stigma and rank table for each class." />
      <CodexView classKey={classKey} />
    </>
  );
}

export default CodexPage;

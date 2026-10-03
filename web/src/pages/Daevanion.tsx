import { PageHeader } from "@/components/PageHeader";
import { DaevanionView } from "@/features/daevanion/DaevanionView";

export function DaevanionPage() {
  return (
    <>
      <PageHeader title="Daevanion" caption="Game-style boards per god. Pick nodes along the path, see the totals, or ask for the max power order." />
      <DaevanionView />
    </>
  );
}

export default DaevanionPage;

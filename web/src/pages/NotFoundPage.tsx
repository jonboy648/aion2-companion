import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Link to="/">Back to the home page</Link>
    </>
  );
}

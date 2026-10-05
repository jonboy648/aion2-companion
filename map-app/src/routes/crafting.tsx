import {createFileRoute} from "@tanstack/react-router";

export const Route = createFileRoute("/crafting")({
  beforeLoad: () => {
    window.location.replace(`/crafting${window.location.search}${window.location.hash}`);
  },
  component: () => <a href="/crafting">Crafting</a>,
});

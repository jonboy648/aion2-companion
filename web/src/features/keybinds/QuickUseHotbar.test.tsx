import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useState } from "react";
import { Hotbar, SlotEditor } from "./Hotbar";

it("shows stable Quick Use identities separately from editable bindings", () => {
  let selected = "";
  function Harness() {
    const [binding, setBinding] = useState("Left mouse");
    return <Hotbar gd={null} icons={{}} pins={{}} selected="1" onSelect={(id) => { selected = id; }}
      stacks={[{ quick_use_id: 1, key_label: binding, stack: ["flame-arrow"] }]}
      actions={[{ id: 1, slot_id: 1, binding, alternate_bindings: ["W"], default_skill: "flame-arrow", context_skills: [], slot_editable: false, context_editable: false }]}
      onBinding={(_id, value) => setBinding(value)} />;
  }
  render(<Harness />);
  expect(screen.getByRole("region", { name: "Quickslot keys" })).toHaveAttribute("tabindex", "0");
  const key = screen.getByRole("textbox", { name: "Binding for Quick Use 1" });
  expect(key).toHaveValue("Left mouse");
  fireEvent.change(key, { target: { value: "Q" } });
  expect(key).toHaveValue("Q");
  fireEvent.click(screen.getByRole("button", { name: /Quick Use 1.*flame-arrow/ }));
  expect(selected).toBe("1");
  expect(screen.getByText("Slot 1")).toBeVisible();
});

it("shows contextual alternatives separately and prevents replacing a fixed action", () => {
  render(<SlotEditor gd={null} icons={{}} label="1" stack={["flame-arrow"]} pins={{}} pinnedSkill={undefined}
    level={45} onPin={vi.fn()} onUnpin={vi.fn()}
    action={{ id: 1, slot_id: 1, binding: "Left mouse", alternate_bindings: ["W"], default_skill: "flame-arrow", context_skills: ["context-skill"], slot_editable: false, context_editable: false }} />);
  expect(screen.getByRole("heading", { name: "Quick Use 1" })).toBeVisible();
  expect(screen.getByText("context-skill")).toBeVisible();
  expect(screen.getByText(/Fixed class action/)).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByText(/fires first/)).not.toBeInTheDocument();
});

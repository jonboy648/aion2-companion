import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodexPage } from "./Codex";

vi.mock("./ManualBuild", () => ({ ManualBuild: ({ guideClass }: { guideClass?: string }) =>
  <div data-testid="class-guide">Guide for {guideClass}</div> }));
vi.mock("@/features/codex/CodexView", () => ({ CodexView: ({ classKey }: { classKey: string }) =>
  <div data-testid="encyclopedia">Skills for {classKey}</div> }));
afterEach(cleanup);

function at(url: string) {
  return render(<MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/codex/:classKey?" element={<CodexPage />} /></Routes>
  </MemoryRouter>);
}

describe("Codex guide and encyclopedia", () => {
  it("opens the shared class guide for the route class", () => {
    at("/codex/gladiator");
    expect(screen.getByRole("tab", { name: "Class guide" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("class-guide")).toHaveTextContent("Guide for gladiator");
    expect(screen.queryByTestId("encyclopedia")).toBeNull();
  });

  it("keeps the existing encyclopedia behind its own tab", () => {
    at("/codex/sorcerer");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Skill encyclopedia" }), { button: 0, ctrlKey: false });
    expect(screen.getByTestId("encyclopedia")).toHaveTextContent("Skills for sorcerer");
    expect(screen.getByTestId("class-guide")).not.toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "Class guide" })).toBeNull();
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Class guide" }), { button: 0, ctrlKey: false });
    expect(screen.getByTestId("class-guide")).toBeVisible();
  });

  it("opens skill deep links directly in the encyclopedia", () => {
    at("/codex/sorcerer?skill=flame-arrow");
    expect(screen.getByRole("tab", { name: "Skill encyclopedia" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("encyclopedia")).toBeInTheDocument();
    expect(screen.getByTestId("class-guide")).not.toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "Class guide" })).toBeNull();
  });

  it("defaults to the Sorcerer guide without a class route parameter", () => {
    at("/codex");
    expect(screen.getByTestId("class-guide")).toHaveTextContent("Guide for sorcerer");
  });
});

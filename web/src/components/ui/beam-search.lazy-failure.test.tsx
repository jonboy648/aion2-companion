import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BeamSearch from "./beam-search";

const library = vi.hoisted(() => {
  let reject!: (error: Error) => void;
  const pending = new Promise<never>((_resolve, rejectPromise) => { reject = rejectPromise; });
  return { pending, reject, load: vi.fn(() => pending) };
});
vi.mock("border-beam", () => library.load());

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BeamSearch decorative chunk failure", () => {
  it("preserves the app, input, static focus, clear, and submit after an import rejection", async () => {
    vi.stubGlobal("matchMedia", (media: string) => ({
      media,
      matches: media === "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: () => true,
    }));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const inputRef = createRef<HTMLInputElement>();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const siblingClick = vi.fn();
    const { container } = render(
      <div>
        <button type="button" onClick={siblingClick}>Home action</button>
        <BeamSearch ref={inputRef} defaultValue="Ariel" onChange={onChange} onSubmit={onSubmit} aria-label="Name" />
      </div>,
    );
    const input = screen.getByRole("textbox");
    const sibling = screen.getByRole("button", { name: "Home action" });
    expect(library.load).not.toHaveBeenCalled();
    act(() => input.focus());
    await waitFor(() => expect(library.load).toHaveBeenCalledOnce());
    expect(input).toHaveFocus();
    expect(inputRef.current).toBe(input);

    await act(async () => {
      library.reject(new Error("Failed to fetch dynamically imported module: border-beam"));
      await library.pending.catch(() => {});
    });

    expect(screen.getByRole("textbox")).toBe(input);
    expect(inputRef.current).toBe(input);
    expect(input).toHaveValue("Ariel");
    expect(input).toHaveFocus();
    expect(container.querySelector(".beam-search")).toHaveAttribute("data-focused", "true");
    expect(container.querySelector(".beam-search")).toHaveAttribute("data-highlighted", "true");
    expect(container.querySelector("[data-beam]")).toBeNull();
    fireEvent.change(input, { target: { value: "Azphel" } });
    expect(onChange).toHaveBeenLastCalledWith("Azphel");
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Azphel");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    fireEvent.click(sibling);
    expect(siblingClick).toHaveBeenCalledOnce();
    act(() => input.blur());
    act(() => input.focus());
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveFocus();
    expect(library.load).toHaveBeenCalledOnce();
  });
});

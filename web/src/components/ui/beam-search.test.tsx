/// <reference types="node" />
import { readFileSync } from "node:fs";
import { StrictMode, createRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BeamSearch, { BeamSearch as NamedBeamSearch } from "./beam-search";

const library = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("border-beam", async importOriginal => {
  library.load();
  return await importOriginal<typeof import("border-beam")>();
});

const styles = readFileSync("src/components/ui/beam-search.css", "utf8");

const schemeQuery = "(prefers-color-scheme: dark)";
const motionQuery = "(prefers-reduced-motion: reduce)";
type MediaListener = (event: MediaQueryListEvent) => void;

function installMedia({ dark = true, reduced = false, legacy = false } = {}) {
  const queries = new Map<string, { query: MediaQueryList; listeners: Set<MediaListener> }>();
  vi.stubGlobal("matchMedia", vi.fn((media: string) => {
    let entry = queries.get(media);
    if (!entry) {
      const listeners = new Set<MediaListener>();
      const query = {
        media,
        matches: media === schemeQuery ? dark : media === motionQuery ? reduced : false,
        onchange: null,
        addListener: (listener: MediaListener) => listeners.add(listener),
        removeListener: (listener: MediaListener) => listeners.delete(listener),
        ...(!legacy && {
          addEventListener: (_type: string, listener: MediaListener) => listeners.add(listener),
          removeEventListener: (_type: string, listener: MediaListener) => listeners.delete(listener),
        }),
        dispatchEvent: () => true,
      } as unknown as MediaQueryList;
      entry = { query, listeners };
      queries.set(media, entry);
    }
    return entry.query;
  }));
  return {
    set(media: string, matches: boolean) {
      const entry = queries.get(media)!;
      Object.defineProperty(entry.query, "matches", { value: matches, configurable: true });
      act(() => entry.listeners.forEach(listener => listener({ matches, media } as MediaQueryListEvent)));
    },
    listenerCount() { return [...queries.values()].reduce((count, entry) => count + entry.listeners.size, 0); },
  };
}

let stylesheet: HTMLStyleElement;
beforeEach(() => {
  vi.stubGlobal("matchMedia", undefined);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  stylesheet = document.createElement("style");
  stylesheet.textContent = styles;
  document.head.append(stylesheet);
});
afterEach(() => {
  cleanup();
  stylesheet.remove();
  document.documentElement.className = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BeamSearch input contract", () => {
  it("exports named and default versions and works without matchMedia", () => {
    expect(NamedBeamSearch).toBe(BeamSearch);
    const { container } = render(
      <BeamSearch
        aria-label="Character name" aria-describedby="help" aria-invalid="true"
        id="character" name="character" required autoComplete="off"
        defaultValue="Ariel" className="character-search" trailing={<span>NA</span>}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Character name" });
    expect(input).toHaveValue("Ariel");
    expect(input).toHaveAttribute("aria-describedby", "help");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("id", "character");
    expect(input).toHaveAttribute("name", "character");
    expect(input).toHaveAttribute("required");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(container.firstElementChild).toHaveClass("beam-search", "character-search");
    expect(container.firstElementChild).toHaveAttribute("data-beam-theme", "dark");
    expect(screen.getByText("NA")).toBeVisible();
    fireEvent.focus(input);
    expect(container.querySelector("[data-beam]")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-focused", "true");
    expect(library.load).not.toHaveBeenCalled();
  });

  it("keeps uncontrolled edits and ignores later defaultValue changes", () => {
    const onChange = vi.fn();
    const { rerender } = render(<BeamSearch defaultValue="Ariel" onChange={onChange} aria-label="Name" />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Azphel" } });
    expect(onChange).toHaveBeenLastCalledWith("Azphel");
    expect(input).toHaveValue("Azphel");
    rerender(<BeamSearch defaultValue="Changed default" onChange={onChange} aria-label="Name" />);
    expect(input).toHaveValue("Azphel");
    expect(screen.getByRole("textbox")).toBe(input);
  });

  it("leaves a controlled value with its owner", () => {
    const onChange = vi.fn();
    const { rerender } = render(<BeamSearch value="Ariel" onChange={onChange} aria-label="Name" />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Azphel" } });
    expect(onChange).toHaveBeenLastCalledWith("Azphel");
    expect(input).toHaveValue("Ariel");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(input).toHaveValue("Ariel");
    rerender(<BeamSearch value="" onChange={onChange} aria-label="Name" />);
    expect(input).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("clears a controlled input and keeps/refocuses the same input", () => {
    const inputRef = createRef<HTMLInputElement>();
    function Controlled() {
      const [value, setValue] = useState("Ariel");
      return <BeamSearch ref={inputRef} value={value} onChange={setValue} aria-label="Name" />;
    }
    render(<Controlled />);
    const input = screen.getByRole("textbox");
    act(() => input.focus());
    const clear = screen.getByRole("button", { name: "Clear search" });
    expect(clear).toHaveAttribute("type", "button");
    expect(fireEvent.mouseDown(clear)).toBe(false);
    expect(input).toHaveFocus();
    fireEvent.click(clear);
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(inputRef.current).toBe(input);
    fireEvent.change(input, { target: { value: "Azphel" } });
    act(() => screen.getByRole("button", { name: "Clear search" }).focus());
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveFocus();
  });

  it("clears on Escape and respects a consumer's prevented key event", () => {
    const onChange = vi.fn();
    const { rerender } = render(<BeamSearch defaultValue="Ariel" onChange={onChange} aria-label="Name" />);
    const input = screen.getByRole("textbox");
    act(() => input.focus());
    expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("");
    fireEvent.change(input, { target: { value: "Azphel" } });
    rerender(<BeamSearch onChange={onChange} aria-label="Name" onKeyDown={event => event.preventDefault()} />);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("Azphel");
  });

  it("prevents Enter's default form submission when a submit callback exists", () => {
    const onSubmit = vi.fn();
    const formSubmit = vi.fn(event => event.preventDefault());
    render(<form onSubmit={formSubmit}><BeamSearch defaultValue="Ariel" onSubmit={onSubmit} aria-label="Name" /></form>);
    const input = screen.getByRole("textbox");
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Ariel");
    expect(formSubmit).not.toHaveBeenCalled();
  });

  it("allows normal form Enter when there is no submit callback", () => {
    const formSubmit = vi.fn(event => event.preventDefault());
    render(<form onSubmit={formSubmit}><BeamSearch defaultValue="Ariel" aria-label="Name" /></form>);
    const input = screen.getByRole("textbox");
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
    fireEvent.submit(input.closest("form")!);
    expect(formSubmit).toHaveBeenCalledOnce();
  });

  it("does not submit or clear during an IME composition", () => {
    const onSubmit = vi.fn();
    render(<BeamSearch defaultValue="Ariel" onSubmit={onSubmit} aria-label="Name" />);
    const input = screen.getByRole("textbox");
    fireEvent.compositionStart(input);
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("Ariel");
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Ariel");
  });

  it("allows Enter after an interrupted composition loses focus", () => {
    const onSubmit = vi.fn();
    render(<BeamSearch defaultValue="Ariel" onSubmit={onSubmit} aria-label="Name" />);
    const input = screen.getByRole("textbox");
    act(() => input.focus());
    fireEvent.compositionStart(input);
    act(() => input.blur());
    act(() => input.focus());
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Ariel");
  });

  it("disables the input and prevents clearing read-only values", () => {
    const { rerender } = render(<BeamSearch disabled defaultValue="Ariel" aria-label="Name" />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    rerender(<BeamSearch readOnly defaultValue="Ariel" aria-label="Name" />);
    expect(input).toHaveAttribute("readonly");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("Ariel");
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });
});

describe("BeamSearch decoration lifecycle", () => {
  it("loads the real LINE beam once on focus and preserves layout and input identity", async () => {
    installMedia();
    const { container } = render(<BeamSearch aria-label="Name" colorVariant="gold" theme="dark" />);
    const input = screen.getByRole("textbox");
    const surface = container.querySelector(".beam-search-control")!;
    expect(getComputedStyle(surface).height).toBe("48px");
    expect(getComputedStyle(surface).borderRadius).toBe("8px");
    expect(container.querySelector("[data-beam]")).toBeNull();
    expect(library.load).not.toHaveBeenCalled();
    act(() => input.focus());
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveFocus();
    await waitFor(() => expect(container.querySelector("[data-beam]")).not.toBeNull());
    const beam = container.querySelector("[data-beam]")!;
    expect(library.load).toHaveBeenCalledOnce();
    expect(beam).toHaveAttribute("data-active");
    expect(getComputedStyle(beam).position).toBe("absolute");
    expect(getComputedStyle(beam).pointerEvents).toBe("none");
    expect(container.querySelector("style")!.textContent).toContain("beam-travel-");
    expect(container.querySelector("style")!.textContent).not.toContain("beam-hue-shift-");
    act(() => input.blur());
    expect(container.querySelector("[data-beam]")).toBeNull();
    act(() => input.focus());
    await waitFor(() => expect(container.querySelector("[data-beam]")).not.toBeNull());
    expect(container.querySelector("[data-beam]")).not.toBe(beam);
    expect(library.load).toHaveBeenCalledOnce();
    expect(container.querySelector("[data-fading]")).toBeNull();
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveFocus();
  });

  it("switches between static reduced-motion focus and animation without waiting for animationend", async () => {
    const media = installMedia({ reduced: true });
    const { container } = render(<BeamSearch aria-label="Name" />);
    const input = screen.getByRole("textbox");
    act(() => input.focus());
    expect(container.firstElementChild).toHaveAttribute("data-highlighted", "true");
    expect(container.querySelector("[data-beam]")).toBeNull();
    media.set(motionQuery, false);
    await waitFor(() => expect(container.querySelector("[data-active]")).not.toBeNull());
    media.set(motionQuery, true);
    expect(container.querySelector("[data-beam]")).toBeNull();
    act(() => { input.blur(); input.focus(); });
    media.set(motionQuery, false);
    await waitFor(() => expect(container.querySelector("[data-active]")).not.toBeNull());
    expect(container.querySelector("[data-fading]")).toBeNull();
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveFocus();
  });

  it("stops in a hidden tab and resumes without replacing the input", async () => {
    installMedia();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { container } = render(<BeamSearch alwaysOn aria-label="Name" />);
    const input = screen.getByRole("textbox");
    act(() => input.focus());
    await waitFor(() => expect(container.querySelector("[data-active]")).not.toBeNull());
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(container.querySelector("[data-beam]")).toBeNull();
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(container.querySelector("[data-active]")).not.toBeNull());
    expect(screen.getByRole("textbox")).toBe(input);
    expect(input).toHaveFocus();
  });

  it("supports alwaysOn but suppresses disabled animation", async () => {
    installMedia();
    const { container, rerender } = render(<BeamSearch alwaysOn aria-label="Name" />);
    await waitFor(() => expect(container.querySelector("[data-active]")).not.toBeNull());
    rerender(<BeamSearch alwaysOn disabled aria-label="Name" />);
    expect(container.querySelector("[data-beam]")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-highlighted", "false");
  });

  it("uses static focus on legacy media-query APIs and still reacts to OS theme changes", () => {
    const media = installMedia({ legacy: true });
    const { container } = render(<BeamSearch alwaysOn theme="auto" aria-label="Name" />);
    const input = screen.getByRole("textbox");
    act(() => input.focus());
    expect(container.querySelector("[data-beam]")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-focused", "true");
    media.set(schemeQuery, false);
    expect(container.firstElementChild).toHaveAttribute("data-beam-theme", "light");
    fireEvent.change(input, { target: { value: "Ariel" } });
    expect(input).toHaveValue("Ariel");
  });

  it("cleans up media subscriptions through StrictMode mounting and unmounting", async () => {
    const media = installMedia();
    const { container, unmount } = render(<StrictMode><BeamSearch alwaysOn theme="auto" aria-label="Name" /></StrictMode>);
    await waitFor(() => expect(container.querySelector("[data-active]")).not.toBeNull());
    expect(media.listenerCount()).toBeGreaterThan(0);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});

describe("surface theme", () => {
  it("prefers the nearest theme class and reacts to class removal and OS changes", async () => {
    const media = installMedia({ dark: true });
    document.documentElement.className = "dark";
    const { container } = render(<section className="light"><BeamSearch theme="auto" aria-label="Name" /></section>);
    const parent = container.firstElementChild!;
    const wrapper = container.querySelector(".beam-search")!;
    const input = screen.getByRole("textbox");
    expect(wrapper).toHaveAttribute("data-beam-theme", "light");
    parent.className = "dark";
    await waitFor(() => expect(wrapper).toHaveAttribute("data-beam-theme", "dark"));
    parent.className = "";
    document.documentElement.className = "";
    media.set(schemeQuery, false);
    await waitFor(() => expect(wrapper).toHaveAttribute("data-beam-theme", "light"));
    media.set(schemeQuery, true);
    expect(wrapper).toHaveAttribute("data-beam-theme", "dark");
    expect(screen.getByRole("textbox")).toBe(input);
  });

  it("reacts to declared data-theme without matchMedia and honors explicit theme overrides", async () => {
    const { container, rerender } = render(<section data-theme="light"><BeamSearch theme="auto" aria-label="Name" /></section>);
    const parent = container.firstElementChild!;
    const wrapper = container.querySelector(".beam-search")!;
    expect(wrapper).toHaveAttribute("data-beam-theme", "light");
    parent.setAttribute("data-theme", "dark");
    await waitFor(() => expect(wrapper).toHaveAttribute("data-beam-theme", "dark"));
    rerender(<section data-theme="dark"><BeamSearch theme="light" aria-label="Name" /></section>);
    expect(wrapper).toHaveAttribute("data-beam-theme", "light");
  });
});

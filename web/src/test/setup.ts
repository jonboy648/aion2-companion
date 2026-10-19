import "@testing-library/jest-dom/vitest";

// JSDOM has no viewport; tests can spy on the browser scroll boundary.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "scrollTo", { value: () => {}, writable: true, configurable: true });
}

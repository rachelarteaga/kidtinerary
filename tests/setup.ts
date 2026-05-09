import "@testing-library/jest-dom/vitest";

// jsdom doesn't ship matchMedia; stub it so components using
// `window.matchMedia(...)` (e.g. responsive-narrow detection in
// SharedPlannerView) can mount in tests.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

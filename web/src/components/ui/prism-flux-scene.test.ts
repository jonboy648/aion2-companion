import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Group, LineSegments, Mesh, OrthographicCamera, Scene } from "three";
import { createPrismFluxScene, type PrismFluxScene } from "./prism-flux-scene";

const gpu = vi.hoisted(() => ({
  draw: vi.fn(), dispose: vi.fn(), lose: vi.fn(), pixelRatio: vi.fn(), size: vi.fn(),
  clearColor: vi.fn(), contextLost: false,
}));

// Keep actual Three scene/geometry/material behavior; substitute only the GPU boundary.
vi.mock("three", async importOriginal => ({
  ...await importOriginal<typeof import("three")>(),
  WebGLRenderer: class {
    domElement: HTMLCanvasElement;
    constructor(opts: { canvas?: HTMLCanvasElement } = {}) { this.domElement = opts.canvas ?? document.createElement("canvas"); }
    render = gpu.draw;
    dispose = gpu.dispose;
    forceContextLoss = gpu.lose;
    setPixelRatio = gpu.pixelRatio;
    setSize = gpu.size;
    setClearColor = gpu.clearColor;
    getContext() { return { isContextLost: () => gpu.contextLost }; }
  },
}));

let frames: Map<number, FrameRequestCallback>;
let controller: PrismFluxScene | undefined;
let host: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no WebGL: the scene asks for a webgl2 context before creating the renderer
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as RenderingContext);
  gpu.draw.mockReset();
  gpu.contextLost = false;
  frames = new Map();
  let nextId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("devicePixelRatio", 3);
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  controller?.dispose();
  controller = undefined;
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function start(speed = 5, onFailure = vi.fn()) {
  controller = createPrismFluxScene(host, { size: 30, side: 54, speed, color: "#e0b458", faceColor: "#0a1224", onFailure });
  return controller;
}

function frameAt(time: number) {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach(callback => callback(time));
}

it("renders a framed opaque cube with six depth-tested plus marks and a capped DPR", () => {
  start();
  const [scene, camera] = gpu.draw.mock.calls[0] as [Scene, OrthographicCamera];
  const cube = scene.children[0] as Group;
  const [face, edges, marks] = cube.children as [Mesh, LineSegments, LineSegments];
  expect(face.material).toMatchObject({ transparent: false, opacity: 1 });
  expect(edges.geometry.type).toBe("EdgesGeometry");
  expect(marks.material).toMatchObject({ depthTest: true });
  expect(marks.geometry.getAttribute("position").count).toBe(24);
  expect(camera.right).toBeGreaterThan(Math.sqrt(3) / 2);
  expect(gpu.pixelRatio).toHaveBeenCalledWith(1.5);
  expect(gpu.size).toHaveBeenCalledWith(54, 54);
  expect(gpu.clearColor).toHaveBeenCalledWith(0, 0);
  expect(host.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
  expect(frames.size).toBe(0);
});

it("rotates with elapsed time, limits drawing to 30 FPS and cancels a paused loop", () => {
  const scene = start();
  const cube = (gpu.draw.mock.calls[0][0] as Scene).children[0] as Group;
  scene.setActive(true);
  frameAt(0);
  frameAt(16);
  frameAt(32);
  frameAt(48);
  expect(gpu.draw).toHaveBeenCalledTimes(3);
  expect(cube.rotation.y).toBeCloseTo(0.6528);
  scene.setActive(false);
  expect(frames.size).toBe(0);
  frameAt(1000);
  expect(gpu.draw).toHaveBeenCalledTimes(3);
  scene.setActive(true);
  frameAt(1000);
  expect(cube.rotation.y).toBeCloseTo(0.6528);
});

it("holds a static frame at zero speed", () => {
  start(0).setActive(true);
  expect(gpu.draw).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
});

it("disposes geometry, material, renderer, context, listeners and canvas exactly once", () => {
  const scene = start();
  const cube = (gpu.draw.mock.calls[0][0] as Scene).children[0] as Group;
  const geometries = cube.children.map(child => (child as Mesh).geometry);
  const materials = [...new Set(cube.children.map(child => (child as Mesh).material))];
  const releasedGeometry = geometries.map(geometry => vi.spyOn(geometry, "dispose"));
  const releasedMaterial = materials.map(material => vi.spyOn(material as Mesh["material"] & { dispose: () => void }, "dispose"));
  const canvas = host.querySelector("canvas")!;
  scene.setActive(true);
  scene.dispose();
  scene.dispose();
  expect(frames.size).toBe(0);
  expect(releasedGeometry.every(released => released.mock.calls.length === 1)).toBe(true);
  expect(releasedMaterial.every(released => released.mock.calls.length === 1)).toBe(true);
  expect(gpu.dispose).toHaveBeenCalledOnce();
  expect(gpu.lose).toHaveBeenCalledOnce();
  expect(host.childElementCount).toBe(0);
  canvas.dispatchEvent(new Event("webglcontextlost"));
  expect(gpu.dispose).toHaveBeenCalledOnce();
});

it("cleans up context loss and reports the failure once", () => {
  const onFailure = vi.fn();
  start(5, onFailure).setActive(true);
  const canvas = host.querySelector("canvas")!;
  const event = new Event("webglcontextlost", { cancelable: true });
  expect(canvas.dispatchEvent(event)).toBe(false);
  expect(event.defaultPrevented).toBe(true);
  expect(onFailure).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
  expect(host.childElementCount).toBe(0);
  canvas.dispatchEvent(new Event("webglcontextlost"));
  expect(onFailure).toHaveBeenCalledOnce();
});

it("cleans up a failed initial render before rejecting initialization", () => {
  gpu.draw.mockImplementationOnce(() => { throw new Error("GPU draw failed"); });
  expect(() => start()).toThrow("GPU draw failed");
  expect(host.childElementCount).toBe(0);
  expect(gpu.dispose).toHaveBeenCalledOnce();
  expect(gpu.lose).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
});

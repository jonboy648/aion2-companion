import {
  BoxGeometry, BufferGeometry, EdgesGeometry, Float32BufferAttribute, Group,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, OrthographicCamera,
  Scene, WebGLRenderer,
} from "three";

export interface PrismFluxScene {
  setActive: (active: boolean) => void;
  dispose: () => void;
}

export interface PrismFluxSceneOptions {
  size: number;
  side: number;
  speed: number;
  color: string;
  faceColor: string;
  onFailure: () => void;
}

export function createPrismFluxScene(host: HTMLElement, options: PrismFluxSceneOptions): PrismFluxScene {
  const { side, size, speed, color, faceColor, onFailure } = options;
  const scene = new Scene();
  const cube = new Group();
  // The enclosing sphere has radius sqrt(3)/2; leave margin at every rotation.
  const extent = Math.max(0.98, side / size / 2);
  const camera = new OrthographicCamera(-extent, extent, extent, -extent, 0.1, 20);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);
  const geometries: BufferGeometry[] = [];
  const materials: Array<MeshBasicMaterial | LineBasicMaterial> = [];
  let renderer: WebGLRenderer | undefined;
  let disposed = false;
  let active = false;
  let frame: number | undefined;
  let previousTime: number | undefined;
  let lastDraw: number | undefined;

  function dispose() {
    if (disposed) return;
    disposed = true;
    active = false;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
    renderer?.domElement.removeEventListener("webglcontextlost", contextLost);
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    scene.clear();
    if (renderer) {
      try { renderer.dispose(); } catch { /* A lost GPU can reject driver cleanup. */ }
      try { renderer.forceContextLoss(); } catch { /* The context may already be gone. */ }
      renderer.domElement.remove();
    }
  }

  function contextLost(event: Event) {
    event.preventDefault();
    dispose();
    onFailure();
  }

  function draw() {
    renderer!.render(scene, camera);
    if (renderer!.getContext().isContextLost()) throw new Error("PrismFlux GPU context lost");
  }

  function tick(time: number) {
    frame = undefined;
    if (disposed || !active) return;
    const delta = previousTime === undefined ? 0 : Math.min((time - previousTime) / 1000, 0.1);
    previousTime = time;
    cube.rotation.x += delta * speed * 0.13;
    cube.rotation.y += delta * speed * 0.22;
    cube.rotation.z += delta * speed * 0.04;
    try {
      if (lastDraw === undefined || time - lastDraw >= 1000 / 30) {
        draw();
        lastDraw = time;
      }
    } catch {
      dispose();
      onFailure();
      return;
    }
    frame = window.requestAnimationFrame(tick);
  }

  try {
    const box = new BoxGeometry(1, 1, 1);
    geometries.push(box);
    const edges = new EdgesGeometry(box);
    geometries.push(edges);
    const faceMaterial = new MeshBasicMaterial({ color: faceColor, transparent: false });
    materials.push(faceMaterial);
    const lineMaterial = new LineBasicMaterial({ color, depthTest: true, toneMapped: false });
    materials.push(lineMaterial);
    cube.add(new Mesh(box, faceMaterial), new LineSegments(edges, lineMaterial));

    const positions: number[] = [];
    // Each face gets a cross just above its surface, with depth-tested rear marks.
    for (let axis = 0; axis < 3; axis++) {
      const first = (axis + 1) % 3;
      const second = (axis + 2) % 3;
      for (const direction of [-1, 1]) {
        for (const tangent of [first, second]) {
          for (const end of [-0.17, 0.17]) {
            const vertex = [0, 0, 0];
            vertex[axis] = direction * 0.503;
            vertex[tangent] = end;
            positions.push(...vertex);
          }
        }
      }
    }
    const marks = new BufferGeometry();
    geometries.push(marks);
    marks.setAttribute("position", new Float32BufferAttribute(positions, 3));
    cube.add(new LineSegments(marks, lineMaterial));
    cube.rotation.set(0.45, 0.6, 0.08);
    scene.add(cube);

    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setSize(side, side);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    host.append(renderer.domElement);
    draw();
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    dispose,
    setActive(nextActive) {
      if (disposed) return;
      const next = nextActive && speed > 0;
      if (active === next) return;
      active = next;
      previousTime = undefined;
      lastDraw = undefined;
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = active ? window.requestAnimationFrame(tick) : undefined;
    },
  };
}

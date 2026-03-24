import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  TransformNode,
} from "@babylonjs/core";
import type { FractalVisual } from "./mandelbulb";

function buildMengerPositions(depth: number): Vector3[] {
  if (depth === 0) return [Vector3.Zero()];

  const positions: Vector3[] = [];
  const prev = buildMengerPositions(depth - 1);
  const scale = Math.pow(1 / 3, depth);

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        // Remove center of each face and the core
        const zeros = (x === 0 ? 1 : 0) + (y === 0 ? 1 : 0) + (z === 0 ? 1 : 0);
        if (zeros >= 2) continue;

        const offset = new Vector3(x, y, z).scale(scale * 2);
        for (const p of prev) {
          positions.push(p.scale(1 / 3).add(offset));
        }
      }
    }
  }
  return positions;
}

export function createMenger(scene: Scene): FractalVisual {
  const root = new TransformNode("mengerRoot", scene);
  root.position = new Vector3(0, 1.2, 2);

  // Depth 2 = 400 cubes, ~4800 tris — well within Quest 2 budget
  const positions = buildMengerPositions(2);
  const cubeSize = Math.pow(1 / 3, 2) * 2;

  const mat = new StandardMaterial("mengerMat", scene);
  mat.diffuseColor = new Color3(0.3, 0.5, 0.9);
  mat.specularColor = new Color3(0.4, 0.4, 0.4);

  // Use merged mesh for performance
  const tempBoxes: Mesh[] = [];
  for (const pos of positions) {
    const box = MeshBuilder.CreateBox("mb", { size: cubeSize * 0.95 }, scene);
    box.position = pos;
    tempBoxes.push(box);
  }

  const merged = Mesh.MergeMeshes(tempBoxes, true, true, undefined, false, true)!;
  merged.parent = root;
  merged.material = mat;

  return {
    mesh: merged,
    update(time: number) {
      // Slow rotation
      root.rotation.y = time * 0.2;
      root.rotation.x = Math.sin(time * 0.15) * 0.3;

      // Pulsing scale
      const s = 1.0 + 0.1 * Math.sin(time * 0.5);
      root.scaling.setAll(s);

      // Color cycling
      const r = 0.4 + 0.3 * Math.sin(time * 0.4);
      const g = 0.4 + 0.3 * Math.sin(time * 0.4 + 2.0);
      const b = 0.4 + 0.3 * Math.sin(time * 0.4 + 4.0);
      mat.diffuseColor = new Color3(r, g, b);
    },
    dispose() {
      merged.dispose();
      mat.dispose();
      root.dispose();
    },
  };
}

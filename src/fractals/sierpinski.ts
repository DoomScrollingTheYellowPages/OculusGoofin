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

const TETRA_VERTS = [
  new Vector3(0, 1, 0),
  new Vector3(-0.943, -0.333, 0),
  new Vector3(0.471, -0.333, -0.816),
  new Vector3(0.471, -0.333, 0.816),
];

function buildSierpinskiPositions(
  depth: number,
  center: Vector3,
  size: number
): { center: Vector3; size: number }[] {
  if (depth === 0) return [{ center, size }];

  const results: { center: Vector3; size: number }[] = [];
  const half = size / 2;
  for (const v of TETRA_VERTS) {
    const childCenter = center.add(v.scale(half * 0.5));
    results.push(...buildSierpinskiPositions(depth - 1, childCenter, half));
  }
  return results;
}

export function createSierpinski(scene: Scene): FractalVisual {
  const root = new TransformNode("sierpinskiRoot", scene);
  root.position = new Vector3(0, 1.2, 2);

  // Depth 4 = 256 tetrahedra, ~1024 tris
  const pieces = buildSierpinskiPositions(4, Vector3.Zero(), 1.5);

  const mat = new StandardMaterial("sierpMat", scene);
  mat.diffuseColor = new Color3(0.9, 0.4, 0.2);
  mat.specularColor = new Color3(0.5, 0.5, 0.5);

  const tempMeshes: Mesh[] = [];
  for (const piece of pieces) {
    const tetra = MeshBuilder.CreatePolyhedron(
      "st",
      { type: 0, size: piece.size * 0.45 },
      scene
    );
    tetra.position = piece.center;
    tempMeshes.push(tetra);
  }

  const merged = Mesh.MergeMeshes(tempMeshes, true, true, undefined, false, true)!;
  merged.parent = root;
  merged.material = mat;

  // Store original vertex positions for animation
  const positions = merged.getVerticesData("position")!;
  const originalPositions = new Float32Array(positions);

  return {
    mesh: merged,
    update(time: number) {
      // Rotate
      root.rotation.y = time * 0.25;

      // Breathing — vertices pulse outward from center
      const breathe = 1.0 + 0.08 * Math.sin(time * 0.8);
      const verts = new Float32Array(originalPositions.length);
      for (let i = 0; i < originalPositions.length; i += 3) {
        verts[i] = originalPositions[i] * breathe;
        verts[i + 1] = originalPositions[i + 1] * breathe;
        verts[i + 2] = originalPositions[i + 2] * breathe;
      }
      merged.updateVerticesData("position", verts);

      // Color cycling
      const r = 0.5 + 0.4 * Math.sin(time * 0.3 + 1.0);
      const g = 0.5 + 0.4 * Math.sin(time * 0.3 + 3.0);
      const b = 0.5 + 0.4 * Math.sin(time * 0.3 + 5.0);
      mat.diffuseColor = new Color3(r, g, b);
    },
    dispose() {
      merged.dispose();
      mat.dispose();
      root.dispose();
    },
  };
}

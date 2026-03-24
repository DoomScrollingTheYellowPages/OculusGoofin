import {
  Scene,
  MeshBuilder,
  ShaderMaterial,
  Effect,
  Vector3,
  Mesh,
} from "@babylonjs/core";
import vertexShader from "../shaders/mandelbulb.vert.glsl?raw";
import fragmentShader from "../shaders/mandelbulb.frag.glsl?raw";

export interface FractalVisual {
  mesh: Mesh;
  update(time: number): void;
  dispose(): void;
}

export function createMandelbulb(scene: Scene): FractalVisual {
  Effect.ShadersStore["mandelbulbVertexShader"] = vertexShader;
  Effect.ShadersStore["mandelbulbFragmentShader"] = fragmentShader;

  const mat = new ShaderMaterial("mandelbulbMat", scene, "mandelbulb", {
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection", "time", "power", "cameraPos"],
  });

  const box = MeshBuilder.CreateBox("mandelbulb", { size: 2 }, scene);
  box.position = new Vector3(0, 1.2, 2);
  box.material = mat;

  // Animate power between 2 and 10 for morphing
  let currentTime = 0;

  return {
    mesh: box,
    update(time: number) {
      currentTime = time;
      const power = 4.0 + 3.0 * Math.sin(time * 0.3);
      mat.setFloat("time", time);
      mat.setFloat("power", power);
      const cam = scene.activeCamera;
      if (cam) {
        mat.setVector3("cameraPos", cam.position);
      }
    },
    dispose() {
      box.dispose();
      mat.dispose();
    },
  };
}

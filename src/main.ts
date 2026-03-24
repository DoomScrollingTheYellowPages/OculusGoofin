import {
  Engine,
  Scene,
  FreeCamera,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  DynamicTexture,
  Texture,
  WebXRDefaultExperience,
} from "@babylonjs/core";

async function createScene(
  engine: Engine,
  canvas: HTMLCanvasElement
): Promise<Scene> {
  const scene = new Scene(engine);

  // Camera for non-VR preview (replaced by XR camera when entering VR)
  const camera = new FreeCamera("camera", new Vector3(0, 1.6, -3), scene);
  camera.setTarget(new Vector3(0, 1.5, 0));
  camera.attachControl(canvas, true);

  // Lighting
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.8;

  // Ground
  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: 10, height: 10 },
    scene
  );
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.2, 0.2, 0.25);
  ground.material = groundMat;

  // --- "Hi Mr Guadalupe" big text floating in the center ---
  const textPlane = MeshBuilder.CreatePlane(
    "textPlane",
    { width: 5, height: 1.2 },
    scene
  );
  textPlane.position = new Vector3(0, 2.2, 2);

  const textTexture = new DynamicTexture(
    "textTexture",
    { width: 1024, height: 256 },
    scene
  );
  const textMat = new StandardMaterial("textMat", scene);
  textMat.diffuseTexture = textTexture;
  textMat.emissiveColor = new Color3(1, 1, 1);
  textMat.backFaceCulling = false;
  textPlane.material = textMat;

  textTexture.drawText(
    "Hi Mr Guadalupe",
    null,
    180,
    "bold 80px Arial",
    "white",
    "transparent",
    true
  );
  textTexture.hasAlpha = true;

  // --- KEKW / El Risitas image ---
  const kekwPlane = MeshBuilder.CreatePlane(
    "kekwPlane",
    { width: 1.5, height: 1.5 },
    scene
  );
  kekwPlane.position = new Vector3(0, 1.0, 2);

  const kekwMat = new StandardMaterial("kekwMat", scene);
  const kekwTex = new Texture("/kekw.png", scene);
  kekwTex.hasAlpha = true;
  kekwMat.diffuseTexture = kekwTex;
  kekwMat.emissiveColor = new Color3(1, 1, 1);
  kekwMat.backFaceCulling = false;
  kekwMat.useAlphaFromDiffuseTexture = true;
  kekwPlane.material = kekwMat;

  // WebXR setup — gives us controller models, teleportation, and pointer interaction
  const xr = await WebXRDefaultExperience.CreateAsync(scene, {
    floorMeshes: [ground],
  });

  // Log controller connection for debugging
  xr.input.onControllerAddedObservable.add((controller) => {
    console.log("Controller connected:", controller.inputSource.handedness);
  });

  return scene;
}

async function main() {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const engine = new Engine(canvas, true);

  const scene = await createScene(engine, canvas);

  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener("resize", () => {
    engine.resize();
  });
}

main();

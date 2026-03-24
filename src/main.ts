import {
  Engine,
  Scene,
  FreeCamera,
  Vector3,
  Quaternion,
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

  // --- Exit VR button below KEKW ---
  const exitBtnPlane = MeshBuilder.CreatePlane(
    "exitBtn",
    { width: 1.2, height: 0.4 },
    scene
  );
  exitBtnPlane.position = new Vector3(0, 0.05, 2);

  const exitBtnTex = new DynamicTexture(
    "exitBtnTex",
    { width: 512, height: 128 },
    scene
  );
  const exitBtnMat = new StandardMaterial("exitBtnMat", scene);
  exitBtnMat.diffuseTexture = exitBtnTex;
  exitBtnMat.emissiveColor = new Color3(1, 1, 1);
  exitBtnMat.backFaceCulling = false;
  exitBtnPlane.material = exitBtnMat;

  const ctx = exitBtnTex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#cc3333";
  ctx.beginPath();
  ctx.roundRect(10, 10, 492, 108, 20);
  ctx.fill();
  exitBtnTex.drawText(
    "Exit VR",
    null,
    90,
    "bold 60px Arial",
    "white",
    null,
    true
  );

  // WebXR setup — disable default teleportation and snap-turn
  const xr = await WebXRDefaultExperience.CreateAsync(scene, {
    floorMeshes: [ground],
    disableTeleportation: true,
  });

  // Exit VR when the button is clicked (use scene pointer, works with XR controllers)
  scene.onPointerDown = (_evt, pickResult) => {
    if (pickResult.hit && pickResult.pickedMesh === exitBtnPlane) {
      xr.baseExperience.exitXRAsync();
    }
  };

  // Replace snap-turn with smooth locomotion
  if (xr.baseExperience) {
    // Remove the default teleportation and snap-turn features
    const featuresManager = xr.baseExperience.featuresManager;

    // Smooth thumbstick movement (forward/back) and rotation (left/right)
    const movementSpeed = 0.05;
    const rotationSpeedBase = 0.03;
    const rotationSpeedMax = 0.06; // 2x base at full deflection
    let rotationHoldTime = 0;
    const rotationRampDuration = 1.0; // seconds to reach max speed

    xr.input.onControllerAddedObservable.add((controller) => {
      console.log("Controller connected:", controller.inputSource.handedness);

      controller.onMotionControllerInitObservable.add((motionController) => {
        const thumbstick = motionController.getComponentOfType("thumbstick");
        if (!thumbstick) return;

        let lastTime = performance.now();

        thumbstick.onAxisValueChangedObservable.add((axes) => {
          const xrCamera = xr.baseExperience.camera;
          const now = performance.now();
          const dt = (now - lastTime) / 1000;
          lastTime = now;

          // Forward/back movement along the camera's look direction (Y axis = forward/back)
          if (Math.abs(axes.y) > 0.1) {
            const forward = xrCamera.getDirection(Vector3.Forward());
            forward.y = 0; // Keep movement horizontal
            forward.normalize();
            xrCamera.position.addInPlace(forward.scale(-axes.y * movementSpeed));
          }

          // Smooth horizontal rotation with acceleration (X axis = left/right)
          if (Math.abs(axes.x) > 0.1) {
            rotationHoldTime = Math.min(rotationHoldTime + dt, rotationRampDuration);
            const t = rotationHoldTime / rotationRampDuration;
            const rotationSpeed = rotationSpeedBase + (rotationSpeedMax - rotationSpeedBase) * t;
            xrCamera.rotationQuaternion.multiplyInPlace(
              Quaternion.FromEulerAngles(0, axes.x * rotationSpeed, 0)
            );
          } else {
            rotationHoldTime = 0;
          }
        });
      });
    });
  }

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

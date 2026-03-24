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
import { createMandelbulb, type FractalVisual } from "./fractals/mandelbulb";
import { createMenger } from "./fractals/menger";
import { createSierpinski } from "./fractals/sierpinski";

// Visual mode: the welcome screen + three fractals
type VisualMode = "welcome" | "mandelbulb" | "menger" | "sierpinski";
const MODES: VisualMode[] = ["welcome", "mandelbulb", "menger", "sierpinski"];

async function createScene(
  engine: Engine,
  canvas: HTMLCanvasElement
): Promise<Scene> {
  const scene = new Scene(engine);

  const camera = new FreeCamera("camera", new Vector3(0, 1.6, -3), scene);
  camera.setTarget(new Vector3(0, 1.5, 0));
  camera.attachControl(canvas, true);

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

  // --- Welcome screen elements ---
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

  const kekwPlane = MeshBuilder.CreatePlane(
    "kekwPlane",
    { width: 1.5, height: 1.5 },
    scene
  );
  kekwPlane.position = new Vector3(0, 1.0, 2);

  const kekwMat = new StandardMaterial("kekwMat", scene);
  const kekwTex = new Texture("kekw.png", scene);
  kekwTex.hasAlpha = true;
  kekwMat.diffuseTexture = kekwTex;
  kekwMat.emissiveColor = new Color3(1, 1, 1);
  kekwMat.backFaceCulling = false;
  kekwMat.useAlphaFromDiffuseTexture = true;
  kekwPlane.material = kekwMat;

  // Exit VR button
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

  const welcomeMeshes = [textPlane, kekwPlane, exitBtnPlane];

  // --- Visual mode management ---
  let currentModeIndex = 0;
  let activeFractal: FractalVisual | null = null;

  function setMode(mode: VisualMode) {
    // Hide/show welcome
    const showWelcome = mode === "welcome";
    for (const m of welcomeMeshes) {
      m.setEnabled(showWelcome);
    }

    // Dispose old fractal
    if (activeFractal) {
      activeFractal.dispose();
      activeFractal = null;
    }

    // Create new fractal
    switch (mode) {
      case "mandelbulb":
        activeFractal = createMandelbulb(scene);
        break;
      case "menger":
        activeFractal = createMenger(scene);
        break;
      case "sierpinski":
        activeFractal = createSierpinski(scene);
        break;
    }
  }

  function cycleMode() {
    currentModeIndex = (currentModeIndex + 1) % MODES.length;
    setMode(MODES[currentModeIndex]);
  }

  // Start in welcome mode
  setMode("welcome");

  // Animate fractals each frame
  const startTime = performance.now();
  scene.onBeforeRenderObservable.add(() => {
    const elapsed = (performance.now() - startTime) / 1000;
    if (activeFractal) {
      activeFractal.update(elapsed);
    }
  });

  // --- WebXR ---
  const xr = await WebXRDefaultExperience.CreateAsync(scene, {
    floorMeshes: [ground],
    disableTeleportation: true,
  });

  // Exit VR button click
  scene.onPointerDown = (_evt, pickResult) => {
    if (pickResult.hit && pickResult.pickedMesh === exitBtnPlane) {
      xr.baseExperience.exitXRAsync();
    }
  };

  // Keyboard fallback for cycling (press C on desktop)
  scene.onKeyboardObservable.add((kbInfo) => {
    if (kbInfo.type === 2 && kbInfo.event.key === "c") {
      cycleMode();
    }
  });

  // Controller input
  if (xr.baseExperience) {
    const movementSpeed = 0.05;
    const rotationSpeedBase = 0.03;
    const rotationSpeedMax = 0.06;
    let rotationHoldTime = 0;
    const rotationRampDuration = 1.0;

    xr.input.onControllerAddedObservable.add((controller) => {
      console.log("Controller connected:", controller.inputSource.handedness);

      controller.onMotionControllerInitObservable.add((motionController) => {
        // Thumbstick: movement + rotation
        const thumbstick = motionController.getComponentOfType("thumbstick");
        if (thumbstick) {
          let lastTime = performance.now();

          thumbstick.onAxisValueChangedObservable.add((axes) => {
            const xrCamera = xr.baseExperience.camera;
            const now = performance.now();
            const dt = (now - lastTime) / 1000;
            lastTime = now;

            if (Math.abs(axes.y) > 0.1) {
              const forward = xrCamera.getDirection(Vector3.Forward());
              forward.y = 0;
              forward.normalize();
              xrCamera.position.addInPlace(
                forward.scale(-axes.y * movementSpeed)
              );
            }

            if (Math.abs(axes.x) > 0.1) {
              rotationHoldTime = Math.min(
                rotationHoldTime + dt,
                rotationRampDuration
              );
              const t = rotationHoldTime / rotationRampDuration;
              const rotationSpeed =
                rotationSpeedBase +
                (rotationSpeedMax - rotationSpeedBase) * t;
              const yawDelta = Quaternion.RotationAxis(
                Vector3.Up(),
                axes.x * rotationSpeed
              );
              xrCamera.rotationQuaternion = yawDelta.multiply(
                xrCamera.rotationQuaternion
              );
            } else {
              rotationHoldTime = 0;
            }
          });
        }

        // A or X button: cycle visual mode
        const aButton =
          motionController.getComponent("a-button") ||
          motionController.getComponent("x-button");
        if (aButton) {
          aButton.onButtonStateChangedObservable.add(() => {
            if (aButton.pressed) {
              cycleMode();
            }
          });
        }
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

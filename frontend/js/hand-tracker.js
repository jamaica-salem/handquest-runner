// ====== Grab elements ======
const videoElement = document.getElementById("input_video");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

// ====== Global variables ======
window.currentAction = "none"; // 'jump', 'left', 'right', 'stop'
let lastAction = "none";
let activeHand = null;

// ====== Initialize MediaPipe Hands ======
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 0,
  minDetectionConfidence: 0.90,
  minTrackingConfidence: 0.90,
});

hands.onResults(onResults);

// ====== Use webcam ======
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});
camera.start();

/**
 * Determine which fingers are up.
 * Returns an array of booleans [thumb, index, middle, ring, pinky]
 */
function getFingersUp(landmarks, isRightHand) {
  const fingers = [];

  // Thumb: flip condition depending on hand
  if (isRightHand) {
    fingers.push(landmarks[4].x < landmarks[3].x); // right hand
  } else {
    fingers.push(landmarks[4].x > landmarks[3].x); // left hand
  }

  // Other fingers: tip.y < pip.y (lower value = higher finger)
  fingers.push(landmarks[8].y < landmarks[6].y); // index
  fingers.push(landmarks[12].y < landmarks[10].y); // middle
  fingers.push(landmarks[16].y < landmarks[14].y); // ring
  fingers.push(landmarks[20].y < landmarks[18].y); // pinky
  return fingers;
}

/**
 * Detect gesture from finger states
 */
function detectGesture(fingers) {
  const count = fingers.filter(Boolean).length;

  // ✊ Closed fist = STOP (This is the reset gesture)
  if (count === 0) return "stop";

  // 🖐️ Open palm = JUMP
  if (count === 5) return "jump";

  // ☝️ Index finger only = LEFT
  if (count !== 5 && fingers[1] && count === 1) return "left";

  // ✌️ Peace sign = RIGHT
  if (count !== 1 && fingers[1] && fingers[2] && count === 2) return "right";

  // Return "none" for any other gesture
  return "none";
}

/**
 * Main onResults handler - NOW ONLY PROCESSES FIRST DETECTED HAND
 */
// In hand-tracker.js, replace your existing onResults function with this one.

function onResults(results) {
  // ✅ FIX: Match the canvas drawing size to the video frame size to prevent cropping.
  canvasElement.width = results.image.width;
  canvasElement.height = results.image.height;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Draw the camera image first, which now fits perfectly.
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const handLabel = results.multiHandedness[0].label;
    const isRightHand = handLabel === "Right";

    if (!activeHand) {
      activeHand = handLabel;
      console.log(`🖐️ Locked to ${handLabel} hand`);
    }

    // --- Drawing Options (Smaller dots and lines) ---
    const connectorOptions = { color: "#00FF88", lineWidth: 3 };
    const landmarkOptions = { color: "#FF0066", lineWidth: 1, radius: 5 };

    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, connectorOptions);
    drawLandmarks(canvasCtx, landmarks, landmarkOptions);

    // --- Gesture Detection ---
    const fingers = getFingersUp(landmarks, isRightHand);
    const action = detectGesture(fingers);

    if (action !== lastAction) {
      // We don't log "none" to keep the console clean
      if (action !== "none") {
        console.log(`🎮 ${handLabel} HAND → ${action.toUpperCase()}`);
      }
      window.currentAction = action;
      lastAction = action;
    }

    // --- Display Text (Smaller and better positioned) ---
    canvasCtx.fillStyle = "yellow";
    canvasCtx.font = "24px 'Press Start 2P', monospace";
    canvasCtx.strokeStyle = "black";
    canvasCtx.lineWidth = 4;
    const textX = canvasElement.width * 0.05;
    const textY = canvasElement.height * 0.1;
    canvasCtx.strokeText(`Hand Detected`, textX, textY);
    canvasCtx.fillText(`Hand Detected`, textX, textY);
  } else {
    // No hand detected - reset
    window.currentAction = "none";
    lastAction = "none";
    activeHand = null;

    // --- Display "No hand detected" Text ---
    canvasCtx.fillStyle = "white";
    canvasCtx.font = "24px 'Press Start 2P', monospace";
    canvasCtx.strokeStyle = "black";
    canvasCtx.lineWidth = 4;
    const textX = canvasElement.width * 0.05;
    const textY = canvasElement.height * 0.1;
    canvasCtx.strokeText("No hand detected", textX, textY);
    canvasCtx.fillText("No hand detected", textX, textY);
  }

  canvasCtx.restore();
}

// ====== Keyboard Controls (Backup) ======
// document.addEventListener("keydown", (event) => {
//   switch (event.key) {
//     case "ArrowUp":
//       window.currentAction = "jump";
//       console.log("⌨️ KEYBOARD → JUMP");
//       break;
//     case "ArrowDown":
//       window.currentAction = "stop";
//       console.log("⌨️ KEYBOARD → STOP");
//       break;
//     case "ArrowLeft":
//       window.currentAction = "left";
//       console.log("⌨️ KEYBOARD → LEFT");
//       break;
//     case "ArrowRight":
//       window.currentAction = "right";
//       console.log("⌨️ KEYBOARD → RIGHT");
//       break;
//   }
// });

// document.addEventListener("keyup", () => {
//   window.currentAction = "none"; // stop action when key is released
// });

console.log("✅ Hand tracker initialized");
console.log("🖐️ Show ONE hand (left or right) to control");
console.log("   ☝️ Index finger = LEFT");
console.log("   ✌️ Peace sign = RIGHT");
console.log("   🖐️ Open palm = JUMP");
console.log("   ✊ Closed fist = STOP");

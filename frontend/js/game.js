// ====== Phaser Game Config ======
const config = {
  type: Phaser.AUTO,
  width: 640,
  height: 480,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.FIT
  },
  backgroundColor: "#202020",
  parent: "game-container",
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 800 }, debug: false }
  },
  scene: { preload, create, update }
};

// ====== Game Variables ======
let player, background;
let lanes = [];
let currentLane = 1;
let isJumping = false;

let lastGesture = "none";
let score = 0;
let hearts = 3;
let scoreText, heartsText, questionText;
let obstacles = [];
let quizData = [];
let currentQuestionIndex = 0;
let gameOver = false;

// Speed control
let GAME_SPEED = 20; // <-- change this to make game faster or slower
const MOVE_COOLDOWN = 300;
let lastMoveTime = 0;

// ====== Start Phaser ======
const game = new Phaser.Game(config);

// ====== Preload ======
function preload() {
  this.load.image("bg", "https://labs.phaser.io/assets/skies/space3.png");

  // Simple colored textures
  const g = this.add.graphics();
  g.fillStyle(0x00ccff, 1).fillRect(0, 0, 40, 60);
  g.generateTexture("player", 40, 60);
  g.clear();

  g.fillStyle(0xff5555, 1).fillRect(0, 0, 80, 40);
  g.generateTexture("obstacle", 80, 40);
  g.destroy();
}

// ====== Create ======
function create() {
  background = this.add.tileSprite(320, 240, 640, 480, "bg");
  lanes = [220, 320, 420];

  // Load questions from localStorage
  const stored = localStorage.getItem("handquest_questions");
  if (stored) quizData = JSON.parse(stored);
  else {
    quizData = [
      { question: "2+2?", correct_answer: "4", fake_answer_1: "3", fake_answer_2: "5" }
    ];
  }

  // Player setup
  player = this.physics.add.sprite(lanes[currentLane], 380, "player");
  player.setCollideWorldBounds(true);

  const ground = this.add.rectangle(320, 440, 640, 20, 0x000000, 0);
  this.physics.add.existing(ground, true);
  this.physics.add.collider(player, ground);

  // HUD
  scoreText = this.add.text(540, 10, "Score: 0", { fontSize: "18px", fill: "#fff" }).setOrigin(1, 0);
  heartsText = this.add.text(10, 10, "❤️❤️❤️", { fontSize: "20px", fill: "#ff5555" });
  questionText = this.add.text(320, 50, "", { fontSize: "20px", fill: "#fff" }).setOrigin(0.5);

  // Spawn first question
  spawnQuestion(this);

  // Debug key controls (optional)
  this.input.keyboard.on("keydown-LEFT", () => (window.currentAction = "left"));
  this.input.keyboard.on("keydown-RIGHT", () => (window.currentAction = "right"));
  this.input.keyboard.on("keydown-UP", () => (window.currentAction = "jump"));
  this.input.keyboard.on("keydown-DOWN", () => (window.currentAction = "stop"));
}

// ====== Spawn Question and Obstacles ======
function spawnQuestion(scene) {
  if (currentQuestionIndex >= quizData.length) {
    endGame(scene);
    return;
  }

  const q = quizData[currentQuestionIndex];
  questionText.setText(q.question);

  // Destroy all previous obstacles and texts
  obstacles.forEach(o => {
    if (o.answerText) o.answerText.destroy();
    o.destroy();
  });
  obstacles = [];

  // Prepare answers and shuffle
  const answers = [
    { text: q.correct_answer, correct: true },
    { text: q.fake_answer_1, correct: false },
    { text: q.fake_answer_2, correct: false }
  ];
  Phaser.Utils.Array.Shuffle(answers);

  // Create falling obstacles + answer labels
  for (let i = 0; i < 3; i++) {
    const obs = scene.physics.add.sprite(lanes[i], -100, "obstacle");
    const txt = scene.add.text(lanes[i], -140, answers[i].text, {
      fontSize: "16px",
      fill: "#fff"
    }).setOrigin(0.5);

    obs.answerText = txt;
    obs.correct = answers[i].correct;
    obs.setVelocityY(GAME_SPEED);
    obstacles.push(obs);

    scene.physics.add.overlap(player, obs, () => handleCollision(scene, obs));
  }
}

// ====== Handle Collision ======
function handleCollision(scene, obs) {
  if (gameOver) return;

  // Destroy both obstacle and text
  if (obs.answerText) obs.answerText.destroy();
  obs.destroy();
  obstacles = obstacles.filter(o => o !== obs);

  if (obs.correct) {
    score += 100;
    scoreText.setText("Score: " + score);
  } else {
    hearts--;
    heartsText.setText("❤️".repeat(hearts));
    if (hearts <= 0) {
      endGame(scene);
      return;
    }
  }

  // Next question
  currentQuestionIndex++;
  spawnQuestion(scene);
}

// ====== End Game ======
function endGame(scene) {
  gameOver = true;
  scene.physics.pause();

  const overlay = scene.add.rectangle(320, 240, 640, 480, 0x000000, 0.6);
  scene.add.text(320, 200, "Game Over!", { fontSize: "32px", fill: "#fff" }).setOrigin(0.5);
  scene.add.text(320, 250, "Score: " + score, { fontSize: "24px", fill: "#ff0" }).setOrigin(0.5);

  const restartBtn = scene.add.text(320, 300, "🔄 Restart", {
    fontSize: "22px",
    fill: "#00ffcc",
    backgroundColor: "#222",
    padding: { x: 10, y: 5 }
  })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on("pointerdown", () => {
      scene.scene.restart();
      score = 0;
      hearts = 3;
      currentQuestionIndex = 0;
      gameOver = false;
    });
}

// ====== Update ======
function update(time, delta) {
  if (gameOver) return;

  // Scroll background
  background.tilePositionY -= GAME_SPEED * 0.05;

  // Handle player movement
  const action = (window.currentAction || "none").toLowerCase();
  const isNewGesture = action !== lastGesture;

  if (isNewGesture && action === "left" && currentLane > 0) {
    currentLane--;
    moveToLane(this);
  }
  if (isNewGesture && action === "right" && currentLane < lanes.length - 1) {
    currentLane++;
    moveToLane(this);
  }
  if (isNewGesture && action === "jump" && player.body.touching.down && !isJumping) {
    isJumping = true;
    player.setVelocityY(-500);
  }
  
  if (player.body.touching.down) isJumping = false;
  lastGesture = action;

  // Keep answer texts with obstacles and clean up off-screen
  obstacles = obstacles.filter(obs => {
    if (!obs.active) return false;
    if (obs.answerText) obs.answerText.y = obs.y - 30;

    if (obs.y > 520) {
      if (obs.answerText) obs.answerText.destroy();
      obs.destroy();
      return false;
    }
    return true;
  });
}

// ====== Move to Lane ======
function moveToLane(scene) {
  scene.tweens.add({
    targets: player,
    x: lanes[currentLane],
    duration: 200,
    ease: "Power2"
  });
}

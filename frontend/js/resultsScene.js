/**
 * @class ResultsScene
 * @description This class represents the results/game-over screen.
 * It displays the final score to the player.
 */
class ResultsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultsScene' });
  }

  /**
   * @function preload
   * @description Loads all necessary assets for the results scene.
   */
  preload() {
    this.load.image('resultBackground', '/assets/sprites/environment/result.png');
    this.load.image('student', '/assets/sprites/player/player.png');
    this.load.image('scoreboard', '/assets/sprites/ui/scoreboard.png');
    this.load.image('studentCheer', '/assets/sprites/player/cheer.png'); 
    // Load the background music and sound effects
    this.load.audio('bgMusic', '/assets/audio/start.mp3');
    this.load.audio('hoverSound', '/assets/audio/hover.mp3');
    this.load.audio('clickSound', '/assets/audio/click.mp3');
  }

  /**
   * @function create
   * @description Initializes game objects and displays the final score.
   */
  create() {
    // --- Sound Setup ---
    this.bgMusic = this.sound.add('bgMusic', { loop: true, volume: 0.5 });
    this.bgMusic.play();

    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // Add the background image
    const bg = this.add.image(centerX, centerY, 'resultBackground');
    // Scale the background to fit the screen
    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const scale = Math.max(scaleX, scaleY);
    bg.setScale(scale).setScrollFactor(0);

    // Add a semi-transparent overlay to dim the background
    this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.5);

    // --- Confetti Effect ---
    // In newer Phaser versions, the emitter is created directly.
    this.add.particles(0, 0, '__DEFAULT', {
        x: { min: 0, max: width }, // Emit across the entire width of the screen
        y: -10, // Start just above the screen
        lifespan: 5000, // Particles last for 5 seconds
        speedY: { min: 100, max: 300 }, // Fall at different speeds
        speedX: { min: -50, max: 50 }, // Drift left and right
        angle: { min: 0, max: 360 }, // Start at random angles
        rotate: { start: 0, end: 360 }, // Rotate as they fall
        gravityY: 80, // A little bit of gravity
        scale: { start: 0.1, end: 0.8 }, // Start small and grow
        alpha: { start: 1, end: 0 }, // Fade out at the end
        quantity: 1,
        frequency: 100, // Emit a new particle every 100ms
        blendMode: 'ADD', // Bright, colorful blending
        tint: [0xff0000, 0xffa500, 0xffff00, 0x00ff00, 0x0000ff, 0x800080] // Rainbow colors
    }).setDepth(100); // Set a high depth to ensure it's visible on top of everything


    // --- Student Cheering Animation ---
    this.anims.create({
        key: 'cheer_animation',
        frames: [
            { key: 'student' },
            { key: 'studentCheer' }
        ],
        frameRate: 2,
        repeat: -1
    });
    
    const student = this.add.sprite(width * 0.20, height * 0.75, 'student').setScale(1);
    student.play('cheer_animation');


    // Get the score from the URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const score = urlParams.get('score') || 0;

    // --- Scoreboard and Text Animation ---
    const container = this.add.container(centerX, centerY - 10);
    const scoreboard = this.add.image(0, 0, 'scoreboard')
      .setOrigin(0.5, 0.45)
      .setScale(0.7);
      
    const scoreText = this.add.text(0, 85, `SCORE\n${score}`, {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: '50px',
      color: '#402c1b',
      align: 'center',
      lineSpacing: 15
    }).setOrigin(0.5);

    container.add([scoreboard, scoreText]);

    this.tweens.add({
      targets: container,
      angle: 5,
      ease: 'Sine.easeInOut',
      duration: 1800,
      delay: 100,
      yoyo: true,
      repeat: -1
    });


    const congratsText = this.add.text(centerX, height * 0.2, 'CONGRATULATIONS!', {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: '48px',
      color: '#ffbf00',
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5).setScale(0);

    this.tweens.add({
        targets: congratsText,
        scale: 1,
        ease: 'Back.easeOut',
        duration: 800,
        delay: 600
    });

    const playAgainText = this.add.text(centerX, height - 100, 'Click to Play Again', {
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '24px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playAgainText.on('pointerdown', () => {
        // Define start time and duration for the click sound
        const clickStartTime = 0.4;
        const clickPlayDuration = 0.8;
        this.sound.play('clickSound', { seek: clickStartTime, duration: clickPlayDuration });

        // Fade out the music before transitioning
        this.tweens.add({
            targets: this.bgMusic,
            volume: 0,
            duration: 800,
            ease: 'Linear'
        });

        this.tweens.add({
            targets: playAgainText,
            scale: 0.9,
            ease: 'Sine.easeInOut',
            duration: 100,
            yoyo: true,
            onComplete: () => {
                // Use a short delay to allow the music to fade
                this.time.delayedCall(800, () => {
                    window.location.href = '/upload';
                });
            }
        });
    });

    playAgainText.on('pointerover', () => {
        // Define start time and duration for the hover sound
        const hoverStartTime = 0.7;
        const hoverPlayDuration = 1;
        this.sound.play('hoverSound', { seek: hoverStartTime, duration: hoverPlayDuration });

        this.tweens.add({
            targets: playAgainText,
            scale: 1.1,
            duration: 200,
            ease: 'Sine.easeInOut'
        });
    });

    playAgainText.on('pointerout', () => {
        this.tweens.add({
            targets: playAgainText,
            scale: 1,
            duration: 200,
            ease: 'Sine.easeInOut'
        });
    });
  }
}

// Make the ResultsScene class available globally
window.ResultsScene = ResultsScene;


// StartScene - preloads assets and displays the Start Page UI with sound effects.
// Background music plays on load, with hover and click sounds on the start button.
// Music gracefully fades out during the transition to the next page.

class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' });
  }

  preload() {
    // load image assets from specified locations
    this.load.image('bg', '/assets/sprites/environment/background.png');
    this.load.image('startBtn', '/assets/sprites/ui/start.png');
    this.load.image('cat', '/assets/sprites/obstacles/cat.png');

    // load audio assets as requested
    this.load.audio('bgMusic', '/assets/audio/start.mp3');
    this.load.audio('hoverSound', '/assets/audio/hover.mp3');
    this.load.audio('clickSound', '/assets/audio/click.mp3');
  }

  create() {
    // --- Sound setup ---
    // Add background music, set it to loop, and play it immediately.
    this.bgMusic = this.sound.add('bgMusic', { loop: true, volume: 0.6 });
    this.bgMusic.play();

    // --- background setup ---
    const bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);

    // scale background to cover the canvas while preserving aspect ratio
    const scaleX = this.scale.width / bg.width;
    const scaleY = this.scale.height / bg.height;
    const bgScale = Math.max(scaleX, scaleY);
    bg.setScale(bgScale).setScrollFactor(0);

    // semi-transparent overlay for text readability
    const overlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0b1220, 0.36).setOrigin(0);

    // --- Title (two lines, all caps), top-center ---
    const topPadding = this.scale.height * 0.10; // top margin for title block

    const title1 = this.add.text(this.scale.width / 2, topPadding, 'HANDQUEST', {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: '100px',
      color: '#ffd166',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    const title2 = this.add.text(this.scale.width / 2, topPadding + 44, 'RUNNER', {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: '100px',
      color: '#ffb703',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: [title1, title2],
      y: `-=${6}`,
      ease: 'Sine.easeInOut',
      duration: 1200,
      yoyo: true,
      repeat: -1,
      delay: 80
    });

    // --- Start button: centered and modest size ---
    const baseBtnScale = 0.35;
    const btnY = this.scale.height * 0.70;
    const startBtn = this.add.image(this.scale.width / 2, btnY, 'startBtn')
      .setOrigin(0.5)
      .setScale(baseBtnScale);

    // Button is now interactive from the start.
    startBtn.setInteractive({ useHandCursor: true });

    this.tweens.add({
      targets: startBtn,
      scaleX: baseBtnScale * 1.02,
      scaleY: baseBtnScale * 1.02,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    startBtn.on('pointerover', () => {
      this.tweens.killTweensOf(startBtn);
      this.tweens.add({
        targets: startBtn,
        scaleX: baseBtnScale * 1.10,
        scaleY: baseBtnScale * 1.10,
        duration: 120,
        ease: 'Power1'
      });
      
      // To play a specific audio segment, you define a start time ('seek')
      // and a playback length ('duration'), both in seconds.
      const hoverStartTime = 0.7; // Example: start at 0.7 seconds
      const hoverPlayDuration = 1; // Example: play for 1 second
      this.sound.play('hoverSound', { seek: hoverStartTime, duration: hoverPlayDuration });
    });

    startBtn.on('pointerout', () => {
      this.tweens.killTweensOf(startBtn);
      this.tweens.add({
        targets: startBtn,
        scaleX: baseBtnScale * 1.02,
        scaleY: baseBtnScale * 1.02,
        duration: 160,
        ease: 'Power1'
      });
    });

    startBtn.on('pointerdown', () => {
      // Add the click animation
      this.tweens.add({
        targets: startBtn,
        scaleX: baseBtnScale * 1.25,
        scaleY: baseBtnScale * 1.25,
        duration: 120,
        yoyo: true,
        ease: "Power1",
      });
      
      // Define start time and duration for the click sound
      const clickStartTime = 0.4;
      const clickPlayDuration = 0.8;
      this.sound.play('clickSound', { seek: clickStartTime, duration: clickPlayDuration });

      // Disable the button to prevent multiple clicks during the transition
      startBtn.disableInteractive();

      this.tweens.add({
        targets: this.bgMusic,
        volume: 0,
        duration: 800,
        ease: 'Linear'
      });

      this.cameras.main.fadeOut(800, 0, 0, 0);
      this.time.delayedCall(800, () => {
        window.location.href = '/upload';
      });
    });

    // --- Cat sprite positioned slightly lower-left of the start button ---
    const catScale = 0.6;
    const catOffsetX = -(startBtn.displayWidth * 0.62);
    const catOffsetY = (startBtn.displayHeight * 0.28);
    const cat = this.add.image(startBtn.x + catOffsetX, startBtn.y + catOffsetY, 'cat').setOrigin(0.5).setScale(catScale);

    this.tweens.add({
      targets: cat,
      y: `-=${10}`,
      ease: 'Sine.easeInOut',
      duration: 1400,
      yoyo: true,
      repeat: -1
    });

    // --- Keyboard accessibility: Enter triggers start ---
    this.input.keyboard.on('keydown-ENTER', () => {
      window.location.href = '/upload.html';
    });

    // --- Keep elements responsive on resize ---
    const reposition = () => {
      const newScaleX = this.scale.width / bg.width;
      const newScaleY = this.scale.height / bg.height;
      const newBgScale = Math.max(newScaleX, newScaleY);
      bg.setScale(newBgScale).setScrollFactor(0);
      overlay.setSize(this.scale.width, this.scale.height);

      const titleTop = this.scale.height * 0.15;
      title1.setPosition(this.scale.width / 2, titleTop + 80);
      title2.setPosition(this.scale.width / 2, titleTop + 190);

      const newBtnY = this.scale.height * 0.70;
      startBtn.setPosition(this.scale.width / 2, newBtnY);

      const newCatOffsetX = -(startBtn.displayWidth * 0.80);
      const newCatOffsetY = (startBtn.displayHeight * 0.80);
      cat.setPosition(startBtn.x + newCatOffsetX, startBtn.y + newCatOffsetY);
    };

    this.scale.on('resize', () => {
      reposition();
    });

    reposition();
  }
}

// Expose scene globally so main.js can use it when initializing the game
window.StartScene = StartScene;


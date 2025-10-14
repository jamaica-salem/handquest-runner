window.addEventListener('load', () => {
  let scene;

  if (window.location.pathname.includes('/upload')) {
    scene = window.PdfUploadScene;
  } else if (window.location.pathname.includes('/game')) {
    scene = window.GameScene;
  } else if (window.location.pathname.includes('/results')) {
    scene = window.ResultsScene;
  } else {
    scene = window.StartScene;
  }

  if (!scene) {
    console.error('No valid Phaser scene found for this page.');
    return;
  }

  const config = {
    type: Phaser.AUTO,
    parent: 'phaser-container',
    pixelArt: true,
    backgroundColor: '#0f172a',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scene: [scene],
  };

  if (!window._handquestGame) {
    window._handquestGame = new Phaser.Game(config);
  }
});
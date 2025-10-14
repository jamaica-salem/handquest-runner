class PdfUploadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PdfUploadScene" });
  }

  preload() {
    this.load.image("lockers", "/assets/sprites/environment/lockers.png");
    // Load all three frames for the student animation
    this.load.image("student_1", "/assets/sprites/player/student.png");
    this.load.image("student_2", "/assets/sprites/player/student-1.png");
    this.load.image("student_3", "/assets/sprites/player/student-2.png");
    this.load.image("uploadBox", "/assets/sprites/ui/upload.png");
    this.load.image("pdfIcon", "/assets/sprites/ui/pdf.png");
    this.load.image("loading", "/assets/sprites/ui/loading.png");

    // Load audio assets
    this.load.audio('bgMusic', '/assets/audio/start.mp3');
    this.load.audio('hoverSound', '/assets/audio/hover.mp3');
    this.load.audio('clickSound', '/assets/audio/click.mp3');
  }

  create() {
    // --- Sound setup ---
    // Add background music, set it to loop, and play it immediately.
    this.bgMusic = this.sound.add('bgMusic', { loop: true, volume: 0.6 });
    this.bgMusic.play();

    const { width, height } = this.scale;

    // --- Student Animation ---
    // Create the animation using the preloaded images.
    this.anims.create({
      key: "student_speak",
      frames: [
        { key: "student_1" },
        { key: "student_2" },
        { key: "student_3" },
        { key: "student_2" },
      ],
      frameRate: 5,
      repeat: -1,
    });

    // --- Background (scaled like StartScene) ---
    const bg = this.add.image(0, 0, "lockers").setOrigin(0, 0);
    const scaleX = this.scale.width / bg.width;
    const scaleY = this.scale.height / bg.height;
    const bgScale = Math.max(scaleX, scaleY);
    bg.setScale(bgScale).setScrollFactor(0);

    // Subtle dark overlay for readability
    this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x0b1220, 0.25)
      .setOrigin(0);

    // --- Student (bottom-left corner, now an animated sprite) ---
    const student = this.add
      .sprite(this.scale.width * 0.13, this.scale.height * 0.9, "student_1")
      .setOrigin(0.5)
      .setScale(1.1);

    student.play("student_speak");

    this.uploadZone = this.add
      .image(this.scale.width / 2, this.scale.height * 0.45, "uploadBox")
      .setOrigin(0.5)
      .setScale(0.9)
      .setAlpha(0.98);

    this.floatingTween = this.tweens.add({
      targets: this.uploadZone,
      y: this.uploadZone.y - 10,
      rotation: Phaser.Math.DegToRad(1.5),
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // --- PDF button ---
    const pdfButton = this.add
      .image(width * 0.88, height * 0.73, "pdfIcon")
      .setOrigin(0.5)
      .setScale(0.9)
      .setAngle(8)
      .setInteractive({ useHandCursor: true });

    const basePdfScale = pdfButton.scale;

    this.tweens.add({
      targets: pdfButton,
      scaleX: basePdfScale * 1.05,
      scaleY: basePdfScale * 1.05,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    pdfButton.on("pointerover", () => {
      const hoverStartTime = 0.7;
      const hoverPlayDuration = 1;
      this.sound.play('hoverSound', { seek: hoverStartTime, duration: hoverPlayDuration });
      this.tweens.add({
        targets: pdfButton,
        angle: 12,
        duration: 200,
        ease: "Power2",
      });
    });

    pdfButton.on("pointerout", () => {
      this.tweens.add({
        targets: pdfButton,
        angle: 8,
        duration: 200,
        ease: "Power2",
      });
    });

    pdfButton.on("pointerdown", () => {
      const clickStartTime = 0.4;
      const clickPlayDuration = 0.8;
      this.sound.play('clickSound', { seek: clickStartTime, duration: clickPlayDuration });
      this.tweens.add({
        targets: pdfButton,
        scaleX: basePdfScale * 0.85,
        scaleY: basePdfScale * 0.85,
        duration: 120,
        yoyo: true,
        ease: "Power1",
      });
      openFileDialog();
    });

    const handleFileUpload = async (file) => {
      if (!file) return;

      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

      if (!isPdf) {
        console.warn("❌ Not a PDF file!");
        return;
      }

      this.floatingTween.pause();
      this.uploadZone.setTexture("loading");
      this.uploadZone.setRotation(0);

      this.loadingTween = this.tweens.add({
        targets: this.uploadZone,
        scale: 0.95,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      pdfButton.disableInteractive();

      try {
        const formData = new FormData();
        formData.append("file", file, file.name);

        const response = await fetch("http://localhost:8000/generate", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          console.error("❌ Upload failed with HTTP code:", response.status);
          return;
        }

        console.log(
          "PDF upload successful. Starting to process generated questions..."
        );

        const data = await response.json();
        if (data && data.questions && data.questions.length > 0) {
          localStorage.setItem(
            "handquest_questions",
            JSON.stringify(data.questions)
          );
          localStorage.setItem("uploaded_pdf_name", file.name);
          console.log(
            `✅ Upload and processing successful! ${data.questions.length} questions saved.`
          );

          // Gracefully fade out music and scene before transitioning
          this.tweens.add({
              targets: this.bgMusic,
              volume: 0,
              duration: 800,
              ease: 'Linear'
          });

          this.cameras.main.fadeOut(800, 0, 0, 0);
          this.time.delayedCall(800, () => {
              window.location.href = "/game";
          });

        } else {
          console.error(
            "❌ Upload succeeded but no questions returned. Backend data:",
            data
          );
        }
      } catch (err) {
        console.error("❌ Error during upload:", err);
      } finally {
        if (this.loadingTween) this.loadingTween.stop();
        this.uploadZone.setTexture("uploadBox");
        this.uploadZone.setScale(0.9);
        this.floatingTween.resume();
        pdfButton.setInteractive({ useHandCursor: true });
      }
    };

    const openFileDialog = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf";
      input.style.display = "none";
      input.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        handleFileUpload(file);
      };
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    };

    this.input.keyboard.on("keydown-ENTER", openFileDialog);

    const canvas = this.sys.game.canvas;
    let isOverUploadZone = false;

    const toGameCoords = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = this.scale.width / rect.width;
      const scaleY = this.scale.height / rect.height;
      return {
        gx: (clientX - rect.left) * scaleX,
        gy: (clientY - rect.top) * scaleY,
      };
    };

    const onDragOver = (e) => {
      e.preventDefault();
      if (!e.dataTransfer) return;
      e.dataTransfer.dropEffect = "copy";

      const { gx, gy } = toGameCoords(e.clientX, e.clientY);
      const bounds = this.uploadZone.getBounds();

      if (Phaser.Geom.Rectangle.Contains(bounds, gx, gy)) {
        if (!isOverUploadZone) {
          isOverUploadZone = true;
          this.uploadZone.setTint(0xffffaa);
          this.tweens.add({
            targets: this.uploadZone,
            scaleX: this.uploadZone.scale * 1.03,
            scaleY: this.uploadZone.scale * 1.03,
            duration: 140,
            ease: "Power1",
          });
        }
      } else if (isOverUploadZone) {
        isOverUploadZone = false;
        this.uploadZone.clearTint();
        this.tweens.add({
          targets: this.uploadZone,
          scaleX: 0.9,
          scaleY: 0.9,
          duration: 140,
          ease: "Power1",
        });
      }
    };

    const onDrop = (e) => {
      e.preventDefault();
      this.uploadZone.clearTint();
      const { gx, gy } = toGameCoords(e.clientX, e.clientY);
      const bounds = this.uploadZone.getBounds();
      if (Phaser.Geom.Rectangle.Contains(bounds, gx, gy)) {
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        handleFileUpload(file);
      }
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    this.events.on("shutdown", () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    });

    const reposition = () => {
      const { width, height } = this.scale;
      bg.setScale(Math.max(width / bg.width, height / bg.height));
      this.uploadZone.setPosition(width / 2, height * 0.45);
      student.setPosition(width * 0.13, height * 0.78);
      pdfButton.setPosition(width * 0.88, height * 0.73);
    };

    this.scale.on("resize", reposition);
    reposition();
  }
}

window.PdfUploadScene = PdfUploadScene;

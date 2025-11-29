# 🏃 HandQuest Runner: Education Meets Endless Runner

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-059785.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Phaser](https://img.shields.io/badge/Phaser-3.55.2-1497a8.svg?style=for-the-badge&logo=phaser&logoColor=white)](https://phaser.io/)
[![Hugging Face](https://img.shields.io/badge/LLM-TinyLlama-FFD700.svg?style=for-the-badge&logo=huggingface&logoColor=black)](https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0)

---

## ✨ Project Overview

**HandQuest Runner** is an innovative educational game that transforms static PDF study materials into an engaging, interactive experience. Users upload a PDF file, which is processed by a **TinyLlama-powered backend** to generate relevant multiple-choice questions (MCQs). These questions are then used as in-game obstacles in a **Phaser 3** endless runner game, combining learning with reflex-based gameplay.

### 💡 Key Features

* **PDF-to-MCQ Conversion:** Utilizes a fine-tuned **TinyLlama-1.1B-Chat** language model (LLM) for intelligent question generation from uploaded PDFs.
* **Advanced Text Preprocessing:** Includes noise removal, sentence scoring, and ranking to ensure the LLM receives the most information-dense text, resulting in higher-quality MCQs.
* **Dual-Stack Architecture:** A robust **FastAPI** backend handles the heavy-lifting of LLM inference and PDF processing, while a **Flask** server stitches the front-end Phaser game scenes together.
* **Educational Endless Runner:** A classic 3-lane runner game built with **Phaser 3**, where players dodge physical obstacles and answer knowledge-based questions by maneuvering their character.

---

## ➡️ User Flow: Study, Generate, and Play

The HandQuest Runner process is designed to seamlessly integrate document learning with dynamic gameplay:

### 1. 🏁 Start the Quest
The user clicks the **Start Button** on the main menu (`/`).

### 2. 📤 Upload Reviewer
The user is taken to the upload screen (`/upload`). They select a **PDF reviewer** file (study guide, notes, textbook chapter) via file upload or drag-and-drop.

### 3. 🧠 AI Generation & Processing
* The PDF is sent to the **FastAPI backend** (`/generate`).
* The backend extracts text, cleans document noise (headers/footers), and applies sentence ranking to select the most relevant content.
* The **TinyLlama LLM** uses the filtered text to generate 5 validated Multiple-Choice Questions (MCQs).
* The generated MCQs (question, choices, correct answer index) are saved locally for the game.

### 4. 🎮 Launch the Game
The application automatically redirects the user to the main game scene (`/game`) once the questions are ready.

### 5. 👋 Hand Gesture Gameplay
The core game is a 3-lane endless runner:
* The character is controlled using **hand gestures** (or keyboard inputs as a fallback) detected by the application (e.g., swiping left/right to change lanes, swiping up to jump).
* **Obstacles**: The player must avoid common obstacles (like bags, books, or cats) to preserve their lives.
* **MCQs as Challenges**: The generated MCQs appear as obstacles in the three lanes. The player must use their hand gestures to navigate the character into the lane containing the **correct answer** to score points. Hitting a wrong answer causes a loss of life.

### 6. 🏆 View Results
Upon losing all lives, the game ends, and the user is redirected to the results page (`/results`) to see their final score.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Backend API** | `FastAPI`, `uvicorn` | High-performance Python server for question generation. |
| **LLM / AI** | `TinyLlama-1.1B-Chat`, `transformers`, `torch` | Open-source LLM for text summarization and MCQ creation. Supports both **CPU** and **GPU** inference. |
| **PDF Processing** | `pdfplumber` | Library for reliably extracting text content from PDF documents. |
| **Frontend Game** | `Phaser 3` (JavaScript) | The main game engine for the interactive runner experience. |
| **Web Server** | `Flask` (Python) | Serves the static Phaser front-end pages (`index.html`, `upload.html`, etc.). |

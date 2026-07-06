import {
  FIXED_DT,
  botInput,
  countAliveBricks,
  createGame,
  evaluateBot,
  resetGame,
  serve,
  step
} from "./game.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const livesEl = document.querySelector("#lives");
const levelEl = document.querySelector("#level");
const bricksEl = document.querySelector("#bricks");
const botRatingEl = document.querySelector("#botRating");
const botToggle = document.querySelector("#botToggle");
const serveBtn = document.querySelector("#serveBtn");
const restartBtn = document.querySelector("#restartBtn");
const measureBtn = document.querySelector("#measureBtn");
const leftBtn = document.querySelector("#leftBtn");
const rightBtn = document.querySelector("#rightBtn");

const game = createGame(20260706);
const keys = new Set();
const touch = { left: false, right: false };
let accumulator = 0;
let previousTime = performance.now();

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === "Space") serve(game);
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => keys.delete(event.code));

bindHoldButton(leftBtn, "left");
bindHoldButton(rightBtn, "right");

serveBtn.addEventListener("click", () => serve(game));
restartBtn.addEventListener("click", () => resetGame(game, 20260706));
measureBtn.addEventListener("click", () => {
  const report = evaluateBot({ seed: 20260706, games: 12 });
  const score = Math.round(report.averageScore);
  const clearRate = Math.round(report.clearRate * 100);
  botRatingEl.textContent = `${score}점 평균 · 클리어 ${clearRate}%`;
  console.table(report.results);
});

requestAnimationFrame(loop);

function loop(now) {
  accumulator += Math.min(0.1, (now - previousTime) / 1000);
  previousTime = now;

  while (accumulator >= FIXED_DT) {
    const input = readInput();
    if (input.serve) serve(game);
    step(game, FIXED_DT, input);
    accumulator -= FIXED_DT;
  }

  render();
  syncHud();
  requestAnimationFrame(loop);
}

function readInput() {
  if (botToggle.checked) return botInput(game);
  return {
    left: touch.left || keys.has("ArrowLeft") || keys.has("KeyA"),
    right: touch.right || keys.has("ArrowRight") || keys.has("KeyD"),
    serve: false
  };
}

function bindHoldButton(button, direction) {
  const set = (value) => {
    touch[direction] = value;
  };
  button.addEventListener("pointerdown", () => set(true));
  button.addEventListener("pointerup", () => set(false));
  button.addEventListener("pointercancel", () => set(false));
  button.addEventListener("pointerleave", () => set(false));
}

function syncHud() {
  scoreEl.textContent = game.score.toLocaleString("ko-KR");
  livesEl.textContent = game.lives;
  levelEl.textContent = game.level;
  bricksEl.textContent = countAliveBricks(game);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawWalls();
  drawBricks();
  drawPaddle();
  drawBall();
  drawStatus();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#16191f");
  gradient.addColorStop(1, "#242832");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let y = 44; y < canvas.height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawWalls() {
  ctx.fillStyle = "#88909f";
  ctx.fillRect(0, 0, canvas.width, 18);
  ctx.fillRect(0, 0, 18, canvas.height);
  ctx.fillRect(canvas.width - 18, 0, 18, canvas.height);

  ctx.fillStyle = "#c4cad5";
  ctx.fillRect(18, 4, canvas.width - 36, 4);
}

function drawBricks() {
  for (const brick of game.bricks) {
    if (!brick.alive) continue;
    ctx.fillStyle = brick.hits < brick.maxHits ? "#f2f2e8" : brick.color;
    roundedRect(brick.x, brick.y, brick.w, brick.h, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(brick.x + 4, brick.y + 4, brick.w - 8, 3);
  }
}

function drawPaddle() {
  const { paddle } = game;
  ctx.fillStyle = "#f0f1e7";
  roundedRect(paddle.x, paddle.y, paddle.w, paddle.h, 7);
  ctx.fill();
  ctx.fillStyle = "#d94f45";
  roundedRect(paddle.x + paddle.w / 2 - 18, paddle.y + 3, 36, paddle.h - 6, 5);
  ctx.fill();
}

function drawBall() {
  const { ball } = game;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = "#f6f5db";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawStatus() {
  if (game.status === "playing") return;
  const messages = {
    ready: "Space 또는 서브",
    won: "클리어",
    lost: "게임 오버"
  };
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  roundedRect(canvas.width / 2 - 150, canvas.height / 2 - 32, 300, 64, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(messages[game.status], canvas.width / 2, canvas.height / 2);
}

function roundedRect(x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

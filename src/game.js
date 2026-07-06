export const WIDTH = 960;
export const HEIGHT = 640;
export const FIXED_DT = 1 / 120;

const BRICK_ROWS = 8;
const BRICK_COLS = 14;
const BRICK_GAP = 6;
const BRICK_TOP = 76;
const BRICK_LEFT = 54;
const BRICK_W = 56;
const BRICK_H = 22;
const WALL = 18;
const MAX_BOUNCE = (70 * Math.PI) / 180;

const ROW_SCORES = [7, 7, 5, 5, 3, 3, 1, 1];
const ROW_COLORS = [
  "#d94f45",
  "#d94f45",
  "#e1a637",
  "#e1a637",
  "#4ea36b",
  "#4ea36b",
  "#4a7cc7",
  "#4a7cc7"
];

export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGame(seed = 1) {
  const rng = mulberry32(seed);
  const state = {
    width: WIDTH,
    height: HEIGHT,
    seed,
    rng,
    status: "ready",
    score: 0,
    lives: 3,
    level: 1,
    tick: 0,
    paddle: {
      x: WIDTH / 2 - 58,
      y: HEIGHT - 54,
      w: 116,
      h: 14,
      speed: 560
    },
    ball: {
      x: WIDTH / 2,
      y: HEIGHT - 74,
      r: 8,
      vx: 0,
      vy: 0,
      speed: 330,
      stuck: true
    },
    bricks: createBricks(1),
    events: []
  };
  return state;
}

export function createBricks(level = 1) {
  const bricks = [];
  const durability = level >= 3 ? 2 : 1;
  for (let row = 0; row < BRICK_ROWS; row += 1) {
    for (let col = 0; col < BRICK_COLS; col += 1) {
      const hard = durability > 1 && row < 2;
      bricks.push({
        id: `${row}-${col}`,
        row,
        col,
        x: BRICK_LEFT + col * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + row * (BRICK_H + BRICK_GAP),
        w: BRICK_W,
        h: BRICK_H,
        hits: hard ? 2 : 1,
        maxHits: hard ? 2 : 1,
        score: ROW_SCORES[row],
        color: ROW_COLORS[row],
        alive: true
      });
    }
  }
  return bricks;
}

export function serve(state) {
  if (state.status === "won" || state.status === "lost") return;
  const variance = (state.rng() - 0.5) * 0.32;
  const angle = -Math.PI / 2 + variance;
  state.ball.vx = Math.cos(angle) * state.ball.speed;
  state.ball.vy = Math.sin(angle) * state.ball.speed;
  state.ball.stuck = false;
  state.status = "playing";
}

export function resetGame(state, seed = state.seed) {
  const fresh = createGame(seed);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, fresh);
  return state;
}

export function countAliveBricks(state) {
  return state.bricks.reduce((sum, brick) => sum + (brick.alive ? 1 : 0), 0);
}

export function step(state, dt, input = { left: false, right: false }) {
  state.events = [];
  state.tick += 1;
  movePaddle(state, dt, input);

  if (state.ball.stuck) {
    state.ball.x = state.paddle.x + state.paddle.w / 2;
    state.ball.y = state.paddle.y - state.ball.r - 2;
    return state;
  }

  moveBallSubstepped(state, dt);
  if (countAliveBricks(state) === 0) advanceLevel(state);
  return state;
}

function movePaddle(state, dt, input) {
  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  state.paddle.x += direction * state.paddle.speed * dt;
  state.paddle.x = clamp(state.paddle.x, WALL, state.width - WALL - state.paddle.w);
}

function moveBallSubstepped(state, dt) {
  const distance = Math.hypot(state.ball.vx, state.ball.vy) * dt;
  const steps = Math.max(1, Math.ceil(distance / (state.ball.r * 0.75)));
  const slice = dt / steps;
  for (let i = 0; i < steps; i += 1) {
    state.ball.x += state.ball.vx * slice;
    state.ball.y += state.ball.vy * slice;
    collideWalls(state);
    collidePaddle(state);
    collideBricks(state);
    if (state.ball.y - state.ball.r > state.height) {
      loseBall(state);
      break;
    }
  }
}

function collideWalls(state) {
  const ball = state.ball;
  if (ball.x - ball.r < WALL) {
    ball.x = WALL + ball.r;
    ball.vx = Math.abs(ball.vx);
    state.events.push("wall");
  }
  if (ball.x + ball.r > state.width - WALL) {
    ball.x = state.width - WALL - ball.r;
    ball.vx = -Math.abs(ball.vx);
    state.events.push("wall");
  }
  if (ball.y - ball.r < WALL) {
    ball.y = WALL + ball.r;
    ball.vy = Math.abs(ball.vy);
    state.events.push("ceiling");
  }
}

function collidePaddle(state) {
  const { ball, paddle } = state;
  if (ball.vy <= 0) return;
  if (!circleRectOverlap(ball, paddle)) return;

  const relative = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
  const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.018, 620);
  const angle = -Math.PI / 2 + relative * MAX_BOUNCE;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.y = paddle.y - ball.r - 0.1;
  state.events.push("paddle");
}

function collideBricks(state) {
  const ball = state.ball;
  for (const brick of state.bricks) {
    if (!brick.alive || !circleRectOverlap(ball, brick)) continue;

    const prevX = ball.x - ball.vx * FIXED_DT;
    const prevY = ball.y - ball.vy * FIXED_DT;
    const fromSide = prevX + ball.r <= brick.x || prevX - ball.r >= brick.x + brick.w;
    const fromTopBottom = prevY + ball.r <= brick.y || prevY - ball.r >= brick.y + brick.h;

    if (fromSide && !fromTopBottom) ball.vx *= -1;
    else ball.vy *= -1;

    brick.hits -= 1;
    state.score += brick.score;
    if (brick.hits <= 0) {
      brick.alive = false;
      state.events.push("brick");
    } else {
      state.events.push("brick-hit");
    }
    return;
  }
}

function loseBall(state) {
  state.lives -= 1;
  state.events.push("lost-ball");
  if (state.lives <= 0) {
    state.status = "lost";
    state.ball.stuck = true;
    state.ball.vx = 0;
    state.ball.vy = 0;
    return;
  }
  state.status = "ready";
  state.ball.stuck = true;
  state.ball.speed = Math.max(330, state.ball.speed * 0.96);
  state.ball.vx = 0;
  state.ball.vy = 0;
}

function advanceLevel(state) {
  state.level += 1;
  if (state.level > 5) {
    state.status = "won";
    state.ball.stuck = true;
    return;
  }
  state.bricks = createBricks(state.level);
  state.ball.speed = Math.min(330 + (state.level - 1) * 42, 520);
  state.status = "ready";
  state.ball.stuck = true;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.events.push("level");
}

export function botInput(state) {
  if (state.ball.stuck) return { left: false, right: false, serve: true };

  const targetX = predictPaddleIntercept(state);
  const paddleCenter = state.paddle.x + state.paddle.w / 2;
  const deadZone = 7;
  return {
    left: targetX < paddleCenter - deadZone,
    right: targetX > paddleCenter + deadZone,
    serve: false
  };
}

export function predictPaddleIntercept(state) {
  const { ball, paddle } = state;
  if (ball.vy <= 0) return ball.x;

  const t = (paddle.y - ball.r - ball.y) / ball.vy;
  let projected = ball.x + ball.vx * Math.max(0, t);
  const min = WALL + ball.r;
  const max = state.width - WALL - ball.r;
  const span = max - min;
  projected = min + positiveMod(projected - min, span * 2);
  if (projected > max) projected = max - (projected - max);
  return projected;
}

export function evaluateBot({ seed = 20260706, games = 12, maxTicks = 72000 } = {}) {
  const results = [];
  for (let i = 0; i < games; i += 1) {
    const game = createGame(seed + i);
    let ticks = 0;
    while (ticks < maxTicks && game.status !== "lost" && game.status !== "won") {
      const input = botInput(game);
      if (input.serve) serve(game);
      step(game, FIXED_DT, input);
      ticks += 1;
    }
    results.push({
      seed: seed + i,
      score: game.score,
      level: game.level,
      cleared: game.status === "won",
      lives: game.lives,
      ticks,
      bricksRemaining: countAliveBricks(game)
    });
  }

  const averageScore = average(results.map((result) => result.score));
  const clearRate = results.filter((result) => result.cleared).length / games;
  const averageLevel = average(results.map((result) => result.level));
  return { seed, games, averageScore, averageLevel, clearRate, results };
}

function circleRectOverlap(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

function positiveMod(value, mod) {
  return ((value % mod) + mod) % mod;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

import assert from "node:assert/strict";
import test from "node:test";
import {
  FIXED_DT,
  botInput,
  countAliveBricks,
  createGame,
  evaluateBot,
  serve,
  step
} from "../src/game.js";

test("uses standard row score bands", () => {
  const game = createGame(1);
  const rowScores = [...new Set(game.bricks.map((brick) => `${brick.row}:${brick.score}`))];

  assert.deepEqual(rowScores, [
    "0:7",
    "1:7",
    "2:5",
    "3:5",
    "4:3",
    "5:3",
    "6:1",
    "7:1"
  ]);
});

test("wall cushions reflect the ball", () => {
  const game = createGame(1);
  game.status = "playing";
  game.ball.stuck = false;
  game.ball.x = 20;
  game.ball.y = 320;
  game.ball.vx = -250;
  game.ball.vy = 0;

  step(game, FIXED_DT, {});

  assert.equal(game.ball.vx > 0, true);
  assert.equal(game.events.includes("wall"), true);
});

test("paddle hit changes angle based on impact point", () => {
  const game = createGame(1);
  game.status = "playing";
  game.ball.stuck = false;
  game.ball.x = game.paddle.x + game.paddle.w - 8;
  game.ball.y = game.paddle.y - 5;
  game.ball.vx = 0;
  game.ball.vy = 320;

  step(game, FIXED_DT, {});

  assert.equal(game.ball.vy < 0, true);
  assert.equal(game.ball.vx > 0, true);
});

test("brick collision awards score and removes brick", () => {
  const game = createGame(1);
  const brick = game.bricks.find((item) => item.row === 0 && item.col === 0);
  game.status = "playing";
  game.ball.stuck = false;
  game.ball.x = brick.x + brick.w / 2;
  game.ball.y = brick.y + brick.h + game.ball.r - 1;
  game.ball.vx = 0;
  game.ball.vy = -300;

  step(game, FIXED_DT, {});

  assert.equal(brick.alive, false);
  assert.equal(game.score, 7);
  assert.equal(countAliveBricks(game), 111);
});

test("bot evaluation is deterministic for the same seed", () => {
  const a = evaluateBot({ seed: 42, games: 4, maxTicks: 20000 });
  const b = evaluateBot({ seed: 42, games: 4, maxTicks: 20000 });

  assert.deepEqual(a, b);
});

test("bot tracks predicted intercept and can play without manual input", () => {
  const game = createGame(8);
  serve(game);

  for (let i = 0; i < 500; i += 1) {
    const input = botInput(game);
    step(game, FIXED_DT, input);
  }

  assert.equal(game.score > 0, true);
  assert.equal(game.lives >= 1, true);
});

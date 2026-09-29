import { test } from "node:test";
import assert from "node:assert/strict";
import { ScoreGame, rollMarks } from "../src/game/scoring";
const play = (rolls: number[]) => {
  const g = new ScoreGame();
  rolls.forEach((r) => g.roll(r));
  return g;
};
test("twenty gutters: zero and completed tenth", () => {
  const g = play(Array(20).fill(0));
  assert.equal(g.done, true);
  assert.equal(g.total, 0);
  assert.equal(g.frames.length, 10);
});
test("perfect game: twelve strikes and 300", () => {
  const g = play(Array(12).fill(10));
  assert.equal(g.done, true);
  assert.equal(g.total, 300);
  assert.deepEqual(
    g.scorecard().map((f) => f.total),
    [30, 60, 90, 120, 150, 180, 210, 240, 270, 300],
  );
});
test("all five-pin spares: 150", () => {
  assert.equal(play(Array(21).fill(5)).total, 150);
});
test("strike waits for two bonuses, spare waits for one", () => {
  const g = play([10, 10]);
  assert.equal(g.scorecard()[0].score, null);
  g.roll(4);
  assert.equal(g.scorecard()[0].score, 24);
  assert.equal(g.scorecard()[1].score, null);
  g.roll(6);
  assert.equal(g.scorecard()[1].score, 20);
  assert.equal(g.scorecard()[2].score, null);
  g.roll(3);
  assert.equal(g.scorecard()[2].score, 13);
});
test("tenth open frame has no bonus", () => {
  const g = play([...Array(18).fill(0), 4, 5]);
  assert.equal(g.done, true);
  assert.equal(g.total, 9);
  assert.throws(() => g.roll(1));
});
test("tenth spare grants one fresh rack only", () => {
  const g = play([...Array(18).fill(0), 6, 4]);
  assert.equal(g.done, false);
  assert.equal(g.remaining, 10);
  g.roll(10);
  assert.equal(g.done, true);
  assert.equal(g.total, 20);
});
test("tenth strike preserves second bonus standing pins", () => {
  const g = play([...Array(18).fill(0), 10, 7]);
  assert.equal(g.remaining, 3);
  assert.throws(() => g.roll(4));
  g.roll(3);
  assert.equal(g.total, 20);
  assert.equal(g.done, true);
});
test("tenth double strike gets fresh third rack", () => {
  const g = play([...Array(18).fill(0), 10, 10]);
  assert.equal(g.remaining, 10);
  g.roll(8);
  assert.equal(g.total, 28);
});
test("gutter then ten is a spare, including after tenth strike", () => {
  const g = new ScoreGame();
  g.roll(0);
  const result = g.roll(10);
  assert.equal(result.strike, false);
  assert.equal(result.spare, true);
  assert.deepEqual(rollMarks([10, 0, 10], true), ["X", "–", "/"]);
  assert.deepEqual(rollMarks([0, 10, 10], true), ["–", "/", "X"]);
});
test("reject negative, fractional, oversized and post-game rolls", () => {
  const g = new ScoreGame();
  for (const n of [-1, 11, 0.5, NaN]) assert.throws(() => g.roll(n));
  g.roll(7);
  assert.throws(() => g.roll(4));
});
test("mixed known game", () => {
  assert.equal(
    play([10, 7, 3, 9, 0, 10, 0, 8, 8, 2, 0, 6, 10, 10, 10, 8, 1]).total,
    167,
  );
});
test("a zero first delivery preserves its rack, including tenth-frame bonuses", () => {
  const g = new ScoreGame();
  assert.equal(g.roll(0).freshRack, false);
  g.roll(0);
  for (let i = 1; i < 9; i++) {
    g.roll(0);
    g.roll(0);
  }
  assert.equal(g.roll(10).freshRack, true);
  assert.equal(g.roll(0).freshRack, false);
});

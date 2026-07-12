import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildValidSectionSet, median } from "./scoring";

describe("buildValidSectionSet", () => {
  it("includes full labels and parent prefixes", () => {
    const sections = buildValidSectionSet(["III.B.8 Coverage", "IV.14 Limits"]);
    assert.equal(sections.has("III.B.8"), true);
    assert.equal(sections.has("III.B"), true);
    assert.equal(sections.has("III"), true);
    assert.equal(sections.has("IV.14"), true);
    assert.equal(sections.has("IV"), true);
    assert.equal(sections.has("V"), false);
  });

  it("skips null labels", () => {
    const sections = buildValidSectionSet([null, "II.A.1 Intro"]);
    assert.equal(sections.size, 3);
    assert.equal(sections.has("II.A.1"), true);
    assert.equal(sections.has("II.A"), true);
    assert.equal(sections.has("II"), true);
  });
});

describe("median", () => {
  it("returns the middle value for odd-length input", () => {
    assert.equal(median([3, 1, 2]), 2);
  });

  it("returns the rounded average of two middle values for even-length input", () => {
    assert.equal(median([4, 1, 3, 2]), 3);
  });

  it("returns 0 for an empty list", () => {
    assert.equal(median([]), 0);
  });
});

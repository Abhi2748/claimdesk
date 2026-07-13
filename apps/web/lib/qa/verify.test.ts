import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PolicyCitation } from "./types";
import { verifyCitations } from "./verify";

function chunk(p: Partial<PolicyCitation>): PolicyCitation {
  return { id: 1, sectionLabel: "III.B.8 Special Limits", pageStart: 6, pageEnd: 6,
           content: "text", similarity: 0.9, ...p };
}

describe("verifyCitations", () => {
  it("verifies a citation matching label + page", () => {
    const r = verifyCitations("Special limits apply [III.B.8, p.6].", [chunk({})]);
    assert.equal(r.verifiedCount, 1);
    assert.equal(r.allVerified, true);
    assert.ok(r.citations[0]!.source);
  });
  it("flags an invented section as unverified", () => {
    const r = verifyCitations("Coverage exists [IX.Z.1, p.99].", [chunk({})]);
    assert.equal(r.citations[0]!.status, "unverified");
    assert.equal(r.allVerified, false);
  });
  it("matches a parent-section citation to a specific chunk", () => {
    assert.equal(verifyCitations("See [III.B, p.6].", [chunk({})]).citations[0]!.status, "verified");
  });
  it("flags right-section wrong-page as unverified", () => {
    assert.equal(verifyCitations("See [III.B.8, p.40].", [chunk({})]).citations[0]!.status, "unverified");
  });
  it("dedupes repeated markers", () => {
    assert.equal(verifyCitations("[III.B.8, p.6] and [III.B.8, p.6]", [chunk({})]).totalCount, 1);
  });
  it("ignores non-citation brackets", () => {
    assert.equal(verifyCitations("A note [see below].", [chunk({})]).totalCount, 0);
  });
  it("handles a page range overlap", () => {
    const r = verifyCitations("[II.A, p.3-4]", [chunk({ sectionLabel: "II.A Intro", pageStart: 4, pageEnd: 5 })]);
    assert.equal(r.citations[0]!.status, "verified");
  });
});

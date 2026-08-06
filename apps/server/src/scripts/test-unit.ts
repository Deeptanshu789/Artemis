import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ScoringResultSchema,
  interviewerTalkShare,
  WsClientMessageSchema,
} from "@artemis/shared";
import { demoScoring } from "../services/scoring.js";
import { maybeTalkRatioNudge, resetNudge } from "../services/talkRatio.js";

describe("scoring schema", () => {
  it("parses demo scoring", () => {
    const result = demoScoring([
      { id: "1", speaker: "interviewer", text: "Tell me about yourself." },
      { id: "2", speaker: "candidate", text: "I am an engineer." },
    ]);
    assert.equal(ScoringResultSchema.safeParse(result).success, true);
    assert.ok(result.overall_score >= 0 && result.overall_score <= 100);
  });
});

describe("talk ratio", () => {
  it("computes interviewer share", () => {
    const share = interviewerTalkShare([
      { speaker: "interviewer", text: "aaaa" },
      { speaker: "candidate", text: "aa" },
    ]);
    assert.equal(share, 4 / 6);
  });

  it("nudges when interviewer dominates", () => {
    resetNudge("s1");
    const segments = [
      { id: "1", speaker: "interviewer" as const, text: "x".repeat(80) },
      { id: "2", speaker: "candidate" as const, text: "y".repeat(10) },
      { id: "3", speaker: "interviewer" as const, text: "x".repeat(80) },
      { id: "4", speaker: "candidate" as const, text: "y".repeat(10) },
    ];
    const nudge = maybeTalkRatioNudge("s1", segments);
    assert.ok(nudge);
    assert.ok(nudge!.interviewerShare >= 0.7);
    assert.equal(maybeTalkRatioNudge("s1", segments), null); // cooldown
  });
});

describe("ws client schema", () => {
  it("accepts linear16 start", () => {
    const parsed = WsClientMessageSchema.safeParse({
      type: "start",
      sessionId: "11111111-1111-1111-1111-111111111111",
      encoding: "linear16",
      sampleRate: 16000,
    });
    assert.equal(parsed.success, true);
  });
});

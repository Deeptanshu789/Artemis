/**
 * E2E fixture: create session → inject transcript → finalize → print scoring.
 * Run with DEMO_MODE=true (no Deepgram/Mistral required).
 */
import { randomUUID } from "node:crypto";
import { createRuntimeSession } from "../ws/audio.js";
import { setMemorySession, getMemorySession } from "../services/sessionStore.js";
import { DeepgramSession } from "../services/deepgram.js";
import { finalizeSession, registerDeepgram } from "../services/finalize.js";

async function main() {
  process.env.DEMO_MODE = "true";
  const id = randomUUID();
  const session = createRuntimeSession(id, "demo-fixture", "Demo Interviewer");
  session.candidate_label = "Demo Interviewee";
  setMemorySession(session);

  const dg = new DeepgramSession(id, () => undefined);
  registerDeepgram(id, dg);
  dg.injectSegment("Hi, thanks for coming in. Walk me through your last role.", "interviewer");
  dg.injectSegment("I led a payments team of six for two years.", "candidate");
  dg.injectSegment("What was the hardest tradeoff you made?", "interviewer");
  dg.injectSegment("We delayed a feature to fix fraud false positives.", "candidate");
  dg.injectSegment("Great. Do you have questions for me?", "interviewer");
  dg.injectSegment("How do you measure interview quality on this team?", "candidate");

  const result = await finalizeSession(id);
  console.log(JSON.stringify({ sessionId: id, status: result?.status, scoring: result?.scoring }, null, 2));
  if (result?.status !== "ready") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

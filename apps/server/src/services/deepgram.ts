import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { randomUUID } from "node:crypto";
import type { TranscriptSegment } from "@artemis/shared";
import { env } from "../config.js";
import { appendSegment, getMemorySession, log, patchSession } from "./sessionStore.js";

export type TranscriptHandler = (segment: TranscriptSegment) => void;

export type DeepgramStartOpts = {
  encoding?: "linear16" | "webm";
  sampleRate?: number;
  mimeType?: string;
};

export class DeepgramSession {
  private connection: ReturnType<ReturnType<typeof createClient>["listen"]["live"]> | null = null;
  private closed = false;

  constructor(
    private sessionId: string,
    private onTranscript: TranscriptHandler,
  ) {}

  start(opts: DeepgramStartOpts = {}): void {
    if (env.demoMode || !env.deepgramApiKey) {
      log(this.sessionId, "deepgram_skipped_demo");
      return;
    }

    const deepgram = createClient(env.deepgramApiKey);
    const encoding = opts.encoding ?? "linear16";
    const sampleRate = opts.sampleRate ?? 16000;

    const liveOpts: Record<string, unknown> = {
      model: "nova-2",
      language: "en",
      smart_format: true,
      diarize: true,
      interim_results: false,
      punctuate: true,
    };

    if (encoding === "linear16") {
      liveOpts.encoding = "linear16";
      liveOpts.sample_rate = sampleRate;
      liveOpts.channels = 1;
    }

    this.connection = deepgram.listen.live(liveOpts as Parameters<typeof deepgram.listen.live>[0]);

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      log(this.sessionId, "deepgram_open", { encoding, sampleRate });
      patchSession(this.sessionId, { status: "transcribing" });
    });

    this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
      try {
        const alt = data?.channel?.alternatives?.[0];
        const text = alt?.transcript?.trim();
        if (!text) return;

        const words = alt?.words ?? [];
        const speakerIndex =
          typeof words[0]?.speaker === "number" ? words[0].speaker : 0;

        const runtime = getMemorySession(this.sessionId);
        if (!runtime) return;

        if (runtime.firstSpeakerIndex === undefined) {
          runtime.firstSpeakerIndex = speakerIndex;
          runtime.speakerMap.set(speakerIndex, "interviewer");
        }
        if (!runtime.speakerMap.has(speakerIndex)) {
          const role = speakerIndex === runtime.firstSpeakerIndex ? "interviewer" : "candidate";
          runtime.speakerMap.set(speakerIndex, role);
        }
        const speaker = runtime.speakerMap.get(speakerIndex) ?? "unknown";

        const segment: TranscriptSegment = {
          id: randomUUID(),
          speaker,
          speakerIndex,
          text,
          startMs: words[0]?.start != null ? Math.round(words[0].start * 1000) : undefined,
          endMs:
            words[words.length - 1]?.end != null
              ? Math.round(words[words.length - 1].end * 1000)
              : undefined,
          confidence: alt?.confidence,
        };
        appendSegment(this.sessionId, segment);
        this.onTranscript(segment);
      } catch (err) {
        log(this.sessionId, "deepgram_transcript_error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    this.connection.on(LiveTranscriptionEvents.Error, (err) => {
      log(this.sessionId, "deepgram_error", { error: String(err) });
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      log(this.sessionId, "deepgram_close");
      this.closed = true;
    });
  }

  sendAudio(buffer: Buffer): void {
    if (this.closed || !this.connection) return;
    try {
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      this.connection.send(ab);
    } catch (err) {
      log(this.sessionId, "deepgram_send_error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  injectSegment(text: string, speaker: "interviewer" | "candidate"): TranscriptSegment {
    const segment: TranscriptSegment = {
      id: randomUUID(),
      speaker,
      text,
    };
    appendSegment(this.sessionId, segment);
    this.onTranscript(segment);
    return segment;
  }

  async finish(): Promise<void> {
    if (!this.connection || this.closed) return;
    try {
      const conn = this.connection as {
        requestClose?: () => void;
        finish?: () => void;
        close?: () => void;
      };
      conn.requestClose?.();
      conn.finish?.();
      conn.close?.();
    } catch {
      /* ignore */
    }
    this.closed = true;
  }
}

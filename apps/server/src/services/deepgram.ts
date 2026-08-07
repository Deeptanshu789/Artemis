import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { randomUUID } from "node:crypto";
import type { TranscriptSegment } from "@artemis/shared";
import { env } from "../config.js";
import { appendSegment, getMemorySession, log, patchSession } from "./sessionStore.js";

export type TranscriptHandler = (segment: TranscriptSegment) => void;
export type DeepgramErrorHandler = (message: string) => void;

export type DeepgramStartOpts = {
  encoding?: "linear16" | "webm";
  sampleRate?: number;
  mimeType?: string;
};

function formatDgError(err: unknown): string {
  if (err == null) return "unknown";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : "";
    return causeMsg ? `${err.message} (${causeMsg})` : err.message;
  }
  const anyErr = err as {
    message?: string;
    error?: string | Error;
    type?: string;
    reason?: string;
    code?: string | number;
  };
  if (typeof anyErr.message === "string" && anyErr.message) return anyErr.message;
  if (typeof anyErr.error === "string") return anyErr.error;
  if (anyErr.error instanceof Error) return anyErr.error.message;
  if (anyErr.reason) return String(anyErr.reason);
  if (anyErr.type) return `${anyErr.type}${anyErr.code != null ? `:${anyErr.code}` : ""}`;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export class DeepgramSession {
  private connection: ReturnType<ReturnType<typeof createClient>["listen"]["live"]> | null = null;
  private closed = false;
  private opened = false;
  private pending: Buffer[] = [];
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private onError?: DeepgramErrorHandler;

  constructor(
    private sessionId: string,
    private onTranscript: TranscriptHandler,
    onError?: DeepgramErrorHandler,
  ) {
    this.onError = onError;
  }

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
      // Avoid NET-0002 when Meet is quiet between turns
      endpointing: 300,
    };

    if (encoding === "linear16") {
      liveOpts.encoding = "linear16";
      liveOpts.sample_rate = sampleRate;
      liveOpts.channels = 1;
    }

    this.connection = deepgram.listen.live(liveOpts as Parameters<typeof deepgram.listen.live>[0]);

    this.connection.on(LiveTranscriptionEvents.Open, () => {
      this.opened = true;
      log(this.sessionId, "deepgram_open", { encoding, sampleRate });
      patchSession(this.sessionId, { status: "transcribing" });
      this.flushPending();
      this.keepAliveTimer = setInterval(() => {
        if (this.closed || !this.connection || !this.opened) return;
        try {
          this.connection.keepAlive();
        } catch (err) {
          log(this.sessionId, "deepgram_keepalive_error", { error: formatDgError(err) });
        }
      }, 5000);
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
          // Extension user (interviewer) should speak first after Start so their
          // diarization index maps to "interviewer"; all others = interviewee.
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
      const message = formatDgError(err);
      log(this.sessionId, "deepgram_error", { error: message });
      this.onError?.(message);
    });

    this.connection.on(LiveTranscriptionEvents.Close, () => {
      log(this.sessionId, "deepgram_close");
      this.closed = true;
      this.opened = false;
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = null;
      }
    });
  }

  private flushPending(): void {
    if (!this.connection || !this.opened) return;
    const queued = this.pending;
    this.pending = [];
    for (const buf of queued) {
      this.sendRaw(buf);
    }
  }

  private sendRaw(buffer: Buffer): void {
    if (!this.connection) return;
    try {
      // Pass a clean Uint8Array — SharedArrayBuffer views break some WS stacks
      const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      this.connection.send(bytes);
    } catch (err) {
      log(this.sessionId, "deepgram_send_error", { error: formatDgError(err) });
    }
  }

  sendAudio(buffer: Buffer): void {
    if (this.closed || !this.connection) return;
    if (!this.opened) {
      // Cap queue (~2s of 16k mono PCM) so we don't blow memory before Open
      if (this.pending.length < 80) this.pending.push(Buffer.from(buffer));
      return;
    }
    this.sendRaw(buffer);
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
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
    if (!this.connection || this.closed) return;
    try {
      const conn = this.connection as {
        finalize?: () => void;
        requestClose?: () => void;
        finish?: () => void;
        close?: () => void;
      };
      conn.finalize?.();
      conn.requestClose?.();
      conn.finish?.();
      conn.close?.();
    } catch {
      /* ignore */
    }
    this.closed = true;
    this.opened = false;
    this.pending = [];
  }
}

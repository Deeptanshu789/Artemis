/**
 * Offscreen: tab audio → 16kHz mono PCM (linear16) for Deepgram.
 */
let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let mute: GainNode | null = null;

const TARGET_RATE = 16000;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type !== "offscreen") return;
    if (msg.action === "start") {
      await start(msg.streamId as string);
      sendResponse({ ok: true });
      return;
    }
    if (msg.action === "stop") {
      await stop();
      sendResponse({ ok: true });
    }
  })();
  return true;
});

function downsampleTo16k(input: Float32Array, inRate: number): Float32Array {
  if (!inRate || inRate === TARGET_RATE) return input;
  const ratio = inRate / TARGET_RATE;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    // Linear interpolate between neighboring samples
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = src - i0;
    out[i] = input[i0]! * (1 - t) + input[i1]! * t;
  }
  return out;
}

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function abToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function start(streamId: string) {
  await stop();
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // @ts-expect-error chromeMediaSource is Chrome extension-only
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  // Browser often ignores requested rate — always resample to 16k for Deepgram.
  audioCtx = new AudioContext({ sampleRate: TARGET_RATE });
  const source = audioCtx.createMediaStreamSource(stream);

  // Keep Meet audio audible for interviewer
  source.connect(audioCtx.destination);

  processor = audioCtx.createScriptProcessor(4096, 1, 1);
  mute = audioCtx.createGain();
  mute.gain.value = 0;
  processor.onaudioprocess = (ev) => {
    const input = ev.inputBuffer.getChannelData(0);
    const rate = audioCtx?.sampleRate ?? TARGET_RATE;
    const mono16k = downsampleTo16k(input, rate);
    const pcm = floatTo16BitPCM(mono16k);
    chrome.runtime.sendMessage({
      type: "audio-chunk",
      base64: abToBase64(pcm),
      encoding: "linear16",
      sampleRate: TARGET_RATE,
    });
  };
  source.connect(processor);
  processor.connect(mute);
  mute.connect(audioCtx.destination);
}

async function stop() {
  try {
    processor?.disconnect();
  } catch {
    /* ignore */
  }
  processor = null;
  mute = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  await audioCtx?.close().catch(() => undefined);
  audioCtx = null;
}

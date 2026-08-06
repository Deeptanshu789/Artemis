/**
 * Offscreen: tab audio → 16kHz mono PCM (linear16) for Deepgram.
 */
let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let mute: GainNode | null = null;

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

  // Prefer 16kHz for Deepgram linear16; browser may ignore and we still downsample lightly via context.
  audioCtx = new AudioContext({ sampleRate: 16000 });
  const source = audioCtx.createMediaStreamSource(stream);

  // Keep Meet audio audible for interviewer
  source.connect(audioCtx.destination);

  processor = audioCtx.createScriptProcessor(4096, 1, 1);
  mute = audioCtx.createGain();
  mute.gain.value = 0;
  processor.onaudioprocess = (ev) => {
    const input = ev.inputBuffer.getChannelData(0);
    const pcm = floatTo16BitPCM(input);
    chrome.runtime.sendMessage({
      type: "audio-chunk",
      base64: abToBase64(pcm),
      encoding: "linear16",
      sampleRate: audioCtx?.sampleRate ?? 16000,
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

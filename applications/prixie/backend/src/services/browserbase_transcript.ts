// browserbase transcription service - downloads recording, sends to assembly.ai, returns transcript
import { getRecordingUrl } from "./browserbase.ts";

const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY")!;
const ASSEMBLYAI_BASE = "https://api.assemblyai.com/v2";

export interface TranscriptResult {
  text: string;
  utterances?: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
  summary?: string;
}

// upload audio to assembly.ai
async function uploadAudio(audioUrl: string): Promise<string> {
  // for remote urls, assembly.ai can fetch directly via the submit endpoint
  const res = await fetch(`${ASSEMBLYAI_BASE}/transcript`, {
    method: "POST",
    headers: {
      "Authorization": ASSEMBLYAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true,
      speech_model: "best",
      auto_highlights: true,
      auto_chapters: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`assembly.ai submission failed: ${err}`);
  }

  const data = await res.json();
  return data.id;
}

// poll for transcript completion
async function pollTranscript(transcriptId: string, maxWaitMs = 600000): Promise<any> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${ASSEMBLYAI_BASE}/transcript/${transcriptId}`, {
      method: "GET",
      headers: { "Authorization": ASSEMBLYAI_API_KEY },
    });

    if (!res.ok) {
      throw new Error(`assembly.ai poll failed: ${res.statusText}`);
    }

    const data = await res.json();

    if (data.status === "completed") {
      return data;
    }

    if (data.status === "error") {
      throw new Error(`assembly.ai transcript error: ${data.error}`);
    }

    // wait 10 seconds before polling again
    await new Promise(r => setTimeout(r, 10000));
  }

  throw new Error("assembly.ai transcript timed out");
}

// full flow: get recording → submit to assembly.ai → get transcript
export async function transcribeBrowserbaseSession(sessionId: string): Promise<TranscriptResult> {
  const recordingUrl = await getRecordingUrl(sessionId);
  if (!recordingUrl) {
    throw new Error("no recording found for browserbase session");
  }

  const transcriptId = await uploadAudio(recordingUrl);
  const transcript = await pollTranscript(transcriptId);

  return {
    text: transcript.text || "",
    utterances: transcript.utterances?.map((u: any) => ({
      speaker: `speaker ${u.speaker}`,
      text: u.text,
      start: u.start,
      end: u.end,
    })),
    summary: transcript.auto_highlights_result?.results?.map((h: any) => h.text).join(". ") || undefined,
  };
}

// keyword search in transcript
export function searchForKeywords(transcript: TranscriptResult, keywords: string[]): Array<{
  keyword: string;
  text: string;
  speaker?: string;
}> {
  const matches: Array<{ keyword: string; text: string; speaker?: string }> = [];

  const textToSearch = transcript.utterances
    ? transcript.utterances.map(u => `${u.speaker}: ${u.text}`).join("\n")
    : transcript.text;

  const lines = textToSearch.split("\n");

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    for (const keyword of keywords) {
      if (lowerLine.includes(keyword.toLowerCase())) {
        matches.push({ keyword, text: line });
        break; // one match per line is enough
      }
    }
  }

  return matches;
}

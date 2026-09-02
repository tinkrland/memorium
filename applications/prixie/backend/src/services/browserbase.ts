// browserbase service - handles meeting platforms not supported by recall.ai
// opens meeting URL in a headless browser, automates the join flow, captures audio

const BROWSERBASE_API_KEY = Deno.env.get("BROWSERBASE_API_KEY")!;
const BROWSERBASE_BASE = "https://api.browserbase.com/v1";

interface BrowserbaseSession {
  id: string;
  status: string;
  createdAt: string;
}

interface JoinResult {
  session_id: string;
  status: "joined" | "failed" | "waiting_room";
  error?: string;
  recording_id?: string;
}

// --- session management ---

export async function createSession(options?: {
  projectId?: string;
  keepalive?: boolean;
}): Promise<BrowserbaseSession> {
  const res = await fetch(`${BROWSERBASE_BASE}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${BROWSERBASE_API_KEY}`,
    },
    body: JSON.stringify({
      projectId: options?.projectId || Deno.env.get("BROWSERBASE_PROJECT_ID") || undefined,
      keepalive: options?.keepalive ?? true,
      browserSettings: {
        viewport: { width: 1280, height: 800 },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`browserbase session creation failed: ${err}`);
  }

  return res.json();
}

export async function navigateTo(sessionId: string, url: string): Promise<void> {
  const res = await fetch(`${BROWSERBASE_BASE}/sessions/${sessionId}/navigate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${BROWSERBASE_API_KEY}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) {
    throw new Error(`navigation failed: ${res.statusText}`);
  }
}

export async function takeScreenshot(sessionId: string): Promise<string> {
  const res = await fetch(`${BROWSERBASE_BASE}/sessions/${sessionId}/screenshot`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${BROWSERBASE_API_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`screenshot failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.screenshotId || data.url || "";
}

export async function stopSession(sessionId: string): Promise<void> {
  await fetch(`${BROWSERBASE_BASE}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${BROWSERBASE_API_KEY}` },
  });
}

export async function getSessionStatus(sessionId: string): Promise<any> {
  const res = await fetch(`${BROWSERBASE_BASE}/sessions/${sessionId}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${BROWSERBASE_API_KEY}` },
  });
  return res.json();
}

// --- CDP (Chrome DevTools Protocol) actions ---

async function cdpExecute(sessionId: string, method: string, params: any): Promise<any> {
  const res = await fetch(`${BROWSERBASE_BASE}/sessions/${sessionId}/cdp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${BROWSERBASE_API_KEY}`,
    },
    body: JSON.stringify({ method, params }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`cdp ${method} failed:`, err);
    return null;
  }

  return res.json();
}

// --- element interaction (via CDP) ---

async function findAndClick(sessionId: string, selector: string, timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await cdpExecute(sessionId, "Runtime.evaluate", {
      expression: `document.querySelector('${selector}')?.click() || 'not found'`,
      returnByValue: true,
    });

    if (result?.result?.value !== "not found") {
      return true;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  return false;
}

async function findAndType(sessionId: string, selector: string, text: string, timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await cdpExecute(sessionId, "Runtime.evaluate", {
      expression: `
        const el = document.querySelector('${selector}');
        if (el) {
          el.value = '${text.replace(/'/g, "\\'")}';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          'typed';
        } else {
          'not found';
        }
      `,
      returnByValue: true,
    });

    if (result?.result?.value === "typed") {
      return true;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  return false;
}

// --- platform-specific join flows ---

export async function joinDiscord(sessionId: string, meetingUrl: string, profileName: string): Promise<JoinResult> {
  // navigate to the discord invite/channel
  await navigateTo(sessionId, meetingUrl);

  // wait for page to load
  await new Promise(r => setTimeout(r, 5000));

  // try to find and click the "Join Voice" or voice channel button
  // discord voice channels have a specific structure
  const joinedVoice = await findAndClick(sessionId, '[data-list-item-id*="voice"]', 15000) ||
                       await findAndClick(sessionId, 'button[aria-label*="Voice"]', 10000) ||
                       await findAndClick(sessionId, 'button[aria-label*="Join"]', 10000);

  if (!joinedVoice) {
    // might need to handle discord auth first
    const hasLogin = await cdpExecute(sessionId, "Runtime.evaluate", {
      expression: `!!document.querySelector('input[name="email"]')`,
      returnByValue: true,
    });

    if (hasLogin?.result?.value) {
      return { session_id: sessionId, status: "failed", error: "discord requires authentication. provide a pre-authenticated browser context." };
    }

    return { session_id: sessionId, status: "failed", error: "could not find voice channel to join" };
  }

  return { session_id: sessionId, status: "joined" };
}

export async function joinBlueJeans(sessionId: string, meetingUrl: string, profileName: string): Promise<JoinResult> {
  await navigateTo(sessionId, meetingUrl);
  await new Promise(r => setTimeout(r, 5000));

  // bluejeans: click "Join Meeting" or enter name first
  const nameInput = await findAndType(sessionId, 'input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]', profileName, 10000);

  const joinButton = await findAndClick(sessionId, 'button[class*="join"], button[aria-label*="Join"], button:has-text("Join")', 10000) ||
                      await findAndClick(sessionId, 'button[type="submit"]', 5000);

  if (!joinButton) {
    return { session_id: sessionId, status: "failed", error: "could not find join button on bluejeans" };
  }

  return { session_id: sessionId, status: "joined" };
}

export async function joinRingCentral(sessionId: string, meetingUrl: string, profileName: string): Promise<JoinResult> {
  await navigateTo(sessionId, meetingUrl);
  await new Promise(r => setTimeout(r, 5000));

  // ringcentral often prompts to download the app. click "Join from browser" instead
  const joinFromBrowser = await findAndClick(sessionId, 'a:has-text("Join from browser"), button:has-text("Join from browser"), a[class*="browser"]', 10000);

  // enter name
  await findAndType(sessionId, 'input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]', profileName, 8000);

  // click join
  const joinButton = await findAndClick(sessionId, 'button[class*="join"], button[aria-label*="Join"], button[type="submit"]', 10000);

  if (!joinButton) {
    return { session_id: sessionId, status: "failed", error: "could not find join button on ringcentral" };
  }

  return { session_id: sessionId, status: "joined" };
}

export async function joinGeneric(sessionId: string, meetingUrl: string, profileName: string): Promise<JoinResult> {
  await navigateTo(sessionId, meetingUrl);
  await new Promise(r => setTimeout(r, 5000));

  // try common patterns: enter name, click join
  await findAndType(sessionId, 'input[name="name"], input[placeholder*="name"], input[placeholder*="Name"], input[name="username"]', profileName, 8000);

  const joined = await findAndClick(sessionId, 'button[class*="join"], button[aria-label*="Join"], button[type="submit"], button:has-text("Join"), button:has-text("Enter")', 10000);

  if (!joined) {
    return { session_id: sessionId, status: "failed", error: "could not find join button on generic platform" };
  }

  return { session_id: sessionId, status: "joined" };
}

// --- main join dispatcher ---

export async function joinMeeting(
  platform: string,
  meetingUrl: string,
  profileName: string
): Promise<JoinResult> {
  const session = await createSession({ keepalive: true });

  try {
    let result: JoinResult;

    switch (platform) {
      case "discord":
        result = await joinDiscord(session.id, meetingUrl, profileName);
        break;
      case "bluejeans":
        result = await joinBlueJeans(session.id, meetingUrl, profileName);
        break;
      case "ringcentral":
        result = await joinRingCentral(session.id, meetingUrl, profileName);
        break;
      default:
        result = await joinGeneric(session.id, meetingUrl, profileName);
    }

    return result;
  } catch (err: any) {
    await stopSession(session.id);
    return { session_id: session.id, status: "failed", error: err.message };
  }
}

// --- audio capture via CDP ---

export async function startAudioCapture(sessionId: string): Promise<boolean> {
  // use CDP to capture tab audio
  const result = await cdpExecute(sessionId, "Runtime.evaluate", {
    expression: `
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: false
          });
          window.__prixieAudioStream = stream;
          return 'captured';
        } catch (e) {
          return 'error: ' + e.message;
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });

  return result?.result?.value === "captured";
}

// --- recording ---

export async function getSessionRecordings(sessionId: string): Promise<any[]> {
  const res = await fetch(`${BROWSERBASE_BASE}/sessions/${sessionId}/recordings`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${BROWSERBASE_API_KEY}` },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

// --- transcript from recording ---

export async function getRecordingUrl(sessionId: string): Promise<string | null> {
  const recordings = await getSessionRecordings(sessionId);
  if (recordings.length === 0) return null;

  const recording = recordings[0];
  return recording.url || recording.downloadUrl || null;
}

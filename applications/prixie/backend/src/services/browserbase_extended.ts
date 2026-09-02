// browserbase service additions for twitch streams and late join handling

// ... (existing functions from browserbase.ts remain the same)

// join a twitch stream (listen only, no camera/mic)
export async function joinTwitchStream(sessionId: string, streamUrl: string): Promise<JoinResult> {
  await navigateTo(sessionId, streamUrl);
  await new Promise(r => setTimeout(r, 5000));

  // twitch streams auto-play. we just need to be on the page to capture audio.
  // dismiss any mature content warning if present
  await findAndClick(sessionId, 'button[data-a-target="player-overlay-mature-accept"]', 5000);

  // dismiss any login popup
  await findAndClick(sessionId, 'button[aria-label="Close"]', 3000);
  await findAndClick(sessionId, '.tw-button-label:has-text("Log In") ~ button', 3000);

  return { session_id: sessionId, status: "joined" };
}

// late join handling: when prixie joins a meeting that's already in progress
// - for recall.ai: just create the bot, it will join the ongoing call
// - for browserbase: navigate and join, the meeting is already running
// - handle waiting rooms: if stuck in a waiting room, wait up to 10 minutes
// - handle password prompts: try to enter password from the meeting URL
// - handle "meeting has already started" prompts: click "join anyway"
export async function joinLate(
  sessionId: string,
  platform: string,
  meetingUrl: string,
  profileName: string
): Promise<JoinResult> {
  await navigateTo(sessionId, meetingUrl);
  await new Promise(r => setTimeout(r, 5000));

  // handle common late-join scenarios:

  // 1. "meeting has already started" / "join anyway" prompt
  const joinAnyway = await findAndClick(sessionId, 'button:has-text("Join"), button:has-text("Join Anyway"), button:has-text("Join Meeting")', 10000);

  // 2. "meeting in progress" with password field
  const passwordInput = await findAndType(sessionId, 'input[type="password"], input[name="passwd"], input[name="password"]', extractPasswordFromUrl(meetingUrl) || "", 3000);

  // 3. waiting room: wait up to 10 minutes
  const inWaitingRoom = await cdpExecute(sessionId, "Runtime.evaluate", {
    expression: `document.body.innerText.toLowerCase().includes("waiting") || document.body.innerText.toLowerCase().includes("host will let you in")`,
    returnByValue: true,
  });

  if (inWaitingRoom?.result?.value) {
    console.log("prixie: in waiting room, waiting up to 10 minutes for host to admit...");
    const waitStart = Date.now();
    while (Date.now() - waitStart < 600000) {
      await new Promise(r => setTimeout(r, 10000));
      const stillWaiting = await cdpExecute(sessionId, "Runtime.evaluate", {
        expression: `document.body.innerText.toLowerCase().includes("waiting") || document.body.innerText.toLowerCase().includes("host will let you in")`,
        returnByValue: true,
      });
      if (!stillWaiting?.result?.value) {
        return { session_id: sessionId, status: "joined" };
      }
    }
    return { session_id: sessionId, status: "failed", error: "timed out waiting for host to admit from waiting room" };
  }

  // 4. enter name if prompted
  await findAndType(sessionId, 'input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]', profileName, 5000);

  // 5. click join button (generic)
  const joined = await findAndClick(sessionId, 'button[class*="join"], button[aria-label*="Join"], button[type="submit"], button:has-text("Join"), button:has-text("Enter")', 10000);

  if (!joined && !joinAnyway) {
    // check if we're already in the meeting (auto-joined)
    const inMeeting = await cdpExecute(sessionId, "Runtime.evaluate", {
      expression: `document.body.innerText.toLowerCase().includes("mute") || document.body.innerText.toLowerCase().includes("unmute") || document.querySelector('[data-testid="meeting"]') !== null`,
      returnByValue: true,
    });
    if (inMeeting?.result?.value) {
      return { session_id: sessionId, status: "joined" };
    }
    return { session_id: sessionId, status: "failed", error: "could not join meeting (late)" };
  }

  return { session_id: sessionId, status: "joined" };
}

function extractPasswordFromUrl(url: string): string | null {
  // zoom URLs often have ?pwd=XXX
  const pwdMatch = url.match(/[?&]pwd=([^&]+)/);
  if (pwdMatch) return decodeURIComponent(pwdMatch[1]);

  // some platforms have #password=XXX
  const hashMatch = url.match(/#password=([^&]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);

  return null;
}

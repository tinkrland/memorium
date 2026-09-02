import { Meeting } from "../types.ts";

export class RecallService {
  private get baseUrl(): string {
    return Deno.env.get("RECALL_BASE_URL") || "https://api.recall.ai/api/v1";
  }

  private get apiKey(): string {
    const key = Deno.env.get("RECALL_API_KEY");
    if (!key) {
      console.warn("prixie: warning - RECALL_API_KEY environment variable is missing");
    }
    return key || "";
  }

  private get headers(): Record<string, string> {
    return {
      "Authorization": `Token ${this.apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
  }

  /**
   * Create a new bot instance on Recall.ai and deploy it to a meeting.
   */
  async createBot(
    meeting: Meeting,
    realtimeWebhookUrl?: string,
    statusWebhookUrl?: string
  ): Promise<any> {
    const botName = Deno.env.get("BOT_NAME") || "prixie";

    // Calculate join_at timestamp based on start_time and join_delay_minutes
    const startTime = new Date(meeting.start_time);
    const joinDelay = meeting.join_delay_minutes ?? 2;
    const joinAtTime = new Date(startTime.getTime() + joinDelay * 60 * 1000);

    const baseUrlSetting = Deno.env.get("BASE_URL") || "https://prixie.yourdomain.com";
    const actualRealtimeWebhook = realtimeWebhookUrl || `${baseUrlSetting}/webhooks/recall/realtime`;
    const actualStatusWebhook = statusWebhookUrl || `${baseUrlSetting}/webhooks/recall/status`;

    // Construct recall payload
    const payload: Record<string, any> = {
      bot_name: botName,
      meeting_url: meeting.join_url,
      join_at: joinAtTime.toISOString(),
      meeting_platform: meeting.platform || "custom",
      recording_config: {
        transcript: {
          provider: {
            kind: "assembly_ai",
          },
        },
        diarization: {
          use_separate_streams_when_available: true,
        },
        realtime_endpoints: [
          {
            url: actualRealtimeWebhook,
            events: [
              "transcript.data",
              "transcript.partial_data",
              "participant_events.chat_message",
            ],
          },
        ],
      },
      status_changes_webhook_url: actualStatusWebhook,
      breakout_room: {
        mode: "auto_accept_all_invites",
      },
    };

    // Zoom user email setup if provided
    if (meeting.platform === "zoom" && meeting.zoom_user_email) {
      payload.zoom = {
        user_email: meeting.zoom_user_email,
      };
    }

    // Configure chat_config messages_on_join if attendance message is enabled
    if (meeting.attendance_method === "chat_message") {
      const attendanceMsg = meeting.attendance_form_url
        ? `hi! i am prixie, attending on behalf of my user. please sign attendance here: ${meeting.attendance_form_url}`
        : `hi! i am prixie, taking notes and proxying this meeting for my user.`;

      payload.chat_config = {
        messages_on_join: [[attendanceMsg]],
      };
    }

    console.log(`prixie: deploying bot to ${meeting.join_url} scheduled for ${joinAtTime.toISOString()}`);

    const res = await fetch(`${this.baseUrl}/bot/`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`prixie: recall api error creating bot (${res.status}): ${errorText}`);
      throw new Error(`recall api error (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    console.log(`prixie: bot successfully created with id ${data.id}`);
    return data;
  }

  /**
   * Retrieve bot details from Recall.ai by bot_id.
   */
  async getBot(botId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/bot/${botId}/`, {
      method: "GET",
      headers: this.headers,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`prixie: recall api error getting bot ${botId} (${res.status}): ${errorText}`);
      throw new Error(`recall api error (${res.status}): ${errorText}`);
    }

    return await res.json();
  }

  /**
   * Send a chat message into the meeting via the bot.
   */
  async sendChatMessage(botId: string, messageText: string): Promise<any> {
    console.log(`prixie: sending chat message via bot ${botId}: "${messageText}"`);
    const res = await fetch(`${this.baseUrl}/bot/${botId}/send_chat_message/`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ text: messageText }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`prixie: recall api error sending chat message (${res.status}): ${errorText}`);
      throw new Error(`recall api error (${res.status}): ${errorText}`);
    }

    return await res.json();
  }

  /**
   * Remove/delete a bot on Recall.ai.
   */
  async deleteBot(botId: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/bot/${botId}/`, {
      method: "DELETE",
      headers: this.headers,
    });

    if (!res.ok && res.status !== 404) {
      const errorText = await res.text();
      console.error(`prixie: recall api error deleting bot ${botId} (${res.status}): ${errorText}`);
      return false;
    }

    return true;
  }

  /**
   * Fetch complete transcript for a finished bot call.
   */
  async getBotTranscript(botId: string): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/bot/${botId}/transcript/`, {
        method: "GET",
        headers: this.headers,
      });

      if (!res.ok) {
        console.warn(`prixie: transcript endpoint returned status ${res.status} for bot ${botId}`);
        // Fallback: check bot object for recordings or transcript URLs
        const botData = await this.getBot(botId);
        return this.formatTranscriptFromBotData(botData);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        return data
          .map((segment: any) => {
            const speaker = segment.participant?.name || "speaker";
            const text = (segment.words || []).map((w: any) => w.text).join(" ");
            return `${speaker}: ${text}`;
          })
          .filter((line: string) => line.trim().length > 0)
          .join("\n");
      }

      return typeof data === "string" ? data : JSON.stringify(data);
    } catch (err: any) {
      console.error(`prixie: failed to fetch transcript for bot ${botId}:`, err);
      return "transcript unavailable";
    }
  }

  /**
   * Helper to inspect media shortcuts and participant events.
   */
  async getMediaShortcuts(botId: string): Promise<any> {
    const botData = await this.getBot(botId);
    const recordings = botData.recordings || [];
    const shortcuts = recordings.map((rec: any) => rec.media_shortcuts).filter(Boolean);
    return shortcuts;
  }

  /**
   * Helper to format transcript text from raw bot data.
   */
  private formatTranscriptFromBotData(botData: any): string {
    if (!botData) return "no transcript recorded";

    if (botData.transcript && Array.isArray(botData.transcript)) {
      return botData.transcript
        .map((segment: any) => {
          const speaker = segment.participant?.name || "unknown speaker";
          const words = (segment.words || []).map((w: any) => w.text).join(" ");
          return `${speaker}: ${words}`;
        })
        .join("\n");
    }

    return "transcript complete for meeting";
  }
}

export const recallService = new RecallService();

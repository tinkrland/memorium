# behind the scenes

## how prixie joins a meeting

1. you create a meeting record (or it comes from your calendar automatically)
2. you attach capture requests: keywords, links to grab, questions to ask
3. the meeting manager scheduler checks every minute for meetings that need bots
4. at the configured join time (start time + delay), prixie calls recall.ai to create a bot
5. the bot joins the meeting with camera off, mic off
6. recall.ai streams real time transcript data to the webhook
7. the realtime handler checks every transcript chunk against your capture requests
8. if a keyword match is found, the content is saved with context and timestamp
9. if the meeting chat has links or codes, they are captured
10. when the meeting ends, recall.ai sends a status webhook
11. the scheduler retrieves the full transcript with speaker diarization
12. everything is stored in supabase and delivered to you

## the two paths

### recall.ai path (zoom, google meet, teams, slack, webex)
recall.ai handles the bot creation, joining, audio capture, and transcription. prixie just tells it what to do and processes the results. this is the clean path.

### browserbase path (discord, bluejeans, ringcentral, anything with a browser join)
for platforms recall.ai does not support, prixie opens the meeting url in a browserbase session. browser automation clicks the join button, enters a name, handles auth if needed. audio is captured from the browser tab and streamed to assembly.ai for transcription. the same keyword detection and capture logic runs on top. heavier, but works anywhere.

## the realtime handler

the realtime webhook receives transcript chunks as people speak. each chunk is checked against all active capture requests for that meeting. if keywords match, the content is extracted and stored immediately. you do not wait for the meeting to end to know something was captured.

chat messages are also monitored in real time. links, google form urls, access codes pasted in chat are all captured as they appear.

## the scheduler

a cron job runs every 60 seconds. it checks:
- are there meetings starting soon that need a bot deployed?
- are there meetings that just ended and need transcripts retrieved?
- are there completed meetings that need delivery to the user?

the scheduler is the brain that keeps prixie running without you watching.

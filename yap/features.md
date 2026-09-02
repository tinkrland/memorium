# features

## autonomous attendance

prixie joins meetings on her own. you set it up ahead of time (or she picks it up from your calendar), and she handles the rest. no babysitting. she joins, stays quiet, does her job, leaves.

## focused listening

you give prixie a concrete instruction. "grab any access codes shared during the call." "find out what the API release timeline is." "capture any discord invite links dropped in chat." she listens for that, not everything.

## capture requests

before the meeting, you specify what you want. keywords to watch for, links to grab, codes to catch, questions to ask. prixie monitors the live transcript and the meeting chat in real time. when she finds what you asked for, she saves it with context (who said it, when, and the surrounding sentence).

## prepared questions

you can pre specify questions. prixie waits for an appropriate moment (when the organizer says "any questions?") and asks them on your behalf. the answer gets captured and returned to you.

## multiple platforms

| platform | method | transcript | chat | breakout rooms |
| --- | --- | --- | --- | --- |
| zoom | recall.ai | yes | send + receive | yes |
| google meet | recall.ai | yes | send + receive | n/a |
| microsoft teams | recall.ai | yes | send + receive | n/a |
| slack huddles | recall.ai | yes | send only | n/a |
| cisco webex | recall.ai | yes | no chat | n/a |
| discord | browserbase | yes | via browser | n/a |
| bluejeans | browserbase | yes | via browser | n/a |
| ringcentral | browserbase | yes | via browser | n/a |

## profile system

prixie has sandboxes for different contexts. your hackathon identity is not your work identity. each profile has its own display name, email, context, and memory. shared global memory (like your timezone) crosses profiles.

## link sourcing

prixie finds meeting links from multiple sources:
- google calendar (automatic sync)
- gmail inbox (meeting links in emails)
- discord and slack channels (live links posted during events)
- luma event registration (pre register and grab the join link)
- community forums and threads

## attendance marking

prixie can mark your attendance by sending a chat message ("present!"), filling out a google form, or using a custom method you define.

## transcript with diarization

full transcript returned with speaker labels. hybrid diarization separates per participant audio streams where possible and falls back to machine diarization for shared devices (conference rooms, etc.).

## hinglish support

when speakers use hinglish (hindi + english mix), the transcript keeps everything in latin script. phonetically written, italicized. no devanagari. you already understand it, you just need it readable.

## camera and mic off

prixie joins with camera off and mic off by default. she is a listener, not a participant. mic turns on only for the future voice feature (asking your questions out loud).

## delayed join

prixie does not join at the exact start time. she waits (default 2 minutes) so the organizer has time to open the room. configurable per meeting.

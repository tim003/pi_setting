# YouTube Transcript Skill

## Purpose

Fetch a YouTube video's title and English transcript as JSON using `yt-dlp` and Python.

Skill path:

```text
skills/youtube-transcript/
```

Live install path:

```text
~/.pi/agent/skills/youtube-transcript/
```

## Requirements

The host Pi setup should include:

- `python3`
- `python3-venv`
- `python3-pip`
- `ffmpeg`
- current `yt-dlp` from pip

These were verified on the host during the 2026-09-01 migration.

## Usage

```bash
python3 ~/.pi/agent/skills/youtube-transcript/fetch_transcript.py "https://www.youtube.com/watch?v=VIDEO_ID"
```

Output is JSON with:

- `title`
- `transcript`

## Dependency check

Run from this repo:

```bash
./scripts/check-youtube-transcript-deps.sh
```

Expected output includes Python and yt-dlp versions.

## Notes

- The skill prefers manual English captions and falls back to auto-generated English captions.
- Some videos disable captions or block caption download.
- Keep `yt-dlp` current with pip/Homebrew when YouTube changes break transcript extraction.

## Example verified video

The video `https://www.youtube.com/watch?v=iKwPaB5TUdI` was successfully checked during host migration verification. Title:

```text
Pi Setup After 6 Months of Use
```

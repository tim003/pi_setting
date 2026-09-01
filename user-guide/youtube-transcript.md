# YouTube Transcript Skill

## Purpose

Fetch a YouTube video's title and English transcript as JSON using `yt-dlp` and Python.

Skill path:

```text
skills/youtube-transcript/
```

Live install path:

```text
/root/.pi/agent/skills/youtube-transcript/
```

## Requirements

The Docker image should include:

- `python3`
- `python3-venv`
- `python3-pip`
- `ffmpeg`
- current `yt-dlp` from pip

These are installed by `Pi/container/Dockerfile.pi`.

## Usage

```bash
python3 /root/.pi/agent/skills/youtube-transcript/fetch_transcript.py "https://www.youtube.com/watch?v=VIDEO_ID"
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
- Debian's `yt-dlp` package can lag behind YouTube changes; use the pip-installed current version from the Dockerfile.

## Example verified video

The video `https://www.youtube.com/watch?v=iKwPaB5TUdI` was successfully checked after the Docker image rebuild. Title:

```text
Pi Setup After 6 Months of Use
```

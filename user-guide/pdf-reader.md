# PDF Reader Skill

## Purpose

Read, search, and extract content from PDF files, especially academic papers and lecture notes.

Skill path:

```text
skills/pdf-reader/
```

Live install path:

```text
~/.pi/agent/skills/pdf-reader/
```

## Requirements

The skill uses Python helper scripts. The host Pi setup uses macOS Python 3.11 with venv support.

If a PDF task fails because a Python package is missing, inspect the skill scripts and create/install the required virtual environment before retrying.

## Typical workflow

1. Inspect PDF metadata/page count.
2. Search for relevant terms.
3. Extract only the needed page ranges.
4. Render pages to images only when layout, equations, figures, or tables matter.

## Usage pattern

Ask Pi to read or analyze a PDF path, for example:

```text
Use the pdf-reader skill to summarize Research/Papers/example.pdf and quote the pages relevant to vector databases.
```

## Caveats

- Large PDFs should be triaged first rather than fully extracted into chat.
- Scanned PDFs may need OCR; this skill is strongest for text PDFs.
- Rendered page images can cost more tokens than extracted text.

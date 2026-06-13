# Exam Summary HTML Prompt

## Context
You are generating a single, self-contained HTML study summary from one or more uploaded study documents (PDFs, DOCX, PPTX, TXT, images of notes). The output must be a complete, browser-ready HTML file with no external dependencies.

## Prerequisites
- Access to all uploaded study files
- Knowledge of the target exam/course name and desired output language
- Ability to read PDFs, DOCX, PPTX, and image files

## Steps

**1. Read all uploaded files completely** — Before writing any HTML, extract the full content of every uploaded document. Do not skim or skip files. For PDFs extract full text; for PPTX extract all slide titles and body text; for DOCX extract all paragraphs and tables; for images of handwritten notes, describe the content visually.

**2. Identify key parameters** — From the user's message, determine:
- **Exam/course name** (e.g. "Analisi Matematica II") → fallback: "Exam Summary"
- **Output language** → if not explicitly stated, **ask the user before proceeding**; never assume
- **Depth/focus** → any specific topics highlighted → otherwise cover everything

**3. Organise content into a logical hierarchy** — Outline the material mentally:
- Macro-topics (main chapters/sections) → will become `<h2>`
- Sub-topics (subsections, specific concepts) → will become `<h3>`
- Details (definitions, theorems, formulas, examples) → body text, lists, tables
- Follow the original document structure; reorganise only to improve clarity; merge duplicates across files

**4. Build the HTML file** — Write a single HTML file with this structure:
- `<!DOCTYPE html>` with correct `lang` attribute
- Embedded `<style>` block — no external CSS links ever
- `<h1>` with the exam name
- `<nav>` table of contents immediately after `<h1>`, listing all `<h2>` sections as anchor links
- One `<section>` per macro-topic with `<h2>` and `<h3>` headings, each with unique `id` attributes

**5. Apply the correct HTML pattern for each content type:**
- Key definition → `<div class="definition"><strong>Term:</strong> explanation</div>`
- Formula → `<div class="formula">F = m·a</div>` in plain Unicode (no LaTeX, no MathML)
- Comparison table → `<table>` with header row and one column per thing
- Sequential steps → `<ol>`
- Unordered items → `<ul>`
- Important note/exception → `<div class="note">...</div>`
- Regular explanation → `<p>`

**6. Apply the required CSS** — Embed this stylesheet verbatim inside the `<style>` tag:
```css
body { font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff; color: #1a1a1a; max-width: 900px; margin: 0 auto; padding: 2rem 2.5rem; line-height: 1.7; }
h1 { font-size: 2rem; border-bottom: 3px solid #2c5f9e; padding-bottom: .5rem; color: #1a3a6e; }
h2 { font-size: 1.5rem; color: #2c5f9e; margin-top: 2.5rem; border-left: 4px solid #2c5f9e; padding-left: .75rem; }
h3 { font-size: 1.15rem; color: #444; margin-top: 1.5rem; }
/* ... (full CSS as defined in the skill) */
```

**7. Run the quality checklist before saving:**
- [ ] Every uploaded file has been read in full
- [ ] No topic from the source material is missing
- [ ] Language matches the user's explicit request
- [ ] All formulas are in plain Unicode text (no LaTeX)
- [ ] CSS is fully embedded — no external links
- [ ] Table of contents anchor links work (all `id` attributes set)
- [ ] Tables used for comparisons, lists for sequences/definitions
- [ ] Output is a single `.html` file

**8. Save and present the file** — Save to `/mnt/user-data/outputs/[exam-name-slug]-summary.html`, then call `present_files` with the path. Do **not** print the HTML in chat. Respond with a brief confirmation stating: how many source files were processed, how many macro-topics were covered, and the output filename.

## Important Notes

- **Language not specified?** → Ask before generating. Never assume.
- **Only one file uploaded** → Still apply the full HTML structure.
- **Image of handwritten notes** → Transcribe/describe content visually and include it.
- **Source files in a different language than requested output** → Translate content into the requested output language.
- **Conflicting information across files** → Note the conflict and present both versions.
- **Very short source material** → Still produce the full HTML structure; keep content concise but complete.
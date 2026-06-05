---
name: exam-summary-html
description: >
  Use this skill whenever a user attaches study documents (PDFs, notes, slides, textbooks)
  and asks for a summary, study guide, or review sheet for an exam or course — especially
  when they want the output as an HTML file. Triggers on phrases like "create a summary of
  my study material", "make a study guide from these documents", "summarise my notes for
  the exam", "crea un riassunto per l'esame", or any variant where uploaded files are meant
  to be compiled into a structured, readable HTML document. Always use this skill when:
  - The user attaches one or more study files (PDF, DOCX, PPTX, TXT, images of notes)
  - The user mentions an exam name or course subject
  - The user asks for a comprehensive or exhaustive summary
  - The user wants the output as an HTML file or a document they can read on screen
  Even if the user doesn't say "HTML" explicitly but uploads study material and wants a
  structured summary, default to this skill and produce an HTML output.
---

# Exam Summary HTML Skill

Produce a **single, self-contained HTML file** that is a comprehensive, well-structured
study summary of the uploaded material. The file must be immediately readable in any browser
with no external dependencies.

---

## Step 0 — Read uploaded files first

Before writing a single line of HTML, read **all** uploaded documents. Use the
`file-reading` skill if you are unsure how to handle a given file type
(`/mnt/skills/public/file-reading/SKILL.md`).

Typical inputs:
- PDF lecture notes or textbooks → extract full text
- PPTX slide decks → extract all slide titles and body text
- DOCX documents → extract all paragraphs and tables
- Images of handwritten notes → describe content visually
- Plain text / Markdown files → read directly

Do **not** skip or skim files. The user's explicit requirement is that **nothing is omitted**.

---

## Step 1 — Identify key parameters from the user's message

| Parameter | Where to find it | Fallback |
|-----------|-----------------|---------|
| **Exam / course name** | User's message (e.g. "Analisi Matematica II") | Use "Exam Summary" |
| **Output language** | Explicitly stated by user (e.g. "in Italian", "in English", "in francese") | **Ask the user** — never assume |
| **Depth / focus** | Any specific topics or chapters the user highlights | Cover everything |

> ⚠️ **Language rule**: The output HTML language is determined by the user's explicit request.
> If not specified, ask before proceeding. The skill interface can be in English; the HTML
> content must be in the user's requested language.

---

## Step 2 — Organise content into a logical hierarchy

After reading all files, mentally outline the material:

1. **Macro-topics** (= main chapters / sections) → will become `<h2>`
2. **Sub-topics** (= subsections, specific concepts) → will become `<h3>`
3. **Details** (definitions, theorems, formulas, examples) → body text, lists, tables

Rules:
- Follow the original document structure where logical; reorganise only to improve clarity.
- Every concept mentioned in the source material must appear somewhere in the summary.
- Merge duplicate content across multiple files; note the source if helpful.

---

## Step 3 — Write the HTML file

### Required structure

```html
<!DOCTYPE html>
<html lang="[LANG_CODE]">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[EXAM NAME] – Summary</title>
  <style>
    /* All CSS inline here — no external files */
  </style>
</head>
<body>
  <h1>[EXAM NAME]</h1>
  <!-- Table of contents (auto-generated) -->
  <!-- One <section> per macro-topic -->
  <section>
    <h2>Macro-topic</h2>
    <h3>Sub-topic</h3>
    <!-- content -->
  </section>
</body>
</html>
```

### CSS requirements (embed in `<style>` tag)

```css
body {
  font-family: 'Segoe UI', Arial, sans-serif;
  background: #ffffff;
  color: #1a1a1a;
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 2.5rem;
  line-height: 1.7;
}
h1 { font-size: 2rem; border-bottom: 3px solid #2c5f9e; padding-bottom: .5rem; color: #1a3a6e; }
h2 { font-size: 1.5rem; color: #2c5f9e; margin-top: 2.5rem; border-left: 4px solid #2c5f9e; padding-left: .75rem; }
h3 { font-size: 1.15rem; color: #444; margin-top: 1.5rem; }
p  { margin: .6rem 0; }
ul, ol { margin: .5rem 0 .5rem 1.5rem; }
li { margin-bottom: .35rem; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .95rem; }
th { background: #2c5f9e; color: #fff; padding: .55rem .8rem; text-align: left; }
td { border: 1px solid #ccd; padding: .5rem .8rem; vertical-align: top; }
tr:nth-child(even) td { background: #f5f7fb; }
.formula { background: #f0f4fa; border-left: 3px solid #7aaddc; padding: .4rem .8rem; font-family: monospace; margin: .5rem 0; border-radius: 3px; }
.definition { background: #fffbe6; border-left: 3px solid #f0c040; padding: .4rem .8rem; margin: .5rem 0; border-radius: 3px; }
.note { background: #f0fff4; border-left: 3px solid #4caf50; padding: .4rem .8rem; margin: .5rem 0; font-style: italic; border-radius: 3px; }
nav { background: #f5f7fb; border: 1px solid #dde; border-radius: 6px; padding: 1rem 1.5rem; margin-bottom: 2rem; }
nav h2 { font-size: 1.1rem; margin-top: 0; border: none; padding: 0; }
nav ol { margin: .4rem 0 0 1.2rem; }
nav a { color: #2c5f9e; text-decoration: none; }
nav a:hover { text-decoration: underline; }
```

### Content rules

| Content type | HTML pattern |
|---|---|
| Definition / key concept | `<div class="definition"><strong>Term:</strong> explanation</div>` |
| Mathematical / physical formula | `<div class="formula">F = m · a</div>` — write in plain readable text, no LaTeX |
| Comparison between 2+ things | `<table>` with header row and one column per thing |
| Sequential steps / algorithm | `<ol>` numbered list |
| Unordered list of items | `<ul>` bullet list |
| Important note or exception | `<div class="note">...</div>` |
| Regular explanation paragraph | `<p>` |

**Formula notation**: Render all formulas in plain Unicode text (e.g., `E = m·c²`,
`∫f(x)dx`, `lim(x→0) sin(x)/x = 1`). Never use LaTeX or MathML. Use `·` for
multiplication, `√` for square root, `∞` for infinity, `∑` for sum, `∫` for integral.

### Table of contents

Generate a `<nav>` block right after `<h1>` listing all `<h2>` sections as a numbered list
of anchor links. Assign `id` attributes to every `<h2>` and `<h3>` tag.

---

## Step 4 — Quality checklist before outputting

- [ ] Every document / file has been read in full
- [ ] No topic from the source material is missing
- [ ] Language matches the user's request
- [ ] All formulas are in plain text (no LaTeX)
- [ ] CSS is fully embedded — no external links
- [ ] Table of contents links work (anchor IDs set)
- [ ] Tables used for comparisons, lists for sequences/definitions
- [ ] File is a single `.html` file saved to `/mnt/user-data/outputs/`

---

## Step 5 — Output

Save the file as:
```
/mnt/user-data/outputs/[exam-name-slug]-summary.html
```

Then call `present_files` with the path so the user can download it.

Do **not** print the HTML in the chat. Respond with a brief confirmation noting:
- How many source files were processed
- How many macro-topics were covered
- The output filename

---

## Edge cases

| Situation | Action |
|---|---|
| Language not specified | Ask before generating |
| Only one file uploaded | Still apply full structure; cover all sections |
| File is an image of handwritten notes | Transcribe/describe content visually, include in summary |
| Source files in a different language from requested output | Translate content into requested output language |
| Conflicting information across files | Note the conflict and present both versions |
| Very short source material | Still produce full HTML structure; keep content concise but complete |

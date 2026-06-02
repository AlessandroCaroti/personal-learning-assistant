# Exam Summary → HTML — Ready-to-use prompt

Copy everything inside the box below and paste it into Claude, ChatGPT, Gemini, or any
other AI chat. Then attach your study files and send.

Fill in the two placeholders before sending:
  • [EXAM NAME]  →  e.g. "Analisi Matematica II" or "Organic Chemistry"
  • [LANGUAGE]   →  e.g. "Italian", "English", "French", "Spanish" …

---

## ✂️ — COPY FROM HERE —————————————————————————————————————

I have attached my study documents for the exam: **[EXAM NAME]**.

Read every attached file in full — PDFs, slides, notes, images — without skipping or skimming anything. Then produce a single, complete, self-contained HTML file as described below. Reply with only the raw HTML code, nothing else.

---

### OUTPUT LANGUAGE
Write all content (headings, text, definitions, notes) in **[LANGUAGE]**.

---

### HTML STRUCTURE

```
<!DOCTYPE html>
<html lang="LANG_CODE">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[EXAM NAME] – Riassunto</title>
  <style> /* all CSS here, no external files */ </style>
</head>
<body>
  <h1>[EXAM NAME]</h1>
  <nav> <!-- table of contents with anchor links --> </nav>
  <section>
    <h2 id="...">Macro-topic</h2>
    <h3 id="...">Sub-topic</h3>
    <!-- content -->
  </section>
</body>
</html>
```

- `<h1>` — exam name (once, at the top)
- `<h2>` — one per main chapter / macro-topic
- `<h3>` — one per sub-topic or concept group
- Every `<h2>` and `<h3>` must have a unique `id` attribute for the TOC links

---

### TABLE OF CONTENTS

Right after `<h1>`, insert a `<nav>` block with a numbered list of links to every `<h2>` section.

```html
<nav>
  <strong>Indice</strong>
  <ol>
    <li><a href="#topic-1">Topic 1</a></li>
    <li><a href="#topic-2">Topic 2</a></li>
  </ol>
</nav>
```

---

### CONTENT FORMATTING RULES

| Content type | HTML to use |
|---|---|
| Definition or key concept | `<div class="definition"><strong>Term:</strong> explanation</div>` |
| Formula or equation | `<div class="formula">E = m · c²</div>` |
| Important note or exception | `<div class="note">…</div>` |
| Comparison between 2+ things | `<table>` with a header row |
| Ordered steps / algorithm | `<ol>` |
| Unordered list of items | `<ul>` |
| Regular explanation | `<p>` |

**Formulas**: always plain Unicode — never LaTeX or MathML.
Use: `·` (multiply), `√` (root), `²` `³` (powers), `∑` (sum), `∫` (integral), `∞` (infinity), `→` (arrow), `≈` (approx), `Δ` (delta).

---

### CSS (embed fully inside `<style>`)

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
h1 {
  font-size: 2rem;
  color: #1a3a6e;
  border-bottom: 3px solid #2c5f9e;
  padding-bottom: .5rem;
}
h2 {
  font-size: 1.5rem;
  color: #2c5f9e;
  margin-top: 2.5rem;
  border-left: 4px solid #2c5f9e;
  padding-left: .75rem;
}
h3 {
  font-size: 1.15rem;
  color: #444;
  margin-top: 1.5rem;
}
p  { margin: .6rem 0; }
ul, ol { margin: .5rem 0 .5rem 1.5rem; }
li { margin-bottom: .35rem; }
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
  font-size: .95rem;
}
th {
  background: #2c5f9e;
  color: #fff;
  padding: .55rem .8rem;
  text-align: left;
}
td {
  border: 1px solid #ccd;
  padding: .5rem .8rem;
  vertical-align: top;
}
tr:nth-child(even) td { background: #f5f7fb; }
.formula {
  background: #f0f4fa;
  border-left: 3px solid #7aaddc;
  padding: .4rem .8rem;
  font-family: monospace;
  margin: .5rem 0;
  border-radius: 3px;
}
.definition {
  background: #fffbe6;
  border-left: 3px solid #f0c040;
  padding: .4rem .8rem;
  margin: .5rem 0;
  border-radius: 3px;
}
.note {
  background: #f0fff4;
  border-left: 3px solid #4caf50;
  padding: .4rem .8rem;
  margin: .5rem 0;
  font-style: italic;
  border-radius: 3px;
}
nav {
  background: #f5f7fb;
  border: 1px solid #dde;
  border-radius: 6px;
  padding: 1rem 1.5rem;
  margin-bottom: 2rem;
}
nav strong { font-size: 1.05rem; }
nav ol { margin: .4rem 0 0 1.2rem; }
nav a { color: #2c5f9e; text-decoration: none; }
nav a:hover { text-decoration: underline; }
```

---

### COMPLETENESS RULES

- Cover **every** topic, definition, theorem, formula, and example present in the attached files. Do not summarise at a high level and omit details — include everything.
- If the same concept appears in multiple files, merge it into one coherent explanation.
- If two files contradict each other on a point, include both versions and flag the discrepancy with a `<div class="note">`.
- Do not add topics that are not in the source material.

---

### FINAL OUTPUT

Reply with **only** the complete HTML code — no introduction, no explanation, no markdown fences. The response should start with `<!DOCTYPE html>` and end with `</html>`.

## ✂️ — COPY UP TO HERE ———————————————————————————————————

---

## How to use

1. Copy the block above (from `<!DOCTYPE` … to the last `</html>` line — i.e. everything between the cut markers).
2. Replace `[EXAM NAME]` and `[LANGUAGE]` with your values.
3. Open Claude / ChatGPT / Gemini and paste the prompt into the message box.
4. Attach all your study files (PDF, PPTX, DOCX, images of notes, …).
5. Send. The AI will reply with the full HTML code.
6. Copy the HTML, paste it into a plain text editor (Notepad, TextEdit, VS Code …), save as `summary.html`, and open it in your browser.

## Tips

- The more files you attach, the more complete the summary. Attach everything.
- If the output is cut off mid-way (very long documents), ask: "Continue from where you stopped" and paste the two pieces together.
- To add a dark-mode version later, just ask: "Add a CSS dark mode toggle to this HTML file" and paste the file back.

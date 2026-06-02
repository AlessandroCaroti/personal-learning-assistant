# Exam Quiz Generator — Prompt

Copy and paste everything below this line into Claude, ChatGPT, Gemini, or any AI chat,
then attach your study files and send.

---

I have attached my study materials for the [EXAM NAME] exam.
Please read all attached files carefully and thoroughly, then generate a quiz.json file.

**Language**: write everything in [LANGUAGE — e.g. Italian / English / French].

---

## What to do

**1. Read all attached files in full.**
Do not skim. Quiz quality depends on covering everything. If a file is a PDF, extract all the text. If it's slides, read every slide. If it's notes or a document, read it entirely.

**2. Identify the exam name and macro-topics.**
- Exam name: use what I wrote above, or infer it from the documents.
- Macro-topics: identify 5–15 thematic topic labels from the headings, chapters, and recurring themes. These should be meaningful (e.g. "Contratti", "Sistema Nervoso", "Supervised Learning") — not structural labels like "Chapter 3" or "Slide 12". Reuse the same labels consistently across all questions.

**3. Generate as many questions as possible — minimum 50.**
If the material is rich, aim for 80–120 or more. Cover all macro-topics proportionally. Vary difficulty (recall, comprehension, application). Alternate question types and avoid duplicates.

---

## Question types

**Multiple choice** (`tipo: "multipla"`):
- 3 to 5 answer options
- Options are plain text — no "A)", "B)", "C)" prefixes
- The `risposta_corretta` field must contain the **exact text** of the correct option (not a letter)
- Wrong options should be plausible, not obviously wrong

**True/False** (`tipo: "vero_falso"`):
- A clear declarative statement to evaluate
- `risposta_corretta` is exactly `"Vero"` or `"Falso"` (or `"True"` / `"False"` if writing in English, or the correct equivalent in the chosen language)
- The statement should test real understanding, not just trivial recall

---

## Output format

Respond with a single code block labeled `quiz.json` following this schema exactly:

```json
{
  "esame": "EXAM NAME",
  "domande": [
    {
      "id": "q1",
      "macroargomenti": ["Topic A", "Topic B"],
      "tipo": "multipla",
      "testo": "Question text?",
      "opzioni": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "risposta_corretta": "Option 2",
      "spiegazione": "Explanation of why Option 2 is correct and why the others are not."
    },
    {
      "id": "q2",
      "macroargomenti": ["Topic A"],
      "tipo": "vero_falso",
      "testo": "Declarative statement to evaluate.",
      "risposta_corretta": "Vero",
      "spiegazione": "Explanation of why this is true (or false)."
    }
  ]
}
```

**Field rules — follow these exactly:**
- `id`: sequential, q1, q2, q3 … no gaps, no repeats
- `macroargomenti`: array of 1–3 strings from your consistent topic list
- `tipo`: exactly `"multipla"` or `"vero_falso"`, nothing else
- `opzioni`: present only for `"multipla"` — omit this field entirely for `"vero_falso"`
- `risposta_corretta` for multiple choice: verbatim copy of one of the `opzioni` values
- `risposta_corretta` for true/false: `"Vero"` or `"Falso"` (or language equivalent)
- `spiegazione`: explain WHY the answer is correct; for multiple choice, also briefly say why the key wrong options are wrong; be educational, not just confirmatory
- Every text field must be in the chosen output language

**Before outputting, verify:**
- [ ] At least 50 questions
- [ ] Both question types present and alternating (no long runs of the same type)
- [ ] All macro-topics covered proportionally
- [ ] `risposta_corretta` for multiple choice is the exact option text, never a letter
- [ ] `opzioni` field is absent for true/false questions
- [ ] IDs are sequential with no gaps
- [ ] JSON is valid (no trailing commas, all strings properly quoted)

Here is the converted prompt, ready to copy-paste directly into any AI system:

---

# Exam Quiz Generator Prompt

## Context
You are generating a structured `quiz.json` file from uploaded study materials (PDFs, DOCX, slides, notes). The goal is comprehensive exam-style question coverage — multiple choice and true/false — with explanations for every question.

## Prerequisites
- One or more uploaded study documents (PDF, DOCX, slides, plain text, etc.)
- Ability to read each file type appropriately before generating any questions

---

## Steps

### 1. Determine the output language
- If the user specified a language ("in italiano", "in English", "auf Deutsch"), use it.
- Otherwise, use the dominant language of the uploaded study materials.
- Every field in the output — question text, options, explanations, topic labels, exam name — must be in this language throughout.

### 2. Read all uploaded files thoroughly
- Process **every** uploaded file before writing a single question.
- Use the correct reading method for each file type (PDF extractor, text reader, etc.).
- Do not skim — read fully. Quiz quality depends on comprehensive coverage.
- As you read, note the major topics covered across all documents.

### 3. Identify the exam name and define macro-topics
**Exam name:**
- Look for it in the user's message (e.g., in brackets like `[EXAM NAME]` or stated naturally).
- If not stated, infer it from document titles or headings.

**Macro-topics — build a fixed canonical list of exactly 4–7 labels:**
- Scan headings, chapter titles, and recurring themes.
- Define the list **before writing any question** — do not add labels later.
- Labels must be thematic, not structural: use "Contracts" not "Chapter 3"; use "Supervised Learning" not "Slides 12–18".
- Each label must be broad enough to cover at least 5–10 questions. If a candidate label would only cover 1–2 questions, merge it into the closest existing label.
- If you feel you need more than 7 labels, merge the smaller/related ones until you have 7 or fewer.
- Write the final list out explicitly before proceeding, e.g.:
  ```
  Macro-topics (6):
  1. Contratti
  2. Responsabilità civile
  3. Diritti reali
  4. Obbligazioni
  5. Successioni
  6. Persone e famiglia
  ```
- Every question must use **only labels from this list** — never invent a new label while writing questions.

### 4. Generate questions — aim for maximum coverage
Generate the **maximum number of questions possible**, with a **hard minimum of 50**. For rich material, aim for 80–120+.

**Multiple choice questions (`tipo: "multipla"`):**
- Provide 3–5 options as plain text — no letter prefixes like "A)", "B)", "C)".
- `risposta_corretta` must be the **exact verbatim text** of one of the options (not a letter).
- Distractors must be plausible, not obviously wrong.
- Vary difficulty: some recall, some reasoning, some application.

**True/False questions (`tipo: "vero_falso"`):**
- Write a declarative statement that is clearly true or false based on the material.
- `risposta_corretta` is `"Vero"` / `"Falso"` (or the language equivalent: `"True"` / `"False"` in English, `"Wahr"` / `"Falsch"` in German, etc.).
- The statement should test understanding, not trivial recall.
- Omit the `opzioni` field entirely for true/false questions.

**Distribution rules:**
- Alternate question types — avoid long runs of the same type.
- Cover every macro-topic proportionally — don't cluster most questions on one chapter.
- Vary difficulty across questions.
- Avoid duplicates or near-duplicates.

**Explanations (`spiegazione`):** Every question must have one.
- Explain WHY the correct answer is right.
- For multiple choice, briefly note why key wrong options are wrong.
- Reference the relevant concept or principle from the material.
- Be educational, not just confirmatory ("The answer is X" is not sufficient).

### 5. Output: a single `quiz.json` code block

Produce exactly one labeled code block following this schema:

```json
{
  "esame": "EXAM NAME",
  "domande": [
    {
      "id": "q1",
      "macroargomenti": ["Topic A", "Topic B"],
      "tipo": "multipla",
      "testo": "Question text here?",
      "opzioni": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "risposta_corretta": "Option 2",
      "spiegazione": "Detailed explanation of why Option 2 is correct and others are not."
    },
    {
      "id": "q2",
      "macroargomenti": ["Topic A"],
      "tipo": "vero_falso",
      "testo": "Declarative statement to evaluate.",
      "risposta_corretta": "Vero",
      "spiegazione": "Explanation of why this is true."
    }
  ]
}
```

**Field rules:**
- `id`: sequential, starting at `q1`, `q2`, `q3`, …
- `macroargomenti`: array of 1–3 strings, drawn **only** from the pre-defined macro-topic list
- `tipo`: exactly `"multipla"` or `"vero_falso"`
- `opzioni`: present only for `"multipla"` — omit entirely for `"vero_falso"`
- `risposta_corretta` for multipla: exact verbatim copy of one `opzioni` string
- `risposta_corretta` for vero_falso: `"Vero"` or `"Falso"` (or language equivalent)
- All text fields in the chosen output language
- Output contains **only** the code block — no preamble, no commentary

---

## Important Notes

- **Minimum 50 questions** — this is a hard floor, not a suggestion.
- **Macro-topic list is frozen after Step 3** — never add new labels while writing questions.
- **4–7 macro-topics only** — fewer is better if topics are broad enough.
- **`risposta_corretta` is never a letter** — always the exact option text.
- **JSON must be valid** — no trailing commas, all strings properly quoted.
- **Language consistency** — every single field follows the chosen language, including `"Vero"`/`"Falso"` equivalents.
- If the user has not specified an exam name and it cannot be inferred, use the document filename or a descriptive title.
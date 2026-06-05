---
name: exam-quiz-generator
description: >
  Use this skill whenever a user uploads study materials (PDFs, DOCX, slides, notes)
  and asks to generate quiz questions, exam practice questions, a question bank, or
  flashcard-style JSON for a specific exam or course. Triggers include phrases like
  "genera domande per l'esame", "crea un quiz", "ho allegato i miei documenti di
  studio", "make quiz questions from my notes", "generate practice questions",
  "create a question bank", "turn my study materials into quiz", or any variant
  of "study document + generate questions". Always use this skill when the user
  has attached study files and wants structured quiz output — even if they say
  things like "analyze my notes" or "help me study", because generating a quiz.json
  is almost always the most useful output in those situations.
---

# Exam Quiz Generator

## What this skill does

This skill extracts knowledge from uploaded study documents and generates a single structured
`quiz.json` file containing a comprehensive set of multiple-choice and true/false questions
that cover the material comprehensively.


## Step-by-step instructions

## Step 1. Identify the output language

Before doing anything else, check:
1. Did the user specify a language? ("in italiano", "in English", "auf Deutsch") → use that.
2. If not specified, use the dominant language of the uploaded study materials.

Hold onto this choice — every field in quiz.json (question text, options,
explanations, macro-topics, even the exam name) must be written in that language.


## Step 2. Read all uploaded files thoroughly

- Process every uploaded file before generating any quiz questions.
- Use appropriate reading tools for each file type (PDF extractor, text reader, etc.).
- Use the file-reading skill logic to read every uploaded file correctly based on its type.
- Identify the major topics covered across all documents — these become the `macroargomenti`.

Read all files fully — don't just skim. The quiz quality depends on comprehensive coverage.


## Step 3. Identify exam name and macro-topics

After reading all materials:

1. **Exam name**: Look for the exam name in the user's message. It may appear in brackets like `[NOME ESAME]` or stated naturally. If not stated, infer from the document titles or headings.

2. **Macro-topics**: scan headings, chapter titles, and recurring themes. Build a
   **fixed canonical list of exactly 4–7 macro-topic labels** that will be reused
   across all questions. This list must be defined **before** writing any question
   and must not grow afterwards.

   Rules for building the list:
   - **4–7 labels only** — if you feel you need more, merge the smaller/related ones.
   - Labels are thematic, not structural: use "Contratti" not "Capitolo 3"; use
     "Supervised Learning" not "Slide 12–18".
   - Each label must be broad enough to cover multiple questions (at least 5–10 per
     topic). If a candidate label would only cover 1–2 questions, merge it into the
     closest existing label.
   - Write out the final list explicitly before proceeding to Step 3, e.g.:
     ```
     Macro-topics (6):
     1. Contratti
     2. Responsabilità civile
     3. Diritti reali
     4. Obbligazioni
     5. Successioni
     6. Persone e famiglia
     ```
   - Every question must use **only labels from this list** — never invent a new
     label while writing questions.


## Step 4. Generate questions — aim for maximum coverage

Generate the **maximum number of questions possible** from the material, with a
**hard minimum of 50**. If the material is rich enough, aim for 80–120+.

### Question types

**Multiple choice (`tipo: "multipla"`)**:
- 3 to 5 options
- Options are plain text — no letter prefixes like "A)", "B)", "C)"
- `risposta_corretta` must be the **exact text** of one of the options (not a letter)
- Distractors should be plausible, not obviously wrong
- Vary difficulty: some recall, some reasoning, some application

**True/False (`tipo: "vero_falso"`)**:
- A declarative statement that is clearly true or false based on the material
- `risposta_corretta` is either `"Vero"` or `"Falso"` (or the equivalent in the output language — e.g., `"True"` / `"False"` in English, `"Wahr"` / `"Falsch"` in German)
- The statement should test understanding, not trivial recall

### Distribution rules
- Alternate question types: avoid long runs of the same type
- Cover every macro-topic proportionally — don't cluster 80% of questions on one chapter
- Vary difficulty across questions
- Avoid duplicates or near-duplicates

### Explanations
Each question must have a `spiegazione` (explanation):
- Explain WHY the correct answer is right
- Briefly note why the key wrong options are wrong (for multiple choice)
- Reference the relevant concept or principle from the material
- Be educational, not just confirmatory ("The answer is X" is not a good explanation)


## Step 5. Output: quiz.json

Produce exactly one labeled code block: `quiz.json`. The schema is:

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
- `id`: sequential, starting at `q1`, `q2`, `q3`, ...
- `macroargomenti`: array of 1–3 topic strings from your consistent macro-topic list
- `tipo`: exactly `"multipla"` or `"vero_falso"`
- `opzioni`: only present for `"multipla"` type (omit entirely for `"vero_falso"`)
- `risposta_corretta` for multipla: exact verbatim copy of one of the `opzioni` strings
- `risposta_corretta` for vero_falso: `"Vero"` or `"Falso"` (or language equivalent)
- All text fields in the user's chosen output language

Present the output as a single labeled code block:

```
quiz.json
\`\`\`json
{ ... }
\`\`\`
```


## Quality checklist (run mentally before outputting)

- [ ] At least 50 questions generated
- [ ] Both `multipla` and `vero_falso` types present and alternating
- [ ] Macro-topic list contains **4–7 labels** — no more, no fewer
- [ ] Every macro-topic is covered (no topic left out)
- [ ] No question uses a label that wasn't in the pre-defined macro-topic list
- [ ] No `risposta_corretta` is a letter — it's always the exact option text
- [ ] `opzioni` field omitted for `vero_falso` questions
- [ ] All `id` values are sequential with no gaps or repeats
- [ ] Explanations are substantive and educational
- [ ] Output language matches user's choice throughout
- [ ] JSON is valid (no trailing commas, properly quoted strings)
- [ ] Response contains only the code block, nothing else


## Example (Italian, partial)

```json
{
  "esame": "Diritto Privato",
  "domande": [
    {
      "id": "q1",
      "macroargomenti": ["Contratti", "Obbligazioni"],
      "tipo": "multipla",
      "testo": "Quale tra i seguenti elementi è essenziale per la validità di un contratto?",
      "opzioni": [
        "La forma scritta",
        "L'accordo tra le parti",
        "La presenza di un notaio",
        "La registrazione presso l'Agenzia delle Entrate"
      ],
      "risposta_corretta": "L'accordo tra le parti",
      "spiegazione": "Secondo l'art. 1325 c.c., gli elementi essenziali del contratto sono: accordo, causa, oggetto e, quando richiesta dalla legge, la forma. L'accordo tra le parti è sempre necessario. La forma scritta è richiesta solo in casi specifici (art. 1350 c.c.); il notaio e la registrazione non sono elementi generalmente richiesti."
    },
    {
      "id": "q2",
      "macroargomenti": ["Responsabilità civile"],
      "tipo": "vero_falso",
      "testo": "La responsabilità extracontrattuale richiede sempre la prova del dolo da parte del danneggiante.",
      "risposta_corretta": "Falso",
      "spiegazione": "L'art. 2043 c.c. prevede la responsabilità per fatto illecito doloso o colposo. Non è necessario il dolo: anche la semplice colpa (negligenza, imprudenza, imperizia) è sufficiente per far sorgere l'obbligo di risarcimento."
    }
  ]
}
```

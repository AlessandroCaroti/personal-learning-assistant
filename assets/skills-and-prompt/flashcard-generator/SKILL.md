---
name: flashcard-generator
description: >
  Generates a comprehensive flashcard.json file from uploaded study documents for an exam or course.
  Use this skill whenever the user uploads study materials (PDFs, notes, slides, textbook chapters, etc.)
  and asks to generate flashcards, study cards, or a flashcard JSON file for an exam or subject.
  Also trigger when the user says things like "create flashcards from my notes", "generate study cards",
  "make flashcards for my exam", "extract flashcards from this document", or when they mention
  attaching study documents for a specific exam/course name. The output is always a single
  well-structured flashcard.json file with a minimum of 60 cards.
---

# Flashcard Generator

## What this skill does

This skill extracts knowledge from uploaded study documents and generates a single structured `flashcard.json` file
containing a comprehensive set of flashcards that cover the material comprehensively.

## Step-by-step instructions

## Step 1. Identify the output language

Before doing anything else, check:
1. Did the user specify a language? ("in italiano", "in English", "auf Deutsch") → use that.
2. If not specified, use the dominant language of the uploaded study materials.

Hold onto this choice — every field in flashcard.json (question text, options,
explanations, macro-topics, even the exam name) must be written in that language.


### Step 2. Read all uploaded files thoroughly

- Process every uploaded file before generating any cards.
- Use appropriate reading tools for each file type (PDF extractor, text reader, etc.).
- Use the file-reading skill logic to read every uploaded file correctly based on its type.
- Identify the major topics covered across all documents — these become the `macroargomenti`.

Read all files fully — don't just skim. The flashcard quality depends on comprehensive coverage.

### Step 3. Identify exam name and macro-topics

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

### Step 4. Generate flashcards — aim for maximum coverage

- **Minimum: 60 cards.** If the material supports more, generate more. Quality and quantity both matter.
- Every important concept, definition, theorem, formula, method, or fact should become a card.
- Do not skip minor but exam-relevant details.

**Fronte (front)** — the question or prompt side:
- Use open questions ("What is...?", "How does...work?", "What are the conditions for...?")
- Or use a key term / formula that the student must be able to explain
- Keep it concise and unambiguous

**Retro (back)** — the answer side:
- Must be complete and self-contained. A student reading only the back should fully understand the answer without needing any other context.
- Include definitions, steps, formulas, examples, exceptions, and caveats where relevant.
- Avoid one-word answers — even simple terms deserve a proper definition.

### Step 5. Output format

Produce exactly one labeled code block: `flashcard.json`. The schema is:

```json
{
  "esame": "<EXAM NAME>",
  "carte": [
    {
      "id": "f1",
      "macroargomenti": ["Topic A"],
      "fronte": "question, term, or concept",
      "retro": "complete, self-contained answer or definition"
    },
    {
      "id": "f2",
      "macroargomenti": ["Topic A", "Topic B"],
      "fronte": "another question",
      "retro": "another complete answer"
    }
  ]
}
```

**Rules:**
- `id` values are sequential: `f1`, `f2`, `f3`, …
- `macroargomenti` is an array — a card can belong to more than one macro-topic if it's genuinely cross-cutting
- `esame` matches the exam/course name the user specified
- Cards are ordered loosely by macro-topic for readability, but do not break up the array into sub-arrays
- No trailing commas, valid JSON only

### Step 6. Response format — strict

Respond with **only** the labeled code block. No preamble, no explanation, no summary, no additional commentary. The entire response should be:

````
```flashcard.json
{ ... }
```
````

Nothing else.

## Quality checklist (run mentally before outputting)

- [ ] At least 60 cards generated
- [ ] Macro-topic list contains **4–7 labels** — no more, no fewer
- [ ] Every major concept from the documents is covered
- [ ] Each `retro` is self-contained and complete
- [ ] `macroargomenti` labels are consistent and match the content
- [ ] IDs are sequential (f1, f2, f3…)
- [ ] Output language matches user's request
- [ ] JSON is valid (no syntax errors)
- [ ] Response contains only the code block, nothing else

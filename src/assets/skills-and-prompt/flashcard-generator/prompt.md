Here is the converted prompt:

---

# Flashcard Generator Prompt

## Context
Generate a comprehensive `flashcard.json` file from uploaded study documents. The output is a single, well-structured JSON file with a minimum of 60 flashcards covering the material thoroughly — suitable for exam preparation.

## Prerequisites
- One or more uploaded study files (PDFs, notes, slides, textbook chapters, etc.)
- The exam or course name (stated by the user, or inferable from the documents)
- Ability to read the uploaded file types (PDF, text, etc.)

## Steps

### 1. Determine the output language
- If the user specified a language (e.g. "in italiano", "in English"), use that.
- Otherwise, use the dominant language of the uploaded study materials.
- **Every field** in the JSON — questions, answers, topic labels, exam name — must be written in this language. Lock this in before proceeding.

### 2. Read all uploaded files thoroughly
- Process every uploaded file before writing any cards.
- Use the appropriate reading method for each file type (PDF extractor, plain-text reader, etc.).
- Do not skim — read fully. Flashcard quality depends on comprehensive coverage.
- As you read, note the major themes, headings, chapter titles, and recurring concepts.

### 3. Define the exam name and macro-topics
- **Exam name**: Look for it in the user's message (e.g. in brackets like `[EXAM NAME]`) or infer it from document titles and headings.
- **Macro-topics**: Build a **fixed canonical list of exactly 4–7 thematic labels** before writing any card. Rules:
  - Use thematic labels, not structural ones ("Contracts" not "Chapter 3").
  - Each label must be broad enough to cover at least 5–10 questions; merge smaller ones.
  - Do not add new labels after the list is finalized.
  - Write out the list explicitly at this step, e.g.:
    ```
    Macro-topics (5):
    1. Civil Liability
    2. Contracts
    3. Property Rights
    4. Obligations
    5. Succession
    ```

### 4. Generate the flashcards
- **Minimum 60 cards.** Generate more if the material supports it.
- Cover every important concept, definition, theorem, formula, method, and exam-relevant detail.
- **Front (`fronte`)** — the question or prompt side:
  - Use open questions ("What is…?", "How does…work?", "What are the conditions for…?") or a key term/formula the student must explain.
  - Keep it concise and unambiguous.
- **Back (`retro`)** — the answer side:
  - Must be complete and self-contained — a student reading only the back should fully understand without any other context.
  - Include definitions, steps, formulas, examples, exceptions, and caveats where relevant.
  - Never give one-word answers; even simple terms need a proper definition.
- Assign each card one or more macro-topic labels from the fixed list (Step 3). Never invent new labels here.

### 5. Produce the output JSON
- Output exactly one labeled code block: ` ```flashcard.json `.
- Follow this schema precisely:

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

- `id` values are sequential: `f1`, `f2`, `f3`, …
- `macroargomenti` is an array; a card may belong to more than one topic if genuinely cross-cutting.
- Cards are ordered loosely by macro-topic for readability (no sub-arrays).
- Output must be valid JSON — no trailing commas, no syntax errors.

### 6. Format the response
- Respond with **only** the labeled code block. No preamble, no explanation, no summary, no commentary before or after.

## Important Notes
- **Language lock**: Once determined in Step 1, the language must be used consistently throughout — do not mix languages in any field.
- **Macro-topic count is strict**: Exactly 4–7 labels. If you feel you need more, merge the smaller/related ones.
- **Self-contained answers are mandatory**: Every `retro` must stand alone. A student should never need to look elsewhere to understand the answer.
- **Quality checklist before outputting**:
  - [ ] At least 60 cards generated
  - [ ] Macro-topic list has exactly 4–7 labels
  - [ ] Every major concept from the documents is covered
  - [ ] Each `retro` is self-contained and complete
  - [ ] `macroargomenti` labels are consistent and from the fixed list only
  - [ ] IDs are sequential (`f1`, `f2`, `f3`…)
  - [ ] Output language matches user's request
  - [ ] JSON is valid (no syntax errors)
  - [ ] Response contains only the code block, nothing else
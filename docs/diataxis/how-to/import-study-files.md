# How-to: Import study files

Use this guide when you already know which exam you want to work with and you need to load quiz, flashcard, or summary content into the app.

## Supported file types

- `quiz.json`
- `flashcard.json`
- `.html` summaries
- `.pdf` summaries
- `.docx` summaries

## Before you start

- The exam should already exist in the app.
- The file must match the repository schema.
- Quiz and flashcard JSON are validated before they are stored.

## Import a quiz file

1. Open the exam dashboard.
2. Choose the quiz import action.
3. Select a `quiz.json` file.
4. Let the app validate the file.
5. Save the file only if validation succeeds.

## Import a flashcard file

1. Open the exam dashboard.
2. Choose the flashcard import action.
3. Select a `flashcard.json` file.
4. Let the app validate the file.
5. Save the file only if validation succeeds.

## Import a summary file

1. Open the exam dashboard.
2. Choose the summary import action.
3. Select an `.html`, `.pdf`, or `.docx` file.
4. Open the summary from the dashboard or summary page.

## If validation fails

- Check the JSON structure against the expected schema.
- Make sure `risposta_corretta` matches one of the listed options exactly.
- For `tipo: "vero_falso"`, use `Vero` or `Falso` exactly.
- Fix the source file and import it again.

## If a paused session exists

When you import a new study file for an exam, clear any paused session for the same exam and study mode if the app prompts for it. This avoids resuming stale state from an older version of the file.

## Related reference

- [Data model reference](../reference/data-model.md)
- [Command reference](../reference/commands.md)
- [Integration reference](../reference/integrations.md)


# Where to drop textbook PDFs

Drop your PDFs here, one folder per class:

```
data/raw/clean/
  class-6/
    <any-filename>.pdf
    <any-filename>.pdf
    ...
  class-7/
    ...
  class-8/
    ...
  class-9/   ← already populated
```

You **do not** need to organise by subject — the ingester reads each
filename and figures out the subject by keyword (Math/Geometry/Algebra →
MTH, Science/Vigyan → GSC, Geography/History/Civics → SSC, Odia/MIL →
FLO, English → SLE, Hindi → TLH).

## Filename hints (helps the auto-classifier)

Make sure the filename contains an obvious subject keyword:

| Subject | Filename should mention any of |
|---|---|
| Mathematics (`MTH`) | `math`, `algebra`, `geometry`, `bijaganit` |
| Science (`GSC`) | `science`, `physics`, `chemistry`, `biology`, `vigyan` |
| Social Science (`SSC`) | `social`, `geography`, `history`, `civics`, `bhugola` |
| Odia (`FLO`) | `odia`, `mil`, `sahitya`, `ଓଡ଼ିଆ` |
| English (`SLE`) | `english` |
| Hindi (`TLH`) | `hindi`, `हिन्दी`, `ହିନ୍ଦୀ` |

Examples that classify cleanly:
- `class6_math_chapter01.pdf` → Class 6 · MTH · textbook
- `vigyan_class7_full.pdf` → Class 7 · GSC · textbook
- `ncert_english_class8.pdf` → Class 8 · SLE · textbook

### Syllabus PDFs

Drop syllabus PDFs in the **same** per-class folder. Add the word
`syllabus` (or `curriculum`) anywhere in the filename and the ingester
will tag them as `source_type=syllabus` instead of `textbook`. Example:

- `class6_math_syllabus.pdf` → Class 6 · MTH · syllabus
- `bse_class7_science_curriculum.pdf` → Class 7 · GSC · syllabus

## After uploading

Run, for each class you've populated:

```powershell
npm run ingest:class -- --class 6
npm run ingest:class -- --class 7
npm run ingest:class -- --class 8
```

The script will:
1. Auto-create the 6 subject rows in the DB for that class (if missing).
2. Extract text from each PDF (uses Tesseract OCR if there's no text layer).
3. Chunk + embed via Gemini.
4. Insert into `documents` + `chunks` tables tagged with the right
   `(subject_id, class_level)`.

Once that finishes, students of that class can already use the **Ask
tutor** chat — Gemini will retrieve from their class-specific textbooks.

> Browsing the structured `/today` daily plan and `/b/.../c/6/...` chapter
> pages requires curated chapter+topic rows. We'll generate those from
> the PDFs you uploaded in a follow-up step.

# 💭 Thought Organizer

Thought Organizer is an application that helps you recover the meaning and
next steps in your own notes without requiring you to mentally reconstruct
the state you were in when you wrote them — scattered, rushed, interrupted,
or just written faster than you could organize them. Everything runs
on-device; no note ever leaves your browser.

Thought Organizer is powered by the independently maintained
[**Intent Recovery Model**](https://github.com/ThisIsJohnnyt/intent-recovery-model)
— the fine-tuning pipeline, dataset, and evaluation methodology live there,
not in this repository. See its
[Inference Contract v1](https://github.com/ThisIsJohnnyt/intent-recovery-model/blob/main/docs/inference-contract.md)
for the versioned boundary between the two — the canonical copy lives in
that repo, not duplicated here.

## 🎯 What it does

Notes come in fragments — interrupted thoughts, several topics interleaved
in one note, a task buried inside a longer reflection. Thought Organizer
takes that raw input (voice or text) and recovers:

1. **Narrative** — the same content, rewritten as one coherent passage
2. **Key Points** — the distinct topics, preserved as separate items
3. **Action Items** — the actual tasks, and only the actual tasks

## ✨ Features

- **Voice & Text Input** — record thoughts or type them, no need to
  organize as you go
- **On-Device AI** — runs entirely in your browser via `@xenova/transformers`,
  no server, no account
- **Privacy First** — nothing you write is ever sent anywhere
- **Intelligent Chunking** — handles long notes by processing them in
  passes when they exceed the model's context window
- **Note History** — saved locally (IndexedDB), never synced
- **Export Options** — Markdown, JSON, or plain text
- **Dark Mode**

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Modern browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
npm install --ignore-scripts
npm run fetch-model   # downloads the current model release into public/models/
npm run dev
```

The app opens at `http://localhost:5173`.

`npm run fetch-model` downloads, checksum-verifies, and installs the
current [Intent Recovery Model release](https://github.com/ThisIsJohnnyt/intent-recovery-model/releases) —
see [`scripts/fetch-model.mjs`](scripts/fetch-model.mjs). The downloaded
model is gitignored, not committed.

### Building for Production

```bash
npm run build
npm run preview
```

## 📖 How to Use

1. **Enter your thoughts** — type in the textarea, or record a voice note
2. **Click "Organize My Thoughts"** — processed entirely on your device
3. **Review the output** — switch between Narrative, Key Points, and
   Action Items views
4. **Export or save** — Markdown/JSON/plain text, or keep it in history
5. **Revisit anytime** — history panel keeps past organized notes locally

## 🏗️ Architecture

### Frontend
- React 18 + TypeScript, Vite
- Responsive CSS, dark mode

### Model integration
- `@xenova/transformers` for in-browser ONNX inference
- The model itself, its training data, and its evaluation methodology are
  maintained independently — see
  [intent-recovery-model](https://github.com/ThisIsJohnnyt/intent-recovery-model)
- This app depends only on
  [Intent Recovery Inference Contract v1](https://github.com/ThisIsJohnnyt/intent-recovery-model/blob/main/docs/inference-contract.md), not
  the model's internal format — a future model release can change its
  internals freely as long as the contract's major version holds

### Storage
- IndexedDB, local-only: raw input, organized output, recordings, metadata

## 📁 Project Structure

```
src/
├── components/
│   ├── InputPanel.tsx          # Voice + text input
│   ├── ProcessingView.tsx      # Progress indicators
│   ├── OrganizedNotesView.tsx  # Three-tab output display
│   ├── HistoryPanel.tsx        # Saved notes timeline
│   └── App.tsx
├── services/
│   ├── noteOrganizer.ts        # Orchestration
│   └── modelLoader.ts          # transformers.js setup
├── utils/
│   ├── outputParser.ts         # Parses model output into the contract shape
│   └── tokenization.ts         # Chunking for long inputs
└── styles/
scripts/
└── fetch-model.mjs             # Downloads + verifies a model release
```

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| UI Framework | React 18 + TypeScript |
| Build Tool | Vite |
| AI/ML runtime | `@xenova/transformers` (ONNX) |
| Model | [intent-recovery-model](https://github.com/ThisIsJohnnyt/intent-recovery-model) (FLAN-T5-base, fine-tuned) |
| Storage | IndexedDB |
| Styling | CSS3 (no framework) |
| Voice | Web Speech API |

## 🧪 Browser Support

Chrome 120+, Firefox 121+, Safari 17+, Edge 120+

## 📝 Example

**Input**
```
worried about the project deadline tomorrow... also haven't slept well
should probably call mom haven't talked to her in a week
the budget spreadsheet needs updating before friday meeting
```

**Narrative**
> There's an upcoming project deadline creating some worry, and poor sleep
> has been affecting focus. Separately, it's been a week since talking to
> mom, and the budget spreadsheet needs updating before Friday's meeting.

**Key Points**
- Project deadline is tomorrow
- Poor sleep affecting focus
- Haven't talked to mom in a week
- Budget spreadsheet needs updating before Friday

**Action Items**
- [ ] Call mom
- [ ] Update budget spreadsheet before Friday meeting

## Issues

Open an issue here for UI problems, storage, packaging, deployment, or
application-level behavior. For dataset, training, evaluation, or model
output/behavior issues, open one in
[intent-recovery-model](https://github.com/ThisIsJohnnyt/intent-recovery-model) instead.

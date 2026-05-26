# Frontal Cortex Companion — Progress

## Product direction
- Not a chatbot. Claude analyses but never speaks in its own voice.
- The app holds the user's own words and reflects them back during self-defeating moments.
- Primary loop: type what you're doing right now → self-defeating parts strike through → your own past words surface as the counter → smallest next step.
- Engaging and action-oriented. Not a database admin panel.

---

## Done

### Global
- `font-serif` removed everywhere — sans throughout
- Destructor runs full-screen outside the Shell (no sidebar)

### Principles page
- `<UNKNOWN>` bounce: when Claude can't extract structure, card is deleted and "Could not structure X — try being more specific" appears
- Verbose description paragraph removed
- Form: shorter placeholder, focus ring, subtler keyboard hint (⌘↵)
- Cards: `shadow-sm` on active, divider above when/then/why breakdown, skeleton pulse during restructuring
- Action buttons reveal on hover + `focus-within` for keyboard access

### Destructor
- Input: full-screen bare textarea, placeholder "what are you doing right now?"
- Analyzing: thin vertical cursor line sweeps left-to-right across dimmed text
- Result:
  - Thought chips at `text-base text-ink/60` — equal visual weight to principle quote
  - Self-defeating spans struck through + further dimmed
  - Left sidebar border + "past you said this" label
  - Principle quote at `text-base` — key phrases bolded via **exact string matching** (not char positions), rest faded
  - Suggested action one line below
  - Framing pattern name in small caps at bottom (user loves this — keep it)
  - "again" to reset
- API: `rewritten` removed, replaced with `principleId` + `principleKeyPhrases[]`

### Today route (NEW — just built, needs Supabase table created)
- New nav item "Today" — first in sidebar
- Three scope tabs: Today / This week / Long-term
- Bare textarea input with scope-specific placeholder, ⌘↵ to save
- Intentions listed as clean text, delete on hover
- Date shown in accent color at top
- **⚠️ NEEDS: Run the intentions table SQL in Supabase dashboard before testing**
  ```sql
  create table if not exists intentions (
    id         uuid        primary key default uuid_generate_v4(),
    user_id    uuid        not null references auth.users(id) on delete cascade,
    text       text        not null,
    scope      text        not null default 'day' check (scope in ('day', 'week', 'longterm')),
    date       date        not null default current_date,
    created_at timestamptz not null default now()
  );
  alter table intentions enable row level security;
  create policy "owner only" on intentions
    using  (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  ```

---

## Next session priorities

### 1. Test Today route
- Run the SQL above in Supabase dashboard
- Test: add intentions in each scope tab, confirm persistence, delete works

### 2. Destructor integration — feed intentions into "past you said this"
- Destructor currently only loads `principles` for the rewrite call
- Should also load today's intentions (scope='day', date=today) + active weekly/longterm intentions
- Pass both to Claude as a combined list with IDs
- Claude returns one `matchedId` — UI searches both arrays for the match
- "past you said this" label should differ:
  - If matched principle: "past you said this"
  - If matched intention: "this morning you said this" (or "this week you said this")
- Files to touch: `Destructor.tsx` (load intentions + merge), `claude.ts` (combined context list), `types.ts` if needed

### 3. Destruction journal
- Log every Destructor run: original thought, struck spans, matched quote, suggested action, framing, timestamp
- Browsable in History route (currently a placeholder)
- Journal/feed format, not a table

### 4. Clickable framing concept
- The pattern name footer ("abstinence violation effect") should open browser with more info
- `shell.openExternal(url)` via Electron — needs IPC bridge addition
- URL: `https://en.wikipedia.org/wiki/Special:Search?search=<framing>`
- Files: `src/preload/index.ts` (expose shell.openExternal), `Destructor.tsx` (make framing clickable)

---

## Pending / discussed but not built

### Chat intake classifier
- Single input that classifies what you typed as: principle / tell / daily intention / raw thought
- Routes accordingly — no need to navigate to specific pages
- Risk: slow or wrong classification erodes trust

### High-energy inbox / "be honest right now"
- Urgent reflection ritual — like writing a letter to your future self, no-filter honesty
- Distinct from Destructor (reactive) — this is a chosen reset
- Placement unclear: part of morning init or separate?

---

## Check-in feature — IN PROGRESS
- DB: `check_ins` table exists in schema.sql ✓
- IPC: `insertCheckIn` / `listCheckIns` handlers in `src/main/ipc/db.ts` ✓
- Hotkey: `Ctrl+Shift+L` opens `checkInWindow` ✓
- UI: `CheckIn.tsx` is a stub — needs 3-point state picker (low/ok/peak), tell chips (uuid refs to tells table), optional freetext story field
- Window: small always-on-top frameless modal (same pattern as Destructor)

## Making it installable — DONE
- `npm run dist` → builds with electron-vite then packages with electron-builder (NSIS one-click installer)
- Output: `dist/Frontal Cortex Setup.exe`
- App boots silently into system tray on launch; main window hidden until opened from tray or hotkey
- Auto-start on Windows login via `app.setLoginItemSettings({ openAtLogin: true })` (production only)
- Tray right-click: Open / Destructor / Check-in / Quit
- Closing the main window hides it to tray (does not quit)
- Icon assets in `resources/` (generated once via `node resources/gen-icons.js`)

## Architecture
- Electron + React + TypeScript + Tailwind + Framer Motion
- Supabase backend (auth + DB); schema in `supabase/schema.sql`
- Claude Sonnet 4.6 via Anthropic SDK — tool use for restructure + destructor
- Destructor route (`/destructor`) renders outside Shell — full screen, no sidebar
- Principles + intentions feed into Destructor rewrite call (intentions integration pending)
- `ThoughtLog` DB type still has `rewritten` field — untouched, used by History

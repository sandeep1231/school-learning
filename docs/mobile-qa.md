# Mobile UI QA checklist

Walk through this on a real low-end Android (e.g. <8 GB RAM, Android 11+,
3G/4G connection) and an iOS device (Safari) before launch. Desktop
browser-at-narrow-width is not a substitute — touch, performance, and
keyboard behaviour all differ.

Mark each row as **pass / fail / N/A** so you have a record.

## Setup

- Devices: at least one budget Android (e.g. Redmi Note ~₹10k tier) and
  one mid-tier iPhone if your audience includes iOS.
- Network: throttle to "Slow 4G" in Chrome dev tools when checking
  Android, OR test on actual cellular outside Wi-Fi.
- Browsers: Chrome on Android, Safari on iOS. Skip Edge/Firefox unless
  you have signal users are on them.
- Cold cache: clear site data + storage before each pass so you measure
  first-load, not warm-cache.

## A. Cold load + first interaction

- [ ] `/` (landing) loads in ≤ 3s on Slow 4G.
- [ ] First visible text ("Sikhya Sathi" + tagline) appears in ≤ 1.5s
      (not blocked by JS bundle).
- [ ] `/today` as guest loads in ≤ 4s; subject grid renders.
- [ ] No layout shifts >0.1 (CLS) during initial render.
- [ ] Tapping any subject card navigates to `/b/...` within ≤ 1s of
      tap (loader skeleton shows immediately).

## B. Touch + reachability

- [ ] All interactive elements are ≥ 44×44 CSS pixels (iOS HIG /
      Android material guideline). Especially check:
      - Chat suggestion chips
      - Difficulty filter pills (`Easy / Medium / Hard`)
      - "Report" link on practice items
      - Stage card CTAs
- [ ] Primary CTAs (Continue, Solve this, Submit) are within thumb
      reach on a 6.5" phone — ideally bottom half of screen.
- [ ] Class/Board dropdown in the header is one-handed accessible.
- [ ] No overlapping touch targets (e.g. two stacked buttons less than
      8px apart).

## C. Forms + keyboards

- [ ] Sign-in OTP input shows the **numeric keyboard** automatically
      (`inputMode="numeric"`).
- [ ] Phone number field shows numeric, doesn't auto-capitalize.
- [ ] Chat textarea: keyboard pushes the send button up; doesn't
      hide it under the keyboard.
- [ ] Practice short-answer textarea: same — keyboard doesn't cover
      submit button.
- [ ] Contact form (`/contact`) message field doesn't auto-capitalize
      every word; respects normal sentence-case behaviour.
- [ ] Form inputs have visible focus rings when navigated by keyboard
      (Bluetooth keyboards on tablets).

## D. Camera / file capture

- [ ] On Android Chrome, the snap button (📷 in chat + the `/ask/photo`
      page) opens the **rear camera directly**, not the gallery.
- [ ] On iOS Safari, the same button opens the camera or a picker
      sheet (iOS lets the user choose).
- [ ] After capture, the preview thumbnail is visible (not a blank
      square).
- [ ] Uploading a 4 MB photo on Slow 4G shows a busy state and
      resolves within 30s; doesn't silently fail.
- [ ] Files >5 MB are rejected client-side with a clear error.

## E. Lesson rendering

- [ ] Markdown body fits the viewport — no horizontal scroll for normal
      paragraphs.
- [ ] Tables overflow horizontally with a clear scroll affordance.
- [ ] Math (KaTeX) renders correctly inline and as display blocks; no
      raw `$...$` visible.
- [ ] Mermaid diagrams: either render correctly or show the
      "Diagram couldn't be rendered — show source" details. **No bomb
      art under any circumstances** (fixed in `MarkdownBody.tsx`).
- [ ] Code blocks have horizontal overflow scroll; don't break layout.
- [ ] Citations panel ("ସୂତ୍ର / Sources") is readable; page numbers
      visible.

## F. Chat

- [ ] Send a message → typing dots appear immediately, response
      streams in within ≤ 3s for first token.
- [ ] Long responses scroll the chat container, not the page.
- [ ] After response completes, citations appear underneath the
      assistant bubble.
- [ ] Auto-scroll to latest message works.
- [ ] Snap photo from chat → user bubble shows "📷 Photo question
      (analyzing the image…)", then replaces with the extracted
      question.
- [ ] Sending a question that triggers Gemini's safety filter doesn't
      crash the UI — shows a friendly fallback message.

## G. Practice + Master

- [ ] All 8 questions load (5 MCQ + 2 short + 1 long).
- [ ] Difficulty filter (`?difficulty=hard`) works; URL param respected.
- [ ] On Master URL, only hard items show by default.
- [ ] Submitting with all answered shows the score banner.
- [ ] On master pass, "Topic mastered!" message; on practice pass,
      "Continue to Master" link visible.
- [ ] On fail, "Try again" resets state without a page reload.

## H. Class switching

- [ ] Dropdown change shows visible spinner.
- [ ] After switch, page re-renders with the new class content (not
      stale Class 9 data).
- [ ] If user was on a deep board-scoped URL, switch redirects to
      `/today` (matches the BoardClassSwitcher logic).
- [ ] Refreshing the page preserves the new class (cookie persisted).

## I. Offline / PWA

- [ ] PWA install prompt appears on second visit (Android Chrome).
- [ ] Visiting `/offline` without network shows the offline page, not
      the browser's default error.
- [ ] Already-loaded routes work briefly when going offline (service
      worker cache).
- [ ] Going back online recovers automatically — no manual reload
      needed for chat/practice.

## J. Localization

- [ ] Every page has Odia (or Hindi) translations alongside English
      where the static copy says so.
- [ ] Odia text renders without missing-glyph boxes (font fallback
      works on all target devices).
- [ ] Right-to-left text doesn't appear (BSE Odisha is all LTR).
- [ ] Dynamic content (lesson body, MCQ options) respects the
      `preferred_language` profile setting.

## K. Performance budget

Measure with Chrome dev tools / Lighthouse on Slow 4G:

- [ ] First Contentful Paint ≤ 2.5s on `/today`
- [ ] Largest Contentful Paint ≤ 4s on `/today`
- [ ] Total Blocking Time ≤ 300ms
- [ ] Cumulative Layout Shift ≤ 0.1
- [ ] Total JS shipped per route ≤ 350 KB gzipped (lessons can be
      higher because of Mermaid lazy-load)
- [ ] No 4xx/5xx in the network tab on cold load

## L. Error states + empty states

- [ ] `/today` for a brand-new guest with no progress: shows welcome
      banner, no "0% complete" oddities.
- [ ] Topic with no lessons: shows the "Coming soon" stage card with
      dashed border (not a broken state).
- [ ] Topic with no practice items: same.
- [ ] Chat after rate-limit hit: friendly "you've reached the hourly
      limit, try again later" — not a 429 dump.
- [ ] Network failure mid-chat: assistant bubble shows "Sorry,
      something went wrong" — chat doesn't lock up.
- [ ] Photo upload without network: clean error, retry possible.
- [ ] 404 page (visit a fake URL like `/whatever`) is branded, not the
      Next.js default.

## M. Accessibility quick pass

- [ ] All images have `alt` attributes (or `aria-hidden="true"` if
      decorative).
- [ ] Buttons have visible focus rings.
- [ ] Headings form a logical hierarchy (h1 → h2 → h3, no skipping).
- [ ] Form inputs have associated `<label>` elements.
- [ ] Color contrast ≥ 4.5:1 for body text. Check the brand color on
      white backgrounds especially.
- [ ] Loaders have `aria-busy` or `role="status"` so screen readers
      announce them.
- [ ] Modals (onboarding) trap focus and dismiss on Escape.

## How to record results

For each session, save:

- Device + OS version
- Browser + version
- Connection type (WiFi / Slow 4G / 3G)
- Pass/fail per checklist item, with screenshots for any fail
- A short narrative of "what felt slow" / "what was confusing" — that
  qualitative read often surfaces things the checklist misses.

# Responsive Editorial Planner Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the existing React planner into a warm, editorial, responsive workspace while preserving all current functionality and the Toronto loading GIF.

**Architecture:** Add a final CSS layer after the existing feature styles, using existing selectors and component structure. Keep logic and data untouched except for any small accessibility or class hooks required by the visual hierarchy.

**Tech Stack:** React 18, TypeScript, Vite, existing CSS, Bricolage Grotesque, Hanken Grotesk.

**Spec:** `docs/superpowers/specs/2026-11-10-responsive-editorial-redesign.md`

## Global Constraints

- Preserve existing routes, data behavior, offline behavior, collaboration, maps, and loading states.
- Preserve `public/loading.gif` unchanged.
- Do not add stock imagery or marketing copy.
- Keep changes in small atomic commits matching the existing `feat:`/`fix:` style.

## Review Focus

- Phone widths: no horizontal overflow and all primary actions remain reachable.
- Desktop trip view: plan/map split remains usable and draggable.
- Sheets and forms: contrast, focus rings, and touch targets remain accessible.
- Loading states: the existing GIF remains visible and unchanged.
- Existing selectors: new visual overrides must not hide functional controls.

### Task 1: Editorial foundation

**Files:** Create `src/styles/editorial.css`; modify `src/main.tsx`.

- [ ] Add the warm paper, ink, muted, line, and accent tokens plus typography and base surface rules.
- [ ] Import the stylesheet after the existing feature styles so it is the final visual layer.
- [ ] Run `npm run build`.
- [ ] Commit with `feat: establish editorial planner visual system`.

### Task 2: Home workspace redesign

**Files:** Modify `src/styles/editorial.css`.

- [ ] Restyle home navigation, lead trip, calendar, trip families, past trips, inbox, and travels states.
- [ ] Preserve all existing links, buttons, filters, and account controls.
- [ ] Add desktop two-column composition and phone single-column behavior without introducing overflow.
- [ ] Run `npm run build`.
- [ ] Commit with `feat: redesign home planning workspace`.

### Task 3: Trip and feature surfaces

**Files:** Modify `src/styles/editorial.css`.

- [ ] Restyle trip header, tabs, itinerary document, lines, map split, saved links, costs, packing, reviews, and sheets.
- [ ] Preserve the existing desktop split-map interaction and phone bottom navigation behavior.
- [ ] Verify loading selectors still show the existing GIF.
- [ ] Run `npm test -- --run` and `npm run build`.
- [ ] Commit with `feat: redesign trip planning surfaces`.

### Task 4: Responsive verification

**Files:** Modify `src/styles/editorial.css` only if fixes are required.

- [ ] Check narrow phone, wide phone, tablet, and desktop breakpoint rules.
- [ ] Fix overflow, clipped controls, or unreadable contrast found during verification.
- [ ] Run `npm test -- --run` and `npm run build`.
- [ ] Commit with `fix: refine responsive planner layout` if changes are needed.

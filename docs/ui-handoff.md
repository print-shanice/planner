# UI redesign handoff

How to redesign this app's interface from reference sites: what was asked, what the references actually do, how to work, and the decisions already made. Section 5 (decisions already made) wins over anything in the references.

---

## 1. The brief

References:
- https://robidacollective.com/
- https://www.patternlanguageindex.com/
- The Dul Zorigoo style reference (section 3)

Do a UI redesign using these as inspiration for styling and overall taste.

- Keep every feature. No functionality may be lost.
- The UI and UX must be intuitive, and the visual workflow optimised.
- No messy or overcrowded screens on Mac or iPhone.
- No filler text. Every word has to say something.
- Read the sites carefully (their real HTML and CSS, not a summary) before designing.
- Work on `main`. Ask before pushing.

The goal is not to copy their look. It's to notice the small, thoughtful design decisions that make them pleasant to use, and translate the ones that fit into this app.

---

## 2. What the two reference sites actually do

From their real stylesheets and markup.

### Robida (robidacollective.com)

Look:
- IBM Plex Mono for the whole interface, serif for long article text.
- `#333` text on white, with light-grey hairlines (`1px solid lightgrey`, plus `1px dashed lightgrey` for minor dividers).
- Links turn blue on hover. Small labels are grey and uppercase.
- The page is a frame of ruled panels: header, footer and sidebars are each edged with a 1px line.

Ideas worth borrowing:
- **A schedule written as rows:** `07:00–08:00 | Ep. 34 Morning Reading Room [eng] | Vida Rucli`. Each row is time range, title, a tag in brackets, then who.
- **A menu drawn as a tree,** with ruled connector lines showing what sits under what.
- **"Currently in Topolò:"** followed by who's there now. A live, local status line.
- **Front-page blocks** that scroll sideways, each with a title, an image and a short scrolling text.
- **A glossary** indexed A–Z, where each term opens to its text, then "written in [year]" and a link to who wrote it.

### Pattern Language Index (patternlanguageindex.com)

Look:
- Aktiv Grotesk (sans) for the interface, Garamond (serif) for very large display headlines.
- `#171717` on white, with one pale-green accent (`rgb(213 243 211)`) used for blocks and the top bar.

Ideas worth borrowing:
- **Numbered entries** (`21. Four-story Limit`), where the number means something.
- **Small uppercase group labels** with a one-line statement under each.
- **Hover underlines** with a small offset (`underline-offset: 2px`).
- **Pages built from labelled sections:** Problem / Background / Solution.
- **Related items linked by name** inside the text.
- **Previous and next at the foot of every entry:** `← 20 Mini-Buses · Index · Nine Percent Parking 22 →`.

---

## 3. Dul Zorigoo: style reference

> ink-and-pencil gallery wall: a designer's portfolio rendered as monochrome exhibition panels on white, where structure is drawn, not filled

**Theme:** light

Source measurements are normalised; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

A monochrome gallery wall for a designer's portfolio: a pure white canvas, hairline grey dividers, and near-black ink for text. The work itself (photography, UI captures, experiments) supplies every drop of colour.

The layout is a two-column shell:
- a thin fixed bio rail on the left
- a filter-tab bar across the top
- a breathable masonry of varied-size work tiles in the main area

The system is deliberately under-designed: no accent colour, no shadow, and no rounding beyond an 8px radius on the few controls that exist. The restraint is the brand. Every visual decision is the absence of a decision, so photographs and product screenshots carry the entire visual load.

Its most defining trait is the hairline border colour `#ebebeb`, which appears about 620 times and structures every panel, card and divider: a grid drawn in 1px pencil rather than built in elevation.

### Colour tokens

| Name | Value | Token | Role |
|------|-------|-------|------|
| Paper White | `#ffffff` | `--color-paper-white` | Page background, image wells, card surfaces inside embedded UI captures |
| Pencil Gray | `#ebebeb` | `--color-pencil-gray` | Hairline borders, panel dividers, card edges, button borders: the main structural line of the whole system |
| Graphite | `#a8a8a8` | `--color-graphite` | Image captions, subdued headings, section labels, time and location metadata |
| Smoke | `#8e8e8e` | `--color-smoke` | Helper text, secondary metadata, low-emphasis descriptors |
| Ink Black | `#252525` | `--color-ink-black` | Primary text, nav labels, sidebar bio, button text. Near-black rather than pure black keeps it in a softer editorial register |

### Typography

**Inter** (`--font-inter`) for all UI text: sidebar bio, nav tabs, image captions, button labels.
- Substitute: Inter, system-ui, -apple-system. The original is likely a neo-grotesque such as Söhne, GT America or Untitled Sans at a small optical size, tracked slightly tight.
- Weights: 400, 500
- Line height: 1.4–1.5

| Role | Size | Line height | Token |
|------|------|-------------|-------|
| caption | 12px | 1.4 | `--text-caption` |
| body | 15px | 1.5 | `--text-body` |

### Spacing and shapes

- Base unit: 4px. Density: compact.
- Spacing scale: 4, 8, 12, 16, 20, 32px (`--spacing-4` … `--spacing-32`)
- Radius: cards 0px; links 8px; buttons 8px
- Layout: 32px between sections, 12–16px inside cards, 8px between elements

### Components

**Fixed bio sidebar.** The identity rail on every page.
- A left column about 200px wide, with no border, sitting on the white canvas.
- Holds the name (Dul Zorigoo), a three-line bio ("Based in London. Exploring novel ways of interacting with technology. Currently designing ElevenLabs / Prev Humanae") and two social links (X, Cosmos) as plain text with a small leading icon.
- Text in Ink Black `#252525`. Links inherit that colour, with no underline.
- No background fill: the sidebar is defined by whitespace, not by a panel.

**Filter tab bar.** Category navigation across the top of the work area.
- A row of text-only tabs: All (active), Photography, Thoughts, Work, Experiments.
- Active tab in Ink Black `#252525`, inactive in Smoke `#8e8e8e` or Graphite `#a8a8a8`.
- No pills, backgrounds or underlines; the selected tab is shown by colour weight alone.
- About 8px between tabs, with a 1px Pencil Gray `#ebebeb` hairline under the bar.

**Work tile (image and caption).** The basic unit of the portfolio grid.
- A photograph or UI screenshot at its natural aspect ratio, edge to edge, with no border, shadow or radius.
- A caption 8–12px below in Graphite `#a8a8a8`, about 12–13px, line-height 1.4. Either a title in Ink Black followed by a descriptor in Graphite, or a single muted line, at most two lines.
- Some tiles are wider (the audio experiments) and some are tall portrait crops, giving a masonry rhythm where widths vary but gutters stay the same.

**Embedded UI capture.** Portfolio pieces that are themselves product screenshots.
- Real product screens (an ElevenLabs agent publish flow, a merge dialog, a music prompt box), each with its own borders, radii and colours.
- Shown as they are: the portfolio adds no frame, border, caption box or background panel. The screenshot is the tile.

**Cards inside the screenshots.**
- White `#ffffff` fill on a slightly off-white `#ebebeb` or near-white canvas, with 8–12px corners and 1px `#ebebeb` hairline borders.
- The same Pencil Gray and Paper White as the portfolio itself, so the work and the frame are built from the same ingredients.

**Text-only links and social handles.**
- Plain Ink Black `#252525` text, with no underline and no visible hover state.
- Social handles (X, Cosmos) start with a tiny glyph icon.
- They're deliberately light, so the sidebar reads as a colophon rather than a nav menu.

**Date and location stamp.**
- "LDN 02:20" and "Crisp blue skies, perfect for a brisk walk." in the lower-left of the sidebar, 12–13px, Graphite `#a8a8a8`.
- A quiet live signature, treated as an annotation rather than content.

### Do

- Use `#ebebeb` for every divider, card border and panel edge.
- Keep the canvas `#ffffff`; never tint the background, and let whitespace carry the layout.
- Use `#252525` for body copy and primary labels, `#a8a8a8` for captions and metadata, and `#8e8e8e` for the quietest helper text.
- Show images edge to edge with no border, shadow or background card around them.
- Give the few buttons and link chips an 8px radius, and everything else 0px.
- Show tab and nav state by colour weight (Ink Black active, Graphite inactive), not by pills, backgrounds or underlines.
- Keep a masonry grid where tile sizes vary but spacing stays the same: 32px between sections, 8–12px from tile to caption.

### Don't

- Introduce any colour: no accent, no brand hue, no semantic red, green or blue. The system is fully monochrome.
- Add shadows or elevation. Structure is drawn in 1px Pencil Gray hairlines, never lifted with blur.
- Round photographs or screenshot tiles. They're always raw, square-cornered rectangles.
- Use filled or outlined call-to-action buttons. Interactions are text links, filter tabs and the images themselves.
- Set body text in pure `#000`. Ink Black `#252525` keeps it editorial.
- Use grey pill or chip backgrounds for active nav states. A heavier grey is the only state signal.
- Go above about 15px for any UI text. Everything is set small; there are no headlines.

### Surfaces and elevation

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Paper | `#ffffff` | The page, and the only background colour. Everything sits on it. |
| 1 | Pencil | `#ebebeb` | Hairline borders, dividers and panel edges. A 1px line, never a fill. |

There is no elevation system and there are no box-shadows. Structure comes entirely from 1px `#ebebeb` hairlines and whitespace: panels are drawn, not lifted. The portfolio is a gallery wall, not a stack of cards.

### Imagery

Image-dominant. Photographs and full-bleed product screenshots take up most of the screen, arranged in a varied-size masonry that feels like an exhibition wall rather than a grid.

- The photography is editorial: black-and-white landscapes, golden-hour cityscapes, chalk-white cliffs, candid park scenes.
- Product screenshots (ElevenLabs agent flows, a music stem downloader) are shown raw, so the products' own visual systems become part of the portfolio.
- No illustration, 3D or abstract graphics; only photographs and screenshots.
- Icons are minimal and monochrome (the small X and Cosmos glyphs), more like thin marks beside text than an icon system.

### Layout

- A two-column shell: a fixed left sidebar of about 200px (name, bio, social links, live date stamp) and a flexible work area on the right.
- The work area opens with the filter tab bar, separated from the grid by a 1px `#ebebeb` hairline.
- Below it is the masonry grid: a mix of portrait, landscape and full-width tiles, with 8–12px between images and 32px between groups. Captions sit directly under each tile in Graphite, 12–13px.
- Navigation is minimal: no sticky header, no mega-menu, nothing in the sidebar beyond the bio.
- The page scrolls as one continuous gallery. The only breaks are the hairline under the tab bar and the gaps between groups of work.
- Spacing is generous: large photographs get room, and the sidebar never competes with the grid.

### Quick colour reference

- text: `#252525`
- background: `#ffffff`
- border: `#ebebeb`
- captions and metadata: `#a8a8a8`
- secondary text: `#8e8e8e`
- primary action: no separate colour

### Example component prompts

1. **Fixed left sidebar:** `#ffffff` canvas, no border, about 200px wide. Top line "Dul Zorigoo" in Inter 15px weight 500, `#252525`. Below it a three-line bio in Inter 13px weight 400, `#252525`, line-height 1.5. At the bottom, two social links in 12px `#252525`, each with a small monochrome glyph, 12px apart. No background fill, no panel chrome.
2. **Top filter tab bar:** white `#ffffff`, flush with the page, with a 1px `#ebebeb` border below. Five text-only tabs: "All" (active, `#252525`), then "Photography", "Thoughts", "Work", "Experiments" (inactive, `#a8a8a8`). Inter 13px weight 500, 8px apart. No pills, backgrounds or underlines; the selected tab is shown by colour weight only.
3. **Masonry work tile:** an image at its natural aspect ratio, edge to edge, with no border, radius or shadow. 8–12px below it, a single muted caption line in Inter 12px weight 400, `#a8a8a8`, line-height 1.4. No card wrapper or background plate.
4. **Divider:** a 1px horizontal line in `#ebebeb` across the full width of the content column, used under the tab bar and between groups of work. Never use box-shadow or coloured fills to separate sections.
5. **Embedded UI screenshot tile:** a raw product screenshot (a chat or settings panel) placed as a tile with no frame, caption box or border, so its own white-and-hairline system becomes the content. Caption below in `#a8a8a8` describing the project.

### Monochrome discipline

The most important rule of this system is that there is no colour. Every colour in the palette is a shade of grey, and that is the brand, not a limitation. Photographs and screenshots supply the colour; the interface around them stays grey. A highlighted state means going from `#a8a8a8` to `#252525`, never adding a hue.

### Similar sites

- **Are.na:** the same masonry of varied-size image tiles, muted captions and no chrome around the content.
- **Rauno Freiberg's portfolio (raunofreiberg.com):** the same discipline: monochrome palette, hairline borders only, unframed edge-to-edge tiles.
- **Readymag project showcases:** the same exhibition-wall presentation, where the portfolio's restraint makes the work's own colour stand out.
- **Linear's changelog and blog:** the same `#ebebeb` hairline structure and black-on-white text, though Linear adds one accent colour and this site adds none.
- **Manual (manual.com):** the same design-as-gallery approach, with work shown as tiles and the portfolio chrome reduced to a thin bio rail and quiet metadata.

### Quick start: CSS custom properties

```css
:root {
  /* Colors */
  --color-paper-white: #ffffff;
  --color-pencil-gray: #ebebeb;
  --color-graphite: #a8a8a8;
  --color-smoke: #8e8e8e;
  --color-ink-black: #252525;

  /* Typography: font families */
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography: scale */
  --text-caption: 12px;
  --leading-caption: 1.4;
  --text-body: 15px;
  --leading-body: 1.5;

  /* Typography: weights */
  --font-weight-medium: 500;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-32: 32px;

  /* Layout */
  --section-gap: 32px;
  --card-padding: 12-16px;
  --element-gap: 8px;

  /* Border radius */
  --radius-lg: 8px;

  /* Named radii */
  --radius-cards: 0px;
  --radius-links: 8px;
  --radius-buttons: 8px;

  /* Surfaces */
  --surface-paper: #ffffff;
  --surface-pencil: #ebebeb;
}
```

### Quick start: Tailwind v4

```css
@theme {
  /* Colors */
  --color-paper-white: #ffffff;
  --color-pencil-gray: #ebebeb;
  --color-graphite: #a8a8a8;
  --color-smoke: #8e8e8e;
  --color-ink-black: #252525;

  /* Typography */
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography: scale */
  --text-caption: 12px;
  --leading-caption: 1.4;
  --text-body: 15px;
  --leading-body: 1.5;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-32: 32px;

  /* Border radius */
  --radius-lg: 8px;
}
```

---

## 4. How to work

### Study before designing

- Fetch each site's real HTML and stylesheets (curl the page, then its CSS). A text summary of a page loses everything visual. Note the actual fonts, sizes, colours, borders, spacing, radii, letter case and letter-spacing.
- Then look past the styling at how each site organises information. Write down specific details and where you saw each one:
  - a live context stamp ("LDN 02:20")
  - bracketed tags ("[eng]")
  - numbered entries
  - previous/next links at the foot of a page
  - related items linked in context
  - tree lines showing what belongs to what
  - a thin sidebar for identity and status
  - text-only tabs marked by weight
  - small uppercase mono labels for metadata
  - colour used sparingly, taken from imagery
- For each detail, write one line on what it does for the person using it. If it does nothing for this app, drop it. Structure has to mean something: numbers only where order matters, labels only where they add information.

### Map details to the app

- First, read the app's screens and list every feature, so nothing gets lost.
- For each detail you keep, name the screen and element it changes and what the user gains. For example: "plan line numbers 01, 02 match the map pins, so the list and the map read together."
- A font and colour swap with one highlighted box is not a redesign.

### Show options before building, at real size

- Make a mock-up page with numbered questions and lettered options, using the app's real data, fonts and sizes. Each option is a full screen, not a thumbnail.
- When showing both phone and laptop, label each frame, or use a laptop/phone switch. Never put an unlabelled small box beside a large one.
- Add a bar that collects the picks so they can be copied back.
- Ask before changing the design, and build only what was picked.

---

## 5. Decisions already made

These override the references, including the monochrome and no-headline rules in section 3.

- **Paper and lines:** white page, near-black ink, 1px hairline rules instead of filled cards and shadows.
- **Type:**
  - A book serif (EB Garamond) for titles.
  - A plain sans (Inter) for reading and tapping.
  - Mono (IBM Plex Mono) for dates, times and small uppercase labels.
- **Size hierarchy:** the page title is clearly larger than section and day headings, which are clearly larger than item names. A trip's name should be about 32px, day headings about 20px. Secondary items, such as side trips, never outweigh their parent.
- **Colour:**
  - Twelve soft, cool-leaning colours, all at the same lightness so any two sit well together, sampled from reference photos (subway blue, sage, sea glass, lilac ink, butter, dusty pink).
  - No brown.
  - Colour only fills shapes: squares, bands, calendar days, map pins.
  - Text is always ink, never coloured.
- **Status tags:** bracketed mono tags: `[to book]` / `[booked]` for bookings, `[to do]` / `[done]` for to-dos, and amber for "public holiday".
- **Countries:**
  - A country is its two-letter code in a hairline box (`FR`).
  - A trip through several countries shows its route above the title, in travelling order (`ES → PT`).
- **Navigation:**
  - The current view is shown in bold. No arrows.
  - Text-only tabs.
  - On laptops, a thin sidebar pinned to the left edge holds the wordmark, the views, what's next and the local time.
- **Home:**
  - A schedule grouped by month, with each trip's side trips in a band tinted with the trip's colour.
  - The calendar is behind a list/month switch, and is not always shown.
  - Beside the month: two tabs ("on in [month]" and "to do"), then that month's public holidays.
  - On laptops, the month and the column beside it read as one ruled sheet. Both start on the same ink rule, both have a 52px title row ("january ‹ ›" and the tabs), and one hairline runs under both at the same height. The calendar ends on a single line, not two. An end-to-end test checks this alignment.
- **Mobile:**
  - Each item reads as one block, with the name first and its details on one line underneath.
  - Nothing broken up or crowded.
  - Check at 320px wide that nothing scrolls sideways.
- **Details that must hold:**
  - The tails of g, p and y never get clipped on one-line titles.
  - Switching a tab never moves the content below it (give the panes a shared space).
- **Words:**
  - No filler text.
  - The interface never speaks to the user: no "your", no explanations such as "this trip is over. the lists stay here for next time" or "what it was on your days". Labels and values only.
- **No bubbles:** no pill chips, rounded segmented controls, pill badges, avatar bubbles on rows, or filled rounded checkboxes. Use text tabs, mono labels, hairline rules and hairline squares instead.
- **Extras stay small:** secondary information, such as the weather, takes one short line, never a block.
- **Loading:** keep the existing Totoro loading GIF.

### Packing (decided 14 nov 2026)

Mock-up: https://claude.ai/artifact/UhzzBRtEWi8dLVZ3U9jGwM (option A, tick 3).

- **No "packing for [trip]" line,** and no row of people under it.
- **Top of the page:**
  - Text tabs for `coming up` / `past`.
  - Below them, the trips as one row of text tabs. Each trip has its colour square, and the row scrolls sideways on its own with a fade on the right edge.
  - Past trips are listed newest first.
- **Under the trip row:**
  - The dates in mono (`4 – 9 mar · in 110 days`), with `copy this list to…` on the right.
  - The weather on one line under the dates.
- **Copy a list:**
  - Every trip, past or coming up, can copy the open list to an upcoming trip.
  - Copied things arrive unticked, and things already on that list aren't copied twice.
- **Whose list:**
  - Text tabs `mine` / `[her name]'s` switch between two separate lists.
  - No faces or owner marks on single items.
- **The list:**
  - The count in mono (`2 of 7 packed`), then a 2px progress line.
  - Each thing has a 13px square with a 1px outline, ticked with a thin check stroke and never filled.
  - Packed things go grey and move under a `packed` label below the list.
- **Bags:**
  - Each thing can carry one bracketed mono tag on the right of its row: `[check-in]`, `[carry-on]` or `[wear]` (worn to the airport). A thing can also have no bag.
  - Tapping the box ticks the thing. Tapping the name opens a one-line bag picker under it (`check-in · carry-on · wear · no bag`), where the chosen bag is ink with a hairline underline.
  - A one-line mono filter beside the count (`all · check-in · carry-on · wear`) shows one bag at a time, and the count follows it.
  - Copied things keep their bag.
- **Weather:**
  - Shown as `−3° / −11° · snow`, using the trip's main place (its "based in") only. Side trips' weather isn't added to the parent trip.
  - Within about 15 days of the trip it's the forecast, further ahead it's `usually`, from the last three years, and for a past trip it's what the weather was.
  - Comes from open-meteo, which is free and needs no key, the same as the trip header.
- **Shared things** (no owner) show on both lists, and each person ticks them for themselves. The edit form's whose row reads `mine · [name]'s · both`.
- **Tabs:** the selected tab is ink, bold and underlined, the same as the month view's tabs.
- **Built** in `fb073a5` (14 nov 2026). Bags need `supabase/migrations/20261114_packing_bags.sql` run once.

---

## 6. Building

- Keep every feature and the intent of the existing tests. Update tests that check old visuals so they check the new design, and add tests for new behaviour.
- Take real screenshots on phone and laptop before and after, and look at them.
- Use free APIs only (no key, no cost). Stub them in tests so tests never call them.
- Never add Claude as co-author or contributor in commits, pull requests or docs.
- Commit on `main`, and ask before pushing. Before pushing, fetch. If `main` has moved, rebase or merge on top. Never force-push over someone else's work.

### Trip page (in progress, 14 nov 2026)

Prototype: https://claude.ai/artifact/RaDjUyHPYdWFyNhwdEDfxP (round 2; round 1 was judged ugly and too crowded)

Decided:
- **Consistency first:** the trip's sections (plan, map, places, notes, links, money) are text tabs at the top, styled like home's nav, on phones too. No bottom tab bar.
- **The main view holds only** `‹ all trips`, the trip's name, one mono line of dates and nights, plain search and + icons (no circle), and the tabs.
- The route, local time, weather and the people sharing the trip move into the trip's details. The avatar circles go.
- The grey "next · paris" box goes.

Picked: **1b, 2b** (built 14 nov 2026, not yet pushed)
- **No calendar for a long trip with side trips.** The plan opens straight on the trip's own days. Each side trip is one row in date order (colour square, name in serif, mono dates, `→`) that opens it.
  - Inside a side trip's dates, only the trip's own plans show, such as the train there.
  - A day linked to from elsewhere, like a holiday or a day on home's calendar, always shows, even with nothing planned.
- **`edit` in the top right** replaces the avatar circles. It opens "edit trip", which starts with the route, the local time and weather, and `with [names]`, then the form.
- **The tabs are at the top on phones too,** as text tabs like the laptop's. That includes the phone map, where they sit in a plain band with the back link and +. The bottom tab bar is gone.
- **The + is a plain icon with no filled circle,** on the trip page and on home.
- **Not changed yet:** the edit form's colour circles and its filled "save" button. These are bubble shapes, so they're candidates for a later pass.

### Travels counts (decided 14 nov 2026)

- **Cities visited only counts real cities.** An address's town (Akiruno, Akishima) isn't a city. A city counts when it's on the known-cities list (`public/globe/known-cities.json`: the globe's own city names, plus GeoNames' country and first-region capitals, which adds places like Nara) and lies near where you were. Accents and a trailing "city" / "-shi" are ignored, so Ōsaka = Osaka and Taipei City = Taipei.
  - Day trips count (Nara, Kobe). A place in a big city's ward (Shibuya) counts as that city (Tokyo).
  - Anywhere you stayed the night (a stay, or a trip's base) always counts, even if it isn't on the list (Hakone).
- **Trains, buses and ferries only count between cities.** Both ends have to be real cities (the same list as cities visited), and different ones. A metro across Tokyo, a bus round Kyoto, or a ride out to Akiruno isn't listed and doesn't add to the km. Neither is one saved without both a from and a to (no more `? → ?` rows). Flights always count.

- **The crash page shows what broke only while developing.** On the live site it says the page broke and offers "try again" and "reload from the server". The error goes to the browser console instead.

### Money header (decided 15 nov 2026)

- **The total has room under it.** The big total's line height is 1.15, so the tails of "jpy" no longer touch "in total" below it.
- **"Shown in" sits on the line under the total,** after "in total" (or "of €6,000 · €894 left"). It isn't a separate box at the top right any more, so it no longer looks like it should line up with the add-a-cost picker. The note that each cost keeps its own currency moved into the total's (i).
- **Currency pickers are plain text with a small chevron on a dashed underline,** like the typing lines. They have no grey filled box. That goes for both "shown in" and the add-a-cost line.

### Opening and renaming a line, and reviews (decided 15 nov 2026)

- **A place, note or typed train on the plan opens its card when clicked, the same as a flight or a stay.** The little › at the end of the line is gone. On a laptop, the time column is still typed over right on the line. The name is no longer a text box on the line.
- **A place, stay or note is renamed on its card, by clicking the big title.** The title is plain until you hover it, which shows a dashed line under it. Click and type over it. It saves when you press enter or leave it. Escape, or emptying it, puts the old name back. Flights and trains keep their "name" / "flight" row.
- **Reviews are rows like the rest of the card, with no boxes and no save button.**
  - "your visit" has three rows: visit (planned, done, skipped), rating (1 to 5) and return (yes, maybe, no). Each is a choice of words, and the picked one is bold, like status. Tapping a picked rating or return again unpicks it.
  - Comments is the same dashed typing line as notes.
  - Every pick saves at once, and comments save when you leave them. "saved" shows underneath, or the reason it failed with a retry.
  - Past visits are under "earlier" as plain lines: who and when, then "done · 4/5 · would return", then their comments.

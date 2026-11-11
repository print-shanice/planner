# Responsive Editorial Planner Redesign

## Intent

Improve the existing planner UI for private trip planning without changing its product behavior, data model, routes, or loading experience. The redesign should feel considered and expressive on desktop and phone while remaining useful as a working planning tool.

## Goals

- Preserve all existing planner functionality and interactions.
- Establish a warm paper/ink visual system with editorial typography, hairlines, and restrained color blocks.
- Make home, itinerary, map, saved links, costs, packing, and forms feel like one coherent product.
- Keep desktop and mobile layouts intentionally different where the information density requires it.
- Preserve the existing Toronto loading GIF at `public/loading.gif`.

## Non-goals

- No marketing or landing-page copy.
- No stock photography or invented travel imagery.
- No native Swift app or new backend behavior.
- No removal of offline, collaboration, maps, capture, saved links, money, packing, review, or file features.

## Constraints

- Work directly on `main`, using small atomic commits.
- Follow the existing repository commit style.
- Use the existing React/Vite/CSS architecture and installed fonts where possible.
- Keep the current prototype directory as a reference only; it is not part of the production redesign.

## Approach

Add a final `editorial.css` layer imported after the current feature styles. It will redefine tokens, typography, surfaces, navigation, home trip families, itinerary lines, sheets, forms, and responsive breakpoints while leaving component behavior and selectors intact. Only make component changes when the existing structure cannot express a clearer visual hierarchy.

## Acceptance

The app builds successfully, existing tests pass, the Toronto GIF remains unchanged and reachable from both loading paths, and the main home/trip flows remain usable at phone and desktop widths.

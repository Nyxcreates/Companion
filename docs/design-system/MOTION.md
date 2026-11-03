# Companion Motion Guidelines

Source of truth for animation code: `src/lib/motion.ts`.

## Principles

- Nothing appears or disappears instantly. Every transition uses
  `duration.fast` (200ms), `duration.base` (300ms) or `duration.slow`
  (500ms) from `src/lib/motion.ts`.
- Use `ease.standard` for UI chrome (modals, toasts, page content).
  Never use a linear or bouncy ease on layout elements — save spring
  / bounce for character-specific celebration moments (out of scope
  for this milestone).
- Idle/ambient motion (the character breathing, background glow) is
  slow, continuous, and never on a fixed noticeable loop rhythm —
  see `breathing` transition and ANIMATIONS.md's idle rules.
- Respect `prefers-reduced-motion`. CSS transitions are covered
  globally in `globals.css`. Any Framer Motion animation that plays
  automatically (not user-triggered) should stay subtle enough that
  disabling it isn't jarring.

## Reusable variants

| Variant | Use for |
|---|---|
| `fadeIn` | Overlays, backdrops, simple content reveals |
| `slideUp` | Content entering from below (cards, empty/error states) |
| `scaleIn` | Modals, popovers, anything "appearing" in place |
| `toastSlide` | Toast notifications only |
| `staggerContainer` | Lists of items appearing in sequence |
| `breathing` | Idle/ambient loops (character, glow) |

## Don't

- Don't shake, flash, or rapidly repeat animations.
- Don't animate more than one or two properties per element.
- Don't hand-roll new durations/easings in a component — import from
  `src/lib/motion.ts` so timing stays consistent app-wide.
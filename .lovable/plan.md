
# Fix: Masonry Layout for Mixed Photo Orientations

## Problem

The gallery uses CSS Grid (`display: grid`) which forces all items in the same row to share the same row height. When a row contains both vertical and horizontal photos, the horizontal ones leave large empty gaps below them.

## Solution

Replace CSS Grid with CSS `columns` layout. This creates a true masonry effect where items flow vertically into columns and pack tightly regardless of individual heights.

```text
BEFORE (CSS Grid - rows forced to same height):
[vertical] [horizontal____] [horizontal____]
[        ] [   EMPTY GAP  ] [   EMPTY GAP  ]
[________] [______________] [______________]

AFTER (CSS Columns - items pack tightly):
[vertical] [horizontal____] [horizontal____]
[        ] [vertical      ] [vertical      ]
[________] [              ] [              ]
```

## Technical Details

### File: `src/index.css` (masonry styles)

Replace the `.masonry-grid` styles from `display: grid` to `column-count`:

- `column-count: 2` (mobile) / `3` (sm) / `4` (lg) / `5` (xl) / `6` (2xl)
- `column-gap: 0.5rem`
- `.masonry-item` gets `break-inside: avoid` and `margin-bottom: 0.5rem`

This is a CSS-only change -- no component modifications needed.

### Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Replace grid styles with column-count masonry |

No changes to `MasonryGrid.tsx`, `PhotoCard.tsx`, or any other components.

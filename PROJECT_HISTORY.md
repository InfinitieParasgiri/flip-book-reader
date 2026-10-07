# Project History

## 2026-10-07 — Fix: Page-flip drag not working from anywhere on the page

**Feature:** Allow drag-to-flip from any side of the book, with the fold appearing under the user's finger.

**Files Modified:**
- `src/core/Turns.ts`

**Logic Changes:**
1. **Removed `beginDrag` restriction** — The old code required the pointer to be within the outermost 35% of the page width (`localX >= width * .65`) AND in the top or bottom 25% of the height. This made flip nearly impossible to trigger.
2. **Full-half detection** — Now any pointer on the right half of the book starts a forward flip; left half starts a backward flip.
3. **Added `startLocalX` to `Turn` type** — Stores the page-local x of the drag start so `moveDrag` can anchor the fold visually under the finger.
4. **Fixed `moveDrag` x-anchor** — Previously always started the fold at `sheet.width` (the outer edge). Now uses `startLocalX` so the fold begins exactly where the user touched, even from the center of the page.

**Pending Tasks:** None

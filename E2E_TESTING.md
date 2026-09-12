# NijiSamvad End-to-End Testing Guide

## Automated Tests

To run the Playwright automated tests:
```bash
npm run test:e2e
```

## Manual Testing Checklists

### 1. E2EE Reply System & Swipe-to-Reply
- [ ] Connect two devices to the same room with the same secret.
- [ ] Send a message from Device A.
- [ ] On Device B, on a touch screen or with pointer emulation, swipe horizontally on the message bubble.
- [ ] Verify haptic feedback (vibration) triggers when swipe threshold is reached.
- [ ] Verify the Reply context bar appears above the input.
- [ ] Send the reply, and verify it renders with a small preview block.
- [ ] Click the preview block and verify it scrolls to and highlights the original message.

### 2. Mentions & Autocomplete
- [ ] Type `@` in the input field.
- [ ] Verify the autocomplete popover appears with current room participants.
- [ ] Verify keyboard navigation (Up/Down arrows) cycles through options.
- [ ] Verify pressing `Tab` or `Enter` inserts the mention and adds a trailing space.
- [ ] Send the message and verify the mentioned user sees their mention styled distinctly (e.g. highlighted background).

### 3. Responsive UX & Polished Layouts
- [ ] **Mobile View (e.g. iPhone 13, 390px):**
  - Verify the header actions (Call, Theme, Mute) are collapsed into the vertical "More" menu.
  - Verify `safe-area-inset` handles notches correctly (no text obscured).
  - Verify the Call Interface grid collapses gracefully and isn't overlapping.
- [ ] **Tablet/Desktop (e.g. iPad / 1440p):**
  - Verify all actions in the header are visible without opening the "More" menu.
  - Verify the `chat-main` area is spacious and fills the height perfectly without unnecessary scrollbars.
  - Verify the message grouping accurately stacks sequential messages from the same sender.

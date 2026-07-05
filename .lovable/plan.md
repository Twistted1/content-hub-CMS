## Current status

The preview is here and should be used after every visible change:

https://id-preview--31c64459-d7d6-45e8-9eeb-bedede902146.lovable.app

The project is not yet complete. The biggest remaining issue is not just styling — it is that the UI, platform schedules, calendar display, and real automation pipeline need to be made consistent and verified end-to-end.

## Completion plan

### 1. Restore preview confidence
- Keep the preview URL visible in handoff messages after meaningful UI changes.
- Verify key pages in the running preview, not just by reading code.
- Confirm whether the preview opens directly into the demo session or still blocks on auth.

### 2. Lock the source of truth for schedules
- Treat your corrected schedule as authoritative:
  - Twitter/X: 3x daily
  - Instagram: 1x daily
  - TikTok: 3x weekly
  - Facebook, Rumble, LinkedIn, YouTube: 1x weekly
  - Website/Articles: 1x daily cycling Monday-Sunday through the seven strategic categories
- Audit every place the schedule appears: Automation page, Calendar page, schedule utilities, platform JSON files, and any edge function that generates scheduled posts.
- Remove conflicting hardcoded schedule summaries so the app cannot show one schedule in one page and a different schedule elsewhere.

### 3. Fix Automation page into a usable control center
- Replace the current clutter with a clear weekly schedule overview.
- Show each platform, frequency, next slots, and current automation status.
- Add or keep one clear action for activating the weekly schedule.
- Surface whether publishing is direct, webhook-based, or awaiting review.

### 4. Fix Calendar month view
- Make month view readable and consistent.
- Apply the requested brand colors to platform tags:
  - Twitter/X: `bg-blue-500`
  - Instagram: `bg-pink-500`
  - TikTok: `bg-black`
  - LinkedIn: `bg-blue-700`
  - YouTube: `bg-red-600`
- Ensure Website/Articles category labels show the correct daily strategic category.
- Reduce visual noise so the calendar is scannable instead of a dense mess.

### 5. Standardize page titles across the app
- Use one shared title style for all dashboard pages.
- Normalize font size, weight, color, and spacing.
- Avoid page-by-page title drift.

### 6. Verify end-to-end automation status
- Check whether the actual automation backend is wired:
  - weekly schedule activation
  - generation into review inbox
  - scheduled publishing
  - webhook/direct publish path
- Report honestly what is complete, what is simulated, and what still requires OAuth/webhook setup.

## Definition of done

This project should be considered complete only when:
- You can open the preview and inspect the app yourself.
- Automation and Calendar show the same schedule everywhere.
- The Automation page clearly explains what will run next.
- Month view is visually usable and uses platform brand colors.
- Website/Articles rotate through the seven strategic categories correctly.
- The real publishing pipeline status is visible, not hidden behind vague UI.

## Next implementation step

First implementation pass should focus on the visible product problems:
1. Audit Automation and Calendar against the corrected schedule.
2. Refactor schedule display to one shared source of truth.
3. Clean up Automation page and Calendar month view.
4. Verify the preview after changes and provide the preview URL again.
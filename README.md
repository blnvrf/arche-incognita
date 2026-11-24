# ArcheIncognita

On Mac, unzip **ArcheIncognita-Mac.zip**, drag **ArcheIncognita.app** into Applications, and open it. The universal app requires macOS 13 or later. A fresh workspace opens a sample graph, **Your path to something**, with everyday goals (money, health, learning) to show how events, dependencies, recurring tasks, costs, and gains fit together. Edit or delete its events, or use **Actions → New from scratch** for an empty graph.

You can also open `index.html` in a browser. Instrument Serif loads from Google Fonts when online.

## Graphs and cards

The graph picker lists independent graphs. Under **Actions**, choose **Rename current**, **New from scratch**, **Duplicate current**, or **Delete current**. Deleting asks for confirmation and is unavailable when only one graph is left. A duplicate copies events, connections, dates, and values into a separate graph.

Switch between **Tree view**, **Minor tasks**, and **TAP** with the links at the bottom left.

- **Minor tasks** opens a board of cards over the Colossus of Rhodes engraving. Choose **Add task** and use the checkmark to complete or reopen a task.
- **TAP** opens a board of triggers or goals over a moonscape. Choose **Add TAP** and click a card title to reveal its instructions.
- Use the handle in either board to drag a card. With the handle focused, arrow keys move it too.

The Alexander Mosaic remains the tree view background. A running timer keeps tracking when you switch views. Starting another timer pauses the previous one.

## Date range

Open **All dates**, the calendar line below the graph picker. Choose a preset or select an inclusive start and end date on the calendar. Each graph keeps its own range while the app is open. In a dated view, an event appears if its event date is on or before the end date, even if it was created before the start. Its status reflects the last recorded completion or reopening through the end of that day. **Open live event** returns to the editable graph. Titles, dependencies, and other details use their current values.

All existing events are dated November 1, 2026 on upgrade. Their time records and completion timestamps are preserved. New events default to the day they are added. Change the **Event date** in the event editor. **Completion history** records completions and reopenings, with editable timestamps. For an older completion whose date is unknown, use **Set completion date** to include it in historical views.

The signed total in the upper-right of the map and the **Details** amounts cover only the selected range of the current graph. When a current event is set, it appears in an animated pill in the center of the top bar; click the pill to open that event. Manually entered and older time logs use their assigned date. New timer sessions that cross a day boundary contribute only their overlap with the range. Use **Edit** on a time entry to change its date, time, duration, or note. Completion gains and costs are counted on the first recorded completion for ordinary events and on each recorded completion for recurring events.

## Map and connections

- Choose **New event** and select a source, including a completed event, to draw the first connection. Choose **No connection** to place the event on the outer ring. Connected events start near their origin on the next ring, using an open spot when space is tight. Drag an event to choose a different angle. Saved positions are kept. Drag the small **+** onto another event to draw a connection, or click the **+** and then the target.
- Use **−** at the top right of an event to collapse everything downstream. Use **+** in that same spot to expand it. Collapse state is saved with the map.
- The eye beside the globe hides completed events and draws shortcuts through them. Ring positions adapt to the shorter paths. Toggle the eye again to show completed events and their original connections. The eye in an event’s details hides or shows only that event. Use **Details → Hidden events** to open a hidden event again.
- Click a line on the map or choose **Edit dependencies** in an event’s drawer. Change its endpoints, reverse its direction, add a label, or delete it. Connections are drawn as straight lines.
- Edit an event’s title or description in its drawer. The Anchor’s details are editable. Its position and January 1, 1980 origin date are fixed. Click a faded completed task to open or restore it.
- The branching icon at the bottom right switches to a left-to-right view: *arche* sits on the left and each event follows its furthest prerequisite in the next column, joined by right-angle lines. Cards stay in place in this view; drag the background to pan. Click the icon again to return to the orbit view. The app remembers the choice.
- Drag the background to pan, scroll to zoom, and use **1:1** to center on *arche* instantly at 100%, type a zoom percentage directly, or use the globe to fit the whole map. Connected tasks use rings based on their distance from the Anchor. The outermost ring is always available for tasks with zero connections.

On mobile, the top bar shows *AI* on the left, the current event in the middle, and the total on the right. Along the bottom, a row of small icons (menu, date range, zoom percentage, fit, completed-event toggle, left-to-right view) sits above the graph picker, with the large **+** for a new event at the right. Tapping an event opens its details full screen. Pinch to zoom, or tap the zoom percentage to return to 100% centered on *arche*. The menu icon opens Save, Load, Details, Minor tasks, and TAP.

## Focus and time

Select a task to center it instantly at 100%. Close the task drawer to return to the full map.

Turn on **Recurring** to count completions. Complete the event, then restore it when you’re ready to do it again. Its count carries over. A recurring prerequisite counts as fulfilled once it has at least one completion, even after you restore it.

Completed tasks stay visible in a faded state. Use the rollback icon to restore a task. The red trash icon permanently removes the task and its time log after confirmation. It connects the task’s predecessors directly to its successors.

Tasks with unfinished prerequisites along incoming connections appear faded. Finish those prerequisites before completing the event, setting it as current, or starting its timer. Reopening a prerequisite pauses and logs a timer if that task becomes locked again.

Choose **Set as current** to give one task a gold border. Each task has a **Play / Pause** timer and a time log. Pressing Play makes that task current and pauses any previous timer. Pausing, switching timers, or completing a task records the session. **Log time** adds time manually in hours, minutes, and seconds. Each entry can be edited or removed. A running timer uses its saved start time, so elapsed time continues while the browser is closed.

Set an optional **Hourly rate ($)** in the task editor to display earnings on the card. Earnings update each full minute while the timer runs and include the exact logged duration when paused. An optional **Cost ($)** appears as a red negative amount on the card once the task is complete. **Gain ($)** adds an amount when the event is completed. **Details** shows the net amount for each event with a gain or loss and the combined total.

## Saving and restoring

The Mac app autosaves in `~/Library/Application Support/ArcheIncognita/map.json`. The browser version keeps its own workspace in the current browser profile. Use **Save** in the browser and **Load** in the Mac app to transfer it.

Press **Ctrl+S** (⌘S on Mac) to save over the last file you saved; the first time, it asks where to save. **Shift+Ctrl+S** (⇧⌘S) always asks for a new file. The Mac app remembers the last file between launches. In the browser, overwriting works in Chrome and Edge for the current session; Safari and Firefox download a new copy instead. The JSON backup includes all graphs and both card boards, including card positions. Export captures elapsed time through the moment of export. Imported timers start paused.

Use **Load** to restore a file. The app checks the file and asks before replacing the saved workspace. Older single-map backups replace the selected graph, using the **$1M** events from that backup. The confirmation lets you export your existing workspace first.

For a stable local address, open Terminal in this folder, run `python3 -m http.server 8787 --bind 127.0.0.1`, and visit `http://127.0.0.1:8787/`. Each address has its own browser storage. Export a backup before switching addresses, then import it at the new address.

Close any dialog with ×, Cancel, Escape, or a click outside it.

The HTML, CSS, and JavaScript can be reused in a future installable Mac version.

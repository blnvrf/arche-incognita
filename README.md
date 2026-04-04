# ⬡ Arche Incognita

> A personal life tech tree. Like Civilization's research tree — but for your freelance life.

## Concept

Every task you do as a freelancer is a node. Tasks connect to other tasks via dependencies. Completing a node earns you money, unlocks new tasks, and moves you closer to big life goals. The graph is your life's roadmap — visible, navigable, and satisfying to progress through.

---

## Stack

- **React + Vite** — fast dev, easy build
- **@xyflow/react** — graph canvas (nodes, edges, drag, connect)
- **Zustand** — global state management
- **localStorage** — auto-save on every change, no backend needed yet
- **Cinzel + Crimson Text** — display/body fonts (serif, classical feel)

---

## Node Data Model

```js
{
  id: string,
  type: 'taskNode',
  position: { x, y },
  data: {
    title: string,           // What you do
    emoji: string,           // Icon
    status: 'locked' | 'available' | 'active' | 'completed',
    timeEst: string,         // e.g. '4h', '2d'
    cost: number,            // Money required to unlock
    moneyDelta: number,      // Money earned on complete
    benefits: string[],      // List of unlocks / gains
    notes: string,           // Free text notes
  }
}
```

## Status Logic

- `locked` — prerequisites not completed, OR balance < cost
- `available` — all prereqs done AND balance covers cost
- `active` — currently doing (ONE at a time) → animated shimmer border
- `completed` — done, greyed out, moneyDelta applied to balance

---

## UI Layout

- **Fullscreen canvas** — dark Civ theme, dot grid background
- **Top left** — ⬡ Arche Incognita logo
- **Top right** — Balance counter (click to edit) + Sort button
- **Bottom left** — Status legend
- **Bottom right** — + button (add task)
- **Bottom center** — Focus bar (active task: complete / abandon)
- **Right sidebar** — Add/Edit task panel (320px)

---

## Key Interactions

| Action | Result |
|---|---|
| Click available node | Sets as active |
| Click any other node | Opens edit sidebar |
| Drag node handle → node | Creates dependency edge |
| Click balance | Inline edit |
| Sort button | Auto-layout by dependency depth |
| Focus bar Complete | Marks done, applies moneyDelta |
| Focus bar ✕ | Abandons, reverts to available |

---

## What's Built

- [x] Vite + React + @xyflow/react + Zustand
- [x] localStorage auto-save/load
- [x] Sample graph (5 connected nodes)
- [x] TaskNode (4 statuses + shimmer border animation)
- [x] NodeSidebar (add/edit, emoji picker)
- [x] FocusBar
- [x] BalanceCounter
- [x] Auto-layout algorithm
- [x] Dark Civ theme (CSS variables, Cinzel font)

## Claude Code TODO

- [ ] Export / Import JSON
- [ ] Tier column headers
- [ ] Node hover tooltip
- [ ] Right-click context menu
- [ ] Budget warning indicator
- [ ] Goal/milestone node type
- [ ] Onboarding empty state

---

## Run

```bash
npm install
npm run dev
```

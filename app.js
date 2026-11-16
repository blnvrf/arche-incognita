"use strict";

const $ = (selector) => document.querySelector(selector);
const viewport = $("#viewport");
const scene = $("#map-scene");
const zoomLevel = $("#zoom-level");
const mobileZoom = $("#mobile-zoom");
const mobileMenu = $("#mobile-menu");
const mobileLayout = matchMedia("(max-width: 650px)");
const currentEventLabel = $("#current-event-label");
const currentEventName = $("#current-event-name");
let currentEventId = null;
const completedToggle = $("#toggle-completed");
const mapPicker = $("#map-picker");
const collection = $("#collection");
const newButton = $("#new-button");
const newButtonLabel = $("#new-button-label");
const gainsTotal = $("#gains-total");
const connectionPreview = $("#connection-preview");
const arrowMarkers = [$("#arrow"), $("#arrow-active")];
const layer = $("#nodes");
const lines = $("#graph-lines");
const artwork = $("#map-artwork");
const glow = $("#glow-ellipse");
const compass = $("#radial-guides");
const compassGradient = $("#compass-gradient");
const drawer = $("#drawer");
const dialog = $("#dialog");
const form = $("#form");
const fields = form.elements;
const MONEY_FIELDS = { hourlyRate: "hourlyRateCents", cost: "costCents", gain: "gainCents" };
const editDialog = $("#edit-dialog");
const editForm = $("#edit-form");
const KEY = "orbit.task-map.v1";
const ROOT = "anchor";
const CARD_WIDTH = 148;
const CARD_HEIGHT = 52;
const FIRST_RING_RADIUS = 205;
const RING_GAP = 360;
const FOG_GAP = RING_GAP * .75;
const EMPTY_RING_OPACITY = [.6, .4, .2];
const MAX_ZOOM = 4;
const TILT = Math.cos(Math.PI / 3);
const BACKUP_FORMAT = "orbit-task-map";
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const ICONS = {
  edit: "M4 15.5 14.5 5a2 2 0 0 1 2.8 0l1.7 1.7a2 2 0 0 1 0 2.8L8.5 20H4z M13.5 6l4.5 4.5",
  delete: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7",
  complete: "m4 12 5 5L20 6",
  restore: "M8 5 3 10l5 5m-5-5h11a6 6 0 0 1 0 12h-4",
  eye: "M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6-10-6-10-6Z M14.7 12a2.7 2.7 0 1 0-5.4 0 2.7 2.7 0 0 0 5.4 0Z",
  eyeOff: "M4 4l16 16M2 12s2.1-3.4 5.6-5.1M10.3 6.1C17.6 5 22 12 22 12s-1.1 1.7-3 3.3M15.4 17.4c-7.6 2.9-13.4-5.4-13.4-5.4"
};
const TAU = Math.PI * 2;
const defaultAnchor = { id: ROOT, title: "arche", createdAt: Date.UTC(1980, 0, 1), description: "Every orbit starts here. Connect an event to arche to place it on the first ring." };

const EVENT_START_DATE = "2026-11-01";
const MAP_ACTIONS = ["__rename__", "__blank__", "__duplicate__", "__delete__"];
const initialMonth = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "Europe/Tirane" }).format();

const VIEWS = {
  tree: { name: "Tree view", add: "New event" },
  minor: { name: "Minor tasks", add: "Add task", key: "minorTasks" },
  tap: { name: "TAP", add: "Add TAP", key: "tapEntries" }
};

const SAMPLE_NAME = "Your path to something";

function sampleTree(now = Date.now()) {
  const event = (id, title, description, extra = {}) => ({ id: `sample-${id}`, title, description, createdAt: now, ...extra });
  const nodes = [
    event("spending", "Track your spending", "Write down everything you spend for 30 days. No judgment, just notice where the money goes."),
    event("walk", "Walk 20 minutes a day", "Any pace counts. Complete it after each walk and restore it for the next one to build a streak.", { recurring: true }),
    event("sell", "Sell things you no longer use", "Clear one closet or shelf and list what you don’t need.",
      { complete: true, completions: [{ at: now, complete: true }], gainCents: 12000 }),
    event("skill", "Pick one skill to learn", "Something useful at work or fun for you: cooking, spreadsheets, a language, an instrument."),
    event("budget", "Make a simple monthly budget", "Use your 30 days of spending to set limits for the big categories."),
    event("class", "Join a weekly class or group", "Yoga, a running club, a dance class. Other people make it easier to keep going.", { costCents: 4000 }),
    event("course", "Finish an online course", "Set aside two evenings a week until it’s done.", { costCents: 3000 }),
    event("fund", "Save one month of expenses", "Automate a small transfer into a separate account every payday."),
    event("5k", "Run your first 5K", "Sign up for a local race so there’s a date to train for."),
    event("raise", "Ask for a raise or a new role", "Bring what you learned and a list of your wins.", { gainCents: 300000 }),
    event("trip", "Take a weekend trip you’ve earned", "Plan it once your safety net is in place.", { costCents: 40000 })
  ];
  const angles = {
    spending: 3.55, sell: 2.75, budget: 3.65, fund: 3.3, trip: 4.6,
    walk: 1.3, class: 1.2, "5k": 1.1, skill: 5.75, course: 5.6, raise: 5.45
  };
  for (const node of nodes) node.angle = angles[node.id.slice(7)];
  const id = (name) => `sample-${name}`;
  const edges = [
    [ROOT, id("spending")], [ROOT, id("walk")], [ROOT, id("sell")], [ROOT, id("skill")],
    [id("spending"), id("budget")], [id("walk"), id("class")], [id("skill"), id("course")],
    [id("budget"), id("fund")], [id("sell"), id("fund"), { label: "kick-start" }],
    [id("class"), id("5k")], [id("course"), id("raise")],
    [id("fund"), id("trip")], [id("raise"), id("trip")]
  ];
  return { nodes, edges, current: id("spending") };
}

function defaultWorkspace(tree = { nodes: [], edges: [] }, name = initialMonth) {
  return {
    graphs: [{ id: "first", name, tree }], activeGraphId: "first",
    minorTasks: [], tapEntries: [], view: "tree", eventDatesInitialized: true
  };
}

function migrateTree(state) {
  const { tagNames, theme, sample, ...tree } = state;
  const alias = typeof tagNames?.million === "string" ? tagNames.million.trim().toLowerCase() : "";
  const canonicalTags = new Set(["million", "house", "health", "other"]);
  const nodes = state.nodes.filter((node) => {
    const tag = typeof node.tag === "string" ? node.tag.trim().toLowerCase() : "";
    if (canonicalTags.has(tag)) return tag === "million";
    return tag === "$1m" || tag === "1$m" || (tag && tag === alias);
  }).map(({ tag, hidden, ...node }) => node);
  const kept = new Set([ROOT, ...nodes.map((node) => node.id)]);
  tree.nodes = nodes;
  tree.edges = retainedConnections(state.edges, kept).edges;
  if (!nodes.some((node) => node.id === tree.current)) delete tree.current;
  if (tree.anchor) {
    const { tag, ...savedAnchor } = tree.anchor;
    if (savedAnchor.title === "Anchor") savedAnchor.title = defaultAnchor.title;
    tree.anchor = savedAnchor;
  }
  return tree;
}

function migrateWorkspace(state, parseGraph = (graph) => graph) {
  const current = state.maps.find((map) => map?.id === state.activeMapId) ?? state.maps[0];
  const graph = parseGraph(current?.graph);
  if (!Array.isArray(graph?.nodes) || !Array.isArray(graph?.edges)) {
    throw new Error("This backup contains invalid map data.");
  }
  return {
    ...defaultWorkspace(initializeEventDates(migrateTree(graph))),
    // Keep the original maps available in backups for recovery.
    previousMaps: { activeMapId: state.activeMapId, maps: state.maps }
  };
}

function readCollection(entries, minor) {
  if (!Array.isArray(entries)) throw new Error("This backup contains invalid card data.");
  const ids = new Set();
  return entries.map((entry) => {
    if (typeof entry?.id !== "string" || !entry.id || ids.has(entry.id) ||
        typeof entry.title !== "string" || !entry.title.trim() || entry.title.length > 80 ||
        typeof entry.description !== "string" ||
        (minor ? typeof entry.complete !== "boolean" : !entry.description.trim())) {
      throw new Error("This backup contains invalid card data.");
    }
    ids.add(entry.id);
    const { id, title, description, placement } = entry;
    if (placement !== undefined && (!placement || !Number.isFinite(placement.x) ||
        placement.x < 0 || placement.x > 1 || !Number.isFinite(placement.y) ||
        placement.y < 0 || placement.y > 1_000_000)) {
      throw new Error("This backup contains an invalid card position.");
    }
    const card = { id, title, description, placement };
    return minor ? { ...card, complete: entry.complete } : card;
  });
}

function initializeEventDates(tree) {
  const createdAt = localDate(EVENT_START_DATE);
  return { ...tree, nodes: tree.nodes.map((node) => ({ ...node, createdAt })) };
}

function normalizeWorkspace(state, parseGraph) {
  const source = state?.graphs ?? defaultWorkspace(state?.tree).graphs;
  if (!Array.isArray(source) || !source.length || (!state?.graphs && !state?.tree)) {
    throw new Error("This backup contains no graphs.");
  }
  const ids = new Set(MAP_ACTIONS);
  const names = new Set();
  const graphs = source.map((item) => {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (typeof item?.id !== "string" || !item.id || ids.has(item.id) ||
        !name || name.length > 60 || names.has(name.toLowerCase()) ||
        !Array.isArray(item.tree?.nodes) || !Array.isArray(item.tree?.edges)) {
      throw new Error("This backup contains invalid graph data.");
    }
    ids.add(item.id);
    names.add(name.toLowerCase());
    const tree = parseGraph(item.tree);
    return { id: item.id, name, tree: state.eventDatesInitialized === true ? tree : initializeEventDates(tree) };
  });
  return {
    graphs,
    eventDatesInitialized: true,
    activeGraphId: graphs.some(({ id }) => id === state.activeGraphId)
      ? state.activeGraphId : graphs[0].id,
    minorTasks: readCollection(state?.minorTasks, true),
    tapEntries: readCollection(state?.tapEntries, false),
    view: Object.hasOwn(VIEWS, state.view) ? state.view : "tree",
    previousMaps: Array.isArray(state.previousMaps?.maps) ? state.previousMaps : undefined
  };
}

function loadWorkspace() {
  try {
    const raw = window.archeNativeState ?? localStorage.getItem(KEY);
    const saved = JSON.parse(raw);
    if (saved?.graphs || saved?.tree) {
      const state = normalizeWorkspace(saved, (tree) => tree);
      migrated = !saved.graphs || saved.eventDatesInitialized !== true || saved.activeGraphId !== state.activeGraphId;
      return state;
    }
    const legacy = Array.isArray(saved?.maps) ? saved
      : Array.isArray(saved?.nodes) && Array.isArray(saved?.edges)
        ? { maps: [{ id: "high-level", name: "High-level view", graph: saved }] }
        : null;
    if (legacy) {
      const state = migrateWorkspace(legacy);
      migrated = true;
      return state;
    }
  } catch {
    // The map can still run when storage is unavailable.
  }
  return defaultWorkspace(sampleTree(), SAMPLE_NAME);
}

let migrated = false;
let workspace = loadWorkspace();
const activeMonth = () => workspace.graphs.find(({ id }) => id === workspace.activeGraphId);
const graphRanges = new Map();
let dateRange = null;
const readOnlyTree = () => !!dateRange;
let graph = displayedGraph();
let anchor = mapAnchor();
let selectedEdge = null;
let draftBend = null;
let depth = 0;
let selected = null;
let drawerMode = null;
let editing = null;
let connectionSource = null;
let gesture = null;
let pinch = null;
let suppressClick = false;
let toastTimeout;
let cameraDrawFrame;
let motionTimeout;
let moving = false;
let timerTicker;
let lastCameraTransform;
let decorationsZoom;
let gestureFrame;
let drawnZoom;
let zoomEditStart;
let pendingPointer;
const edgeViews = new Map();
const incidentViews = new Map();
let geometry = new Map();
let ringRadii = [];
let visible = [];
let visibleEdges = [];
let mapTopology;
let highlighted = new Set();
let cards = new Map();
let center = { x: 0, y: 0 };
let fitted = true;
let following = null;
let camera = { x: 0, y: 0, zoom: 1 };

function mapAnchor() {
  return { ...defaultAnchor, ...graph.anchor, createdAt: defaultAnchor.createdAt };
}

function displayedGraph() {
  const tree = activeMonth().tree;
  if (!dateRange) return tree;
  const nodes = tree.nodes.filter((node) => node.createdAt < dateRange.end).map((node) => {
    const history = (node.completions ?? []).filter(({ at }) => at < dateRange.end);
    return {
      ...node, collapsed: false, mapVisibility: undefined,
      complete: history.at(-1)?.complete ?? false,
      undatedCompletion: !history.length && node.complete && !node.completions?.length,
      completionCount: history.filter(({ complete }) => complete).length
    };
  });
  const ids = new Set([ROOT, ...nodes.map((node) => node.id)]);
  const edges = tree.edges.filter(([from, to]) => ids.has(from) && ids.has(to));
  return { nodes, edges, anchor: tree.anchor, hideCompleted: tree.hideCompleted };
}

function eventDate(at) {
  const date = new Date(at);
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const date = new Date(`${value}T00:00`);
  return !Number.isNaN(+date) && eventDate(date) === value ? +date : NaN;
}

function dateTimeValue(at) {
  const date = new Date(at);
  return `${eventDate(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function validTimestamp(at) {
  return Number.isSafeInteger(at) && Math.abs(at) <= 8.64e15;
}

const dateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const originDateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" });
const logDateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function save() {
  const state = JSON.stringify(workspace);
  const native = window.webkit?.messageHandlers?.archeAutosave;
  if (native) {
    native.postMessage(state).catch(() => toast("Could not autosave. Use Save to make a backup."));
    return;
  }
  try {
    localStorage.setItem(KEY, state);
  } catch {
    toast("Browser storage is unavailable. Use Save to make a backup.");
  }
}

function changed() {
  enforceTaskLocks();
  save();
}

function toast(message) {
  const box = $("#toast");
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { box.hidden = true; }, 3000);
}

function element(type, className, content) {
  const item = document.createElement(type);
  if (className) item.className = className;
  if (content !== undefined) item.textContent = content;
  return item;
}

function button(text, className, action) {
  const item = element("button", className, text);
  item.type = "button";
  if (action) item.addEventListener("click", action);
  return item;
}

function svg(type, properties) {
  const item = document.createElementNS("http://www.w3.org/2000/svg", type);
  for (const [key, value] of Object.entries(properties)) item.setAttribute(key, value);
  return item;
}

function iconButton(icon, label, action, style = "quiet") {
  const control = button("", `button icon-button ${style}`, action);
  const glyph = svg("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
  glyph.append(svg("path", {
    d: ICONS[icon], fill: "none", stroke: "currentColor", "stroke-width": 1.7,
    "stroke-linecap": "round", "stroke-linejoin": "round"
  }));
  control.setAttribute("aria-label", label);
  control.title = label;
  control.append(glyph);
  return control;
}

function getNode(id) {
  return id === ROOT ? anchor : graph.nodes.find((node) => node.id === id);
}

function adjacency(edges, directed = false) {
  const result = new Map();
  function add(from, to, edge) {
    if (!result.has(from)) result.set(from, []);
    result.get(from).push({ to, edge });
  }
  edges.forEach((edge) => {
    const [from, to] = edge;
    add(from, to, edge);
    if (!directed) add(to, from, edge);
  });
  return result;
}

function walk(edges, directed) {
  const neighbors = adjacency(edges, directed);
  const distances = new Map([[ROOT, 0]]);
  const previous = new Map();
  const queue = [ROOT];
  for (const id of queue) {
    for (const { to, edge } of neighbors.get(id) ?? []) {
      if (distances.has(to)) continue;
      distances.set(to, distances.get(id) + 1);
      previous.set(to, { id, edge });
      queue.push(to);
    }
  }
  return { distances, previous };
}

function nearestOpenAngle(preferred, occupied, radius) {
  if (!occupied.length) return preferred ?? -Math.PI / 2;
  const angles = occupied.map((angle) => (angle % TAU + TAU) % TAU).sort((a, b) => a - b);
  const spacing = Math.min(Math.PI, (CARD_WIDTH + 18) / radius);
  let widest = { size: 0, midpoint: angles[0] };
  let closest;
  let bestDistance = Infinity;
  for (const [index, left] of angles.entries()) {
    const right = angles[index + 1] ?? angles[0] + TAU;
    const gap = right - left;
    const midpoint = (left + right) / 2;
    if (gap > widest.size) widest = { size: gap, midpoint };
    if (preferred === undefined || gap < 2 * spacing) continue;
    const target = preferred + TAU * Math.round((midpoint - preferred) / TAU);
    const candidate = Math.max(left + spacing, Math.min(right - spacing, target));
    const distance = Math.abs(candidate - target);
    if (distance < bestDistance) {
      closest = candidate;
      bestDistance = distance;
    }
  }
  return closest ?? widest.midpoint;
}

function placeOnRing(id, radius, angle) {
  geometry.set(id, {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    radius,
    angle
  });
}

function isHiddenFromMap(node) {
  return node && node.id !== ROOT && (
    node.mapVisibility === "hidden" ||
    (node.mapVisibility !== "visible" && graph.hideCompleted && node.complete)
  );
}

function buildMapTopology() {
  const nodes = graph.nodes.filter((node) => !isHiddenFromMap(node));
  if (nodes.length === graph.nodes.length) return { nodes, edges: graph.edges, shortcuts: new Set() };
  const visibleIds = new Set([ROOT, ...nodes.map((node) => node.id)]);
  return { nodes, ...retainedConnections(graph.edges, visibleIds) };
}

function retainedConnections(allEdges, visibleIds) {
  const shortcuts = new Set();
  const edges = allEdges.filter(([from, to]) => visibleIds.has(from) && visibleIds.has(to));
  const outgoing = adjacency(allEdges, true);

  for (const from of visibleIds) {
    const direct = (outgoing.get(from) ?? []).map(({ to }) => to);
    const visited = new Set([from, ...direct]);
    const queue = direct.filter((to) => !visibleIds.has(to));
    // Visit hidden intermediates until a visible successor is reached.
    for (const id of queue) {
      for (const { to } of outgoing.get(id) ?? []) {
        if (visited.has(to)) continue;
        visited.add(to);
        if (visibleIds.has(to)) {
          const shortcut = [from, to];
          edges.push(shortcut);
          shortcuts.add(shortcut);
        } else {
          queue.push(to);
        }
      }
    }
  }
  return { edges, shortcuts };
}

function layout() {
  mapTopology = buildMapTopology();
  const { nodes: mapNodes, edges: mapEdges } = mapTopology;
  const { distances } = walk(mapEdges);
  const outerDepth = Math.max(...distances.values());
  const linked = new Set(mapEdges.flatMap(([from, to]) => [from, to]));
  const groups = new Map();
  const unconnected = [];
  for (const node of mapNodes) {
    if (!linked.has(node.id)) {
      unconnected.push(node);
      continue;
    }
    const depth = distances.get(node.id) ?? outerDepth + 1;
    if (!groups.has(depth)) groups.set(depth, []);
    groups.get(depth).push(node);
  }
  const unconnectedDepth = Math.max(1, ...groups.keys()) + 1;
  groups.set(unconnectedDepth, unconnected);
  ringRadii = [];
  geometry = new Map([[ROOT, { x: 0, y: 0, radius: 0 }]]);
  const records = new Map(graph.nodes.map((node) => [node.id, node]));
  const origins = adjacency(graph.edges.map(([from, to]) => [to, from]), true);
  const shortcuts = adjacency([...mapTopology.shortcuts].map(([from, to]) => [to, from]), true);
  let radius = 0;
  for (let depth = 1; depth <= unconnectedDepth; depth++) {
    const nodes = groups.get(depth) ?? [];
    const spacedRadius = depth === 1 ? FIRST_RING_RADIUS : radius + RING_GAP;
    radius = Math.max(spacedRadius, nodes.length * 166 / TAU);
    ringRadii.push(radius);
    const occupied = nodes.filter((node) => Number.isFinite(node.angle)).map((node) => node.angle);
    for (const node of nodes) {
      if (!Number.isFinite(node.angle)) {
        const sources = [...(origins.get(node.id) ?? []), ...(shortcuts.get(node.id) ?? [])];
        const preferred = sources.map(({ to }) => geometry.get(to)?.angle ?? records.get(to)?.angle)
          .find(Number.isFinite);
        node.angle = nearestOpenAngle(preferred, occupied, radius);
        occupied.push(node.angle);
      }
      placeOnRing(node.id, radius, node.angle);
    }
  }
  depth = .39 / (radius + CARD_WIDTH / 2);
}

function collapsedDescendants(outgoing, nodes) {
  const hidden = new Set();
  for (const node of nodes) {
    if (!node.collapsed || hidden.has(node.id)) continue;
    const seen = new Set([ROOT, node.id]);
    const queue = [node.id];
    for (const id of queue) {
      for (const { to } of outgoing.get(id) ?? []) {
        if (seen.has(to)) continue;
        seen.add(to);
        hidden.add(to);
        queue.push(to);
      }
    }
  }
  return hidden;
}

function revealBranch(id) {
  if (!graph.nodes.some((node) => node.collapsed)) return;
  const { nodes, edges } = buildMapTopology();
  if (!collapsedDescendants(adjacency(edges, true), nodes).has(id)) return;
  const incoming = adjacency(edges.map(([from, to]) => [to, from]), true);
  const seen = new Set([ROOT, id]);
  const queue = [id];
  for (const child of queue) {
    for (const { to } of incoming.get(child) ?? []) {
      if (seen.has(to)) continue;
      seen.add(to);
      delete getNode(to).collapsed;
      queue.push(to);
    }
  }
  save();
}

function refreshGraph() {
  syncTimerTicker();
  updateMapSummary();
  const { nodes, edges } = mapTopology;
  const outgoing = adjacency(edges, true);
  const hidden = collapsedDescendants(outgoing, nodes);
  visible = [anchor, ...nodes.filter((node) => !hidden.has(node.id))];
  const ids = new Set(visible.map((node) => node.id));
  const collapsed = new Set(nodes.filter((node) => node.collapsed).map((node) => node.id));
  visibleEdges = edges.filter(([from, to]) => ids.has(from) && ids.has(to) && !collapsed.has(from));
  if (drawerMode === "node" && !ids.has(selected) && !isHiddenFromMap(getNode(selected))) {
    selected = null;
    drawerMode = null;
  }
  const hide = !!graph.hideCompleted;
  const toggleLabel = hide ? "Show completed events" : "Hide completed events";
  completedToggle.setAttribute("aria-label", toggleLabel);
  completedToggle.setAttribute("aria-pressed", hide);
  completedToggle.title = toggleLabel;
  if (drawerMode === "edge" && !visibleEdges.includes(selectedEdge)) {
    drawerMode = null;
    selectedEdge = null;
  }
  if (!ids.has(connectionSource)) connectionSource = null;
  if (following && !ids.has(following)) {
    following = null;
    fitted = true;
  }

  const hint = $("#hint");
  hint.hidden = !connectionSource;
  hint.textContent = connectionSource ? `Choose a target for ${getNode(connectionSource).title} · Esc to cancel` : "";
  const active = document.activeElement;
  const focusId = active?.closest(".node")?.dataset.id;
  const focusControl = active?.classList.contains("port") ? ".port"
    : active?.classList.contains("branch-toggle") ? ".branch-toggle" : ".node-body";
  const incoming = adjacency(graph.edges.map(([from, to]) => [to, from]), true);
  cards = new Map(visible.map((node) => [node.id, makeCard(node, taskBlocker(node, incoming), node.id !== ROOT && outgoing.has(node.id))]));
  layer.replaceChildren(...cards.values());
  if (focusId) cards.get(focusId)?.querySelector(focusControl)?.focus({ preventScroll: true });
  updatePath();
  buildScene(outgoing);
}

function updatePath() {
  highlighted = new Set();
  if (!selected) return;
  for (const edge of visibleEdges) {
    if (edge[0] === selected) highlighted.add(edge);
  }
  if (selected === ROOT) return;
  let { previous } = walk(visibleEdges, true);
  if (!previous.has(selected)) ({ previous } = walk(visibleEdges));
  let step = previous.get(selected);
  if (!step) {
    for (const edge of visibleEdges) {
      if (edge[1] === selected) highlighted.add(edge);
    }
  }
  while (step) {
    highlighted.add(step.edge);
    step = previous.get(step.id);
  }
}

function makeCard(node, blocker, hasBranch) {
  const card = element("div", `node${node.id === ROOT ? " anchor" : ""}`);
  card.dataset.id = node.id;
  card.classList.toggle("current", graph.current === node.id);
  card.classList.toggle("completed", !!node.complete);
  card.classList.toggle("locked", !!blocker);
  card.classList.toggle("has-branch", hasBranch && !readOnlyTree());
  const body = button("", "node-body", () => {
    if (suppressClick) return;
    if (connectionSource) {
      if (connectionSource === node.id) cancelConnection();
      else addEdge(connectionSource, node.id);
    } else choose(node.id);
  });
  const caption = element("span", "node-caption");
  caption.append(element("strong", "", node.title));
  if (node.id !== ROOT) {
    const footer = element("span", "node-footer");
    if (node.recurring) {
      const count = node.completionCount ?? 0;
      const counter = element("span", "node-recurring", `×${count}`);
      counter.title = `Completed ${count} ${count === 1 ? "time" : "times"}`;
      footer.append(counter);
    }
    const amounts = element("span", "node-amounts");
    if (node.hourlyRateCents > 0 || completionValue(node, "gainCents") > 0) {
      const earnings = element("span", "node-earnings");
      writeEarnings(node, earnings);
      amounts.append(earnings);
    }
    const costCents = completionValue(node, "costCents");
    if (costCents > 0) {
      const cost = USD.format(-costCents / 100);
      const amount = element("span", "node-cost", cost);
      amount.title = `Cost ${cost}`;
      amounts.append(amount);
    }
    if (amounts.children.length) footer.append(amounts);
    if (footer.children.length) caption.append(footer);
  }
  if (graph.current === node.id) caption.append(element("span", "current-dot"));
  body.append(caption);
  body.title = node.complete ? `${node.title} (completed)` : blocker ? `${node.title} · Locked by ${blocker.title}` : node.title;
  card.append(body);
  if (readOnlyTree()) return card;
  if (node.id !== ROOT) body.addEventListener("pointerdown", (event) => startGesture(event, "move", node.id));
  const port = button("+", "port", () => {
    if (suppressClick) return;
    connectionSource = connectionSource === node.id ? null : node.id;
    refreshGraph();
    draw();
  });
  port.title = "Drag to connect, or select a target";
  port.setAttribute("aria-label", `Connect from ${node.title}`);
  port.setAttribute("aria-pressed", connectionSource === node.id);
  port.addEventListener("pointerdown", (event) => startGesture(event, "connect", node.id));
  card.append(port);
  if (hasBranch) {
    const toggle = button(node.collapsed ? "+" : "−", "branch-toggle", () => {
      if (node.collapsed) delete node.collapsed;
      else node.collapsed = true;
      save();
      refresh();
    });
    const label = `${node.collapsed ? "Expand" : "Collapse"} events after ${node.title}`;
    toggle.title = label;
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("aria-expanded", !node.collapsed);
    card.append(toggle);
  }
  return card;
}

function project({ x, y }) {
  const w = 1 - y * depth;
  return { x: x / w, y: y * TILT / w, w };
}

function unproject(x, y) {
  const worldY = y / Math.max(.05, TILT + y * depth);
  return { x: x * (1 - worldY * depth), y: worldY };
}

function rim(point, control, extra = 0) {
  const dx = control.x - point.x;
  const dy = control.y - point.y;
  const ratio = Math.min(
    (CARD_WIDTH / 2 - 2 + extra) / Math.abs(dx),
    (CARD_HEIGHT / 2 + extra) / Math.abs(dy)
  );
  return { x: point.x + dx * ratio, y: point.y + dy * ratio };
}

function edgeCurve(a, b, bend) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const control = project({ x: (a.x + b.x) / 2 - dy * bend, y: (a.y + b.y) / 2 + dx * bend });
  if (Math.hypot(dx, dy) < 1) return { path: "", midpoint: control };
  const start = rim(project(a), control);
  const end = rim(project(b), control, 6);
  return {
    path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    midpoint: { x: (start.x + 2 * control.x + end.x) / 4, y: (start.y + 2 * control.y + end.y) / 4 }
  };
}

function defaultBend(edge, outgoing) {
  const [from, to] = edge;
  const reversed = outgoing
    ? outgoing.get(to)?.some(({ to: target }) => target === from)
    : graph.edges.some(([a, b]) => a === to && b === from);
  if (reversed) return .28;
  return from === ROOT ? 0 : .12;
}

function drawRing(radius, className, opacity = 1) {
  const points = Array.from({ length: 80 }, (_, index) => {
    const angle = index * TAU / 80;
    const p = project({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    return `${p.x},${p.y}`;
  }).join(" ");
  return svg("polygon", { class: className, points, opacity });
}

function drawBackground() {
  const origin = project(geometry.get(ROOT));
  const lastOccupied = Math.max(...visible.map((node) => geometry.get(node.id).radius));
  const radius = ringRadii.find((ring) => ring > lastOccupied) ?? ringRadii.at(-1) + FOG_GAP;
  // Perspective shifts the ellipse's center toward the foreground. Keep its light source on the Anchor.
  const perspective = radius * depth;
  const rx = radius / Math.sqrt(1 - perspective ** 2);
  const ry = radius * TILT / (1 - perspective ** 2);
  const cy = origin.y + perspective * ry;
  $("#map-glow").setAttribute("fy", (1 - perspective) / 2);
  glow.setAttribute("cx", origin.x);
  glow.setAttribute("cy", cy);
  glow.setAttribute("rx", rx);
  glow.setAttribute("ry", ry);
  compassGradient.setAttribute("gradientTransform", `translate(${origin.x} ${cy}) scale(${rx} ${ry})`);
  artwork.setAttribute("x", origin.x - rx);
  artwork.setAttribute("y", cy - ry);
  artwork.setAttribute("width", rx * 2);
  artwork.setAttribute("height", ry * 2);
}

function radialGuides(radius) {
  return [180, 90, 135, 45].map((degrees) => {
    const angle = degrees * Math.PI / 180;
    const point = { x: radius * Math.cos(angle), y: -radius * Math.sin(angle) };
    const start = project(point);
    const end = project({ x: -point.x, y: -point.y });
    return svg("line", {
      class: "radial-guide", opacity: .35,
      x1: start.x, y1: start.y, x2: end.x, y2: end.y
    });
  });
}

function updateEdge(edge) {
  const entry = edgeViews.get(edge);
  if (!entry) return;
  const [from, to] = edge;
  const bend = edge === selectedEdge && draftBend != null ? draftBend : entry.bend;
  const curve = edgeCurve(geometry.get(from), geometry.get(to), bend);
  entry.path.setAttribute("d", curve.path);
  entry.hit?.setAttribute("d", curve.path);
  if (entry.label) {
    entry.label.setAttribute("x", curve.midpoint.x);
    entry.label.setAttribute("y", curve.midpoint.y);
  }
}

function positionCard(id) {
  const card = cards.get(id);
  if (!card) return;
  const point = project(geometry.get(id));
  card.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
  card.style.zIndex = selected === id ? 2147483647 : gesture?.id === id ? 2147483646 : Math.round(point.y);
}

function buildScene(outgoing) {
  const outer = ringRadii.at(-1);
  const occupied = new Set(visible.map((node) => geometry.get(node.id).radius));
  const fogRadii = EMPTY_RING_OPACITY.map((_, index) => outer + (index + 1) * FOG_GAP);
  drawBackground();
  const strokes = [];
  let lastDrawnRadius = 0;
  let emptyRun = 0;
  for (const radius of [...ringRadii, ...fogRadii]) {
    const hasNodes = occupied.has(radius);
    const unconnected = radius === outer;
    if (hasNodes) emptyRun = 0;
    const opacity = hasNodes && !unconnected ? 1 : EMPTY_RING_OPACITY[emptyRun++];
    if (opacity === undefined) continue;
    const className = unconnected ? "ring unconnected-ring" : radius > outer ? "ring fog-ring" : "ring";
    strokes.push(drawRing(radius, className, opacity));
    lastDrawnRadius = radius;
  }
  compass.replaceChildren(...radialGuides(lastDrawnRadius));

  edgeViews.clear();
  incidentViews.clear();
  const completed = new Set(visible.filter((node) => node.complete).map((node) => node.id));
  const titles = new Map(visible.map((node) => [node.id, node.title]));
  for (const edge of visibleEdges) {
    const [from, to, options] = edge;
    const active = highlighted.has(edge) || edge === selectedEdge;
    const bend = options?.bend ?? defaultBend(edge, outgoing);
    const shortcut = mapTopology.shortcuts.has(edge);
    const path = svg("path", {
      class: `edge${shortcut ? " shortcut" : ""}${active ? " active" : ""}${completed.has(from) || completed.has(to) ? " completed" : ""}`,
      "marker-end": active ? "url(#arrow-active)" : "url(#arrow)"
    });
    strokes.push(path);
    let hit;
    if (!shortcut && !readOnlyTree()) {
      hit = svg("path", {
        class: "edge-hit", role: "button", tabindex: "0",
        "aria-label": `Edit dependency from ${titles.get(from)} to ${titles.get(to)}`
      });
      hit.addEventListener("click", () => { if (!suppressClick) chooseEdge(edge); });
      hit.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        chooseEdge(edge);
      });
      strokes.push(hit);
    }
    let label;
    if (options?.label) {
      label = svg("text", { class: "edge-label" });
      label.textContent = options.label;
      strokes.push(label);
    }
    edgeViews.set(edge, { path, hit, label, bend });
    for (const id of [from, to]) {
      if (!incidentViews.has(id)) incidentViews.set(id, []);
      incidentViews.get(id).push(edge);
    }
    updateEdge(edge);
  }
  lines.replaceChildren(...strokes);
  for (const [id, card] of cards) {
    positionCard(id);
    card.classList.toggle("selected", selected === id);
    card.classList.toggle("target", gesture?.target === id);
    card.querySelector(".node-body").setAttribute("aria-pressed", selected === id);
  }
}

function draw() {
  if (cameraDrawFrame !== undefined) {
    cancelAnimationFrame(cameraDrawFrame);
    cameraDrawFrame = undefined;
  }
  center = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
  const tree = workspace.view === "tree";
  const zoom = tree ? camera.zoom : Math.min(
    viewport.clientWidth * .62 / Number(glow.getAttribute("rx")),
    viewport.clientHeight * .65 / Number(glow.getAttribute("ry"))
  );
  const x = center.x + (tree ? camera.x * zoom : 0);
  const y = center.y + (tree ? camera.y : -Number(glow.getAttribute("cy"))) * zoom;
  const transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
  if (lastCameraTransform !== transform) {
    lastCameraTransform = transform;
    scene.style.transform = transform;
  }
  if (!tree) return;
  if (drawnZoom !== camera.zoom) {
    drawnZoom = camera.zoom;
    const percentage = String(Math.round(camera.zoom * 1000) / 10);
    if (zoomEditStart === undefined) zoomLevel.value = percentage;
    mobileZoom.textContent = `${Math.round(camera.zoom * 100)}%`;
    mobileZoom.title = `${percentage}% · center on arche at 100%`;
  }
  if (moving || decorationsZoom === camera.zoom) return;
  decorationsZoom = camera.zoom;
  scene.style.setProperty("--edge-label-size", `${10 / camera.zoom}px`);
  scene.style.setProperty("--edge-label-offset", `${-7 / camera.zoom}px`);
  scene.style.setProperty("--edge-label-outline", `${4 / camera.zoom}px`);
  for (const marker of arrowMarkers) {
    marker.setAttribute("markerWidth", 7 / camera.zoom);
    marker.setAttribute("markerHeight", 7 / camera.zoom);
  }
}

function scheduleCameraDraw() {
  if (cameraDrawFrame !== undefined) return;
  cameraDrawFrame = requestAnimationFrame(() => {
    cameraDrawFrame = undefined;
    draw();
  });
}

function beginMotion() {
  clearTimeout(motionTimeout);
  if (moving) return;
  moving = true;
  viewport.classList.add("moving");
}

function endMotion() {
  clearTimeout(motionTimeout);
  moving = false;
  viewport.classList.remove("moving");
  draw();
}

function updateConnectionPreview() {
  if (!gesture || gesture.mode !== "connect" || !gesture.moved || !cards.has(gesture.id)) {
    connectionPreview.setAttribute("d", "");
    return;
  }
  const point = project(geometry.get(gesture.id));
  const x = (gesture.x - center.x) / camera.zoom - camera.x;
  const y = (gesture.y - center.y) / camera.zoom - camera.y;
  connectionPreview.setAttribute("d", `M ${point.x + CARD_WIDTH / 2} ${point.y} L ${x} ${y}`);
}

function fitCamera() {
  const radius = ringRadii.at(-1);
  const minY = project({ x: 0, y: -radius }).y - CARD_HEIGHT / 2;
  const maxY = project({ x: 0, y: radius }).y + CARD_HEIGHT / 2;
  const maxX = radius / Math.sqrt(1 - (radius * depth) ** 2) + CARD_WIDTH / 2 + 9;
  const zoom = Math.min(1.2, (viewport.clientWidth - 20) / (maxX * 2), (viewport.clientHeight - 18) / (maxY - minY));
  return { x: 0, y: -(minY + maxY) / 2, zoom: Math.max(.04, zoom) };
}

function focusCamera(id) {
  const point = project(geometry.get(id));
  return { x: -point.x, y: -point.y, zoom: 1 };
}

function syncCamera() {
  if (fitted) camera = fitCamera();
  else if (following) camera = focusCamera(following);
  draw();
}

function refresh() {
  layout();
  refreshGraph();
  renderDrawer();
  syncCamera();
}

function choose(id) {
  const node = getNode(id);
  if (!node) return;
  const hiddenEvent = isHiddenFromMap(node);
  if (!hiddenEvent && !readOnlyTree()) revealBranch(id);
  selected = id;
  selectedEdge = null;
  drawerMode = "node";
  following = hiddenEvent ? null : id;
  if (!hiddenEvent) fitted = false;
  refresh();
}

function closeDrawer() {
  const wasSelected = selected;
  const returnToOverview = drawerMode === "node";
  selectedEdge = null;
  selected = null;
  drawerMode = null;
  if (returnToOverview) {
    following = null;
    fitted = true;
  }
  refresh();
  (cards.get(wasSelected)?.querySelector(".node-body") ?? $("#details-button")).focus({ preventScroll: true });
}

function addEdge(from, to) {
  if (from === to || !getNode(from) || !getNode(to)) return;
  connectionSource = null;
  if (graph.edges.some(([a, b]) => a === from && b === to)) {
    refresh();
    toast("That connection already exists.");
    return;
  }
  graph.edges.push([from, to]);
  changed();
  refresh();
  toast(`Connected ${getNode(from).title} → ${getNode(to).title}`);
}

function removeEdge(edge) {
  graph.edges = graph.edges.filter((other) => other !== edge);
  changed();
  refresh();
  toast("Connection removed.");
}

function cancelConnection() {
  connectionSource = null;
  refreshGraph();
  draw();
}

function setComplete(node, complete) {
  if (node.id === ROOT || !!node.complete === complete || (complete && taskBlocker(node))) return;
  if (complete && node.recurring) {
    node.completionCount = Math.min(Number.MAX_SAFE_INTEGER, (node.completionCount ?? 0) + 1);
  }
  const at = Date.now();
  (node.completions ??= []).push({ at: Math.max(at, node.completions?.at(-1)?.at ?? at), complete });
  node.complete = complete;
  if (complete) {
    stopTimer(node, at);
    if (graph.current === node.id) graph.current = null;
  }
  changed();
  refresh();
  toast(complete ? "Event completed." : "Event restored.");
}

function drawerHeading(label, title) {
  const heading = element("div", "drawer-heading");
  const details = element("div");
  if (label) details.append(element("div", "eyebrow", label));
  details.append(element("h2", "", title));
  const close = button("×", "close", closeDrawer);
  close.setAttribute("aria-label", "Close details");
  heading.append(details, close);
  return heading;
}

function toggleEventVisibility(node) {
  if (isHiddenFromMap(node)) {
    if (graph.hideCompleted && node.complete) node.mapVisibility = "visible";
    else delete node.mapVisibility;
  } else {
    node.mapVisibility = "hidden";
  }
  save();
  choose(node.id);
  drawer.querySelector(".event-visibility")?.focus({ preventScroll: true });
}

function renderHiddenEvents() {
  const hidden = graph.nodes.filter(isHiddenFromMap);
  if (!hidden.length) return;
  const section = element("section", "drawer-section hidden-events");
  section.append(element("h3", "", "Hidden events"));
  for (const node of hidden) {
    const row = element("div", "connection-row");
    row.append(button(node.title, "text-button", () => choose(node.id)));
    section.append(row);
  }
  drawer.append(section);
}

function renderDrawer() {
  drawer.hidden = !drawerMode;
  drawer.replaceChildren();
  if (!drawerMode) return;
  if (drawerMode === "edge") {
    renderEdgeDrawer(selectedEdge);
    return;
  }
  if (drawerMode === "details") {
    const finance = element("section", "finance-details");
    drawer.append(drawerHeading("", "Details"), finance);
    renderFinancialDetails(finance);
    renderHiddenEvents();
    return;
  }

  const node = getNode(selected);
  const blocker = taskBlocker(node);
  drawer.append(drawerHeading(node.id === ROOT ? "MAP CENTER" : node.complete ? "COMPLETED" : blocker ? "LOCKED EVENT" : "", node.title));
  drawer.append(element("p", "", node.description || "No description yet."));
  if (node.recurring) {
    const count = node.completionCount ?? 0;
    drawer.append(element("p", "recurring-summary", `Recurring · ${count} ${count === 1 ? "completion" : "completions"}`));
  }
  if (blocker) {
    const requirement = blocker.recurring ? " at least once" : "";
    drawer.append(element("p", "locked-message", `Complete “${blocker.title}”${requirement} before starting this event.`));
  }
  drawer.append(element("p", "money-detail", node.createdAt === undefined
    ? "Event date unknown" : `Event date · ${(node.id === ROOT ? originDateLabel : dateLabel).format(node.createdAt)}`));
  if (readOnlyTree()) {
    if (node.id !== ROOT) {
      const time = element("p", "money-detail");
      time.append(element("span", "", "Tracked time · "), element("span", "timer-clock", formatTime(timeTotal(node))));
      drawer.append(time);
      if (dateRange) renderRangedTimeLog(node);
      renderCompletionHistory(node);
      drawer.append(button("Open live event", "button quiet", () => {
        graphRanges.delete(workspace.activeGraphId);
        resetMapView();
        choose(node.id);
      }));
    }
    return;
  }
  drawer.append(button("＋ Add connected event", "button quiet add-connected", () => openForm(null, node.id)));
  const actions = element("div", "drawer-actions");
  actions.append(iconButton("edit", "Edit event", () => openForm(node)));
  if (node.id !== ROOT) {
    if (node.complete) {
      actions.append(iconButton("restore", "Restore event", () => setComplete(node, false)));
    } else {
      const complete = iconButton("complete", "Complete event", () => setComplete(node, true), "quiet success");
      complete.disabled = !!blocker;
      actions.append(complete);
    }
    const hidden = isHiddenFromMap(node);
    const visibility = iconButton(hidden ? "eyeOff" : "eye", hidden ? "Show event on map" : "Hide event from map",
      () => toggleEventVisibility(node), "quiet event-visibility");
    visibility.setAttribute("aria-pressed", !!hidden);
    actions.append(visibility, iconButton("delete", "Delete event", () => requestDelete(node), "quiet danger"));
  }
  drawer.append(actions);
  if (node.id !== ROOT && !node.complete) {
    const current = graph.current === node.id;
    const running = activeTimer();
    const currentButton = button(node.startedAt ? "Current · timer running" : current ? "Clear current" : "Set as current", "button primary current-control", () => setCurrent(node));
    currentButton.setAttribute("aria-pressed", current);
    currentButton.disabled = !!running || !!blocker;
    if (running && !node.startedAt) currentButton.title = `Pause the timer on ${running.title} to change the current event.`;
    drawer.append(currentButton);
  }
  if (node.id !== ROOT) {
    renderTime(node, blocker);
    renderCompletionHistory(node);
  }

  const section = element("section", "drawer-section");
  section.append(element("h3", "", "Dependencies"));
  const incident = graph.edges.filter(([from, to]) => from === node.id || to === node.id);
  for (const edge of incident) {
    const [from, to] = edge;
    const other = getNode(from === node.id ? to : from);
    const row = element("div", "connection-row");
    const label = `${from === node.id ? "→" : "←"} ${other.title}${other.complete ? " (completed)" : ""}`;
    const edit = button("Edit dependencies", "button quiet", () => chooseEdge(edge));
    const details = element("div");
    details.append(button(label, "text-button", () => choose(other.id)));
    if (edge[2]?.label) details.append(element("small", "connection-label", edge[2].label));
    row.append(details, edit);
    section.append(row);
  }
  if (!incident.length) section.append(element("p", "", "No connections yet."));
  const targets = [anchor, ...graph.nodes].filter((target) => target.id !== node.id && !incident.some(([from, to]) => from === node.id && to === target.id));
  if (targets.length) {
    const controls = element("div", "connection-form");
    const select = element("select");
    select.setAttribute("aria-label", "Outgoing connection target");
    select.append(...targets.map((target) => new Option(target.title, target.id)));
    controls.append(select, button("Connect →", "button quiet", () => addEdge(node.id, select.value)));
    section.append(controls);
  }
  drawer.append(section);
}

function openEditor({ heading, title, content, submit = "Save changes", action, variant = "" }) {
  editDialog.dataset.variant = variant;
  $("#edit-eyebrow").textContent = heading;
  $("#edit-title").textContent = title;
  $("#edit-fields").replaceChildren(...content);
  $("#edit-submit").textContent = submit;
  editForm.onsubmit = (event) => {
    event.preventDefault();
    if (action() !== false) editDialog.close();
  };
  editDialog.showModal();
}

for (const id of ["#edit-cancel", "#edit-close"]) {
  $(id).addEventListener("click", () => editDialog.close());
}

function labelField(title, control) {
  const label = element("label", "", title);
  label.append(control);
  return label;
}

function chooseEdge(edge) {
  if (!graph.edges.includes(edge)) return;
  selected = null;
  selectedEdge = edge;
  drawerMode = "edge";
  following = null;
  refresh();
  drawer.querySelector("select")?.focus({ preventScroll: true });
}

function renderEdgeDrawer(edge) {
  draftBend = null;
  const [from, to, options] = edge;
  drawer.append(drawerHeading("", "Edit dependencies"));
  const source = element("select");
  const target = element("select");
  for (const node of [anchor, ...graph.nodes]) {
    const title = node.title + (node.complete ? " (completed)" : "");
    source.append(new Option(title, node.id));
    target.append(new Option(title, node.id));
  }
  source.value = from;
  target.value = to;
  const label = element("input");
  label.value = options?.label ?? "";
  label.maxLength = 48;
  label.placeholder = "Optional";
  const curve = element("input");
  curve.type = "range";
  curve.min = "-0.85";
  curve.max = "0.85";
  curve.step = "0.01";
  const initialBend = options?.bend ?? defaultBend(edge);
  curve.value = initialBend;
  const value = element("output", "range-value", Number(curve.value).toFixed(2));
  curve.addEventListener("input", () => {
    const bend = Number(curve.value);
    value.textContent = bend.toFixed(2);
    if (source.value === from && target.value === to) {
      draftBend = bend;
      updateEdge(edge);
    }
  });
  const reverse = button("Reverse arrow", "button quiet", () => {
    [source.value, target.value] = [target.value, source.value];
    curve.value = -Number(curve.value);
    draftBend = null;
    updateEdge(edge);
    value.textContent = Number(curve.value).toFixed(2);
  });
  const apply = button("Save dependency", "button primary", () => {
    if (source.value === target.value) {
      toast("Choose two different events.");
      return;
    }
    if (graph.edges.some((other) => other !== edge && other[0] === source.value && other[1] === target.value)) {
      toast("That connection already exists.");
      return;
    }
    const bend = Number(curve.value);
    const metadata = { label: label.value.trim() };
    if (options?.bend !== undefined || bend !== initialBend) metadata.bend = bend;
    edge.splice(0, edge.length, source.value, target.value, metadata);
    changed();
    refresh();
    toast("Connection saved.");
  });
  const remove = button("Delete dependency", "button quiet danger", () => removeEdge(edge));
  const actions = element("div", "drawer-actions");
  actions.append(apply, reverse, remove);
  const curveField = labelField("Curve", curve);
  curveField.append(value);
  drawer.append(
    labelField("From", source), labelField("To", target),
    labelField("Label", label), curveField, actions
  );
}

function bypassTask(id) {
  const incoming = [];
  const outgoing = [];
  const kept = [];
  for (const edge of graph.edges) {
    const [from, to] = edge;
    if (to === id) incoming.push(from);
    else if (from === id) outgoing.push(to);
    else kept.push(edge);
  }
  const existing = new Set(kept.map(([from, to]) => JSON.stringify([from, to])));
  for (const from of incoming) {
    for (const to of outgoing) {
      if (from === to) continue;
      const key = JSON.stringify([from, to]);
      if (existing.has(key)) continue;
      kept.push([from, to]);
      existing.add(key);
    }
  }
  graph.edges = kept;
}

function requestDelete(node) {
  openEditor({
    heading: "EVENT MAP",
    title: "Delete event?",
    content: [element("p", "", `“${node.title}” and its time log will be removed. Any events feeding into it will connect directly to its next events.`)],
    submit: "Delete event",
    action: () => {
      graph.nodes = graph.nodes.filter((item) => item !== node);
      bypassTask(node.id);
      if (graph.current === node.id) graph.current = null;
      selected = null;
      following = null;
      drawerMode = null;
      fitted = true;
      changed();
      refresh();
      toast("Event deleted.");
    }
  });
}

function taskBlocker(node, incoming = adjacency(graph.edges.map(([from, to]) => [to, from]), true)) {
  if (!node || node.id === ROOT || node.complete) return null;
  const visited = new Set([ROOT, node.id]);
  const queue = [node.id];
  for (const id of queue) {
    for (const { to } of incoming.get(id) ?? []) {
      if (visited.has(to)) continue;
      visited.add(to);
      const prior = getNode(to);
      if (!prior) continue;
      const fulfilled = prior.recurring ? (prior.completionCount ?? 0) > 0 : prior.complete;
      if (!fulfilled) return prior;
      queue.push(to);
    }
  }
  return null;
}

function enforceTaskLocks() {
  let adjusted = false;
  const now = Date.now();
  for (const node of graph.nodes) {
    if (!node.startedAt && graph.current !== node.id) continue;
    if (!taskBlocker(node)) continue;
    stopTimer(node, now);
    if (graph.current === node.id) graph.current = null;
    adjusted = true;
  }
  return adjusted;
}

function activeTimer() {
  return graph.nodes.find((node) => node.startedAt && (dateRange ? node.startedAt < dateRange.end : !node.complete));
}

function setCurrent(node) {
  if (activeTimer() || node.complete || taskBlocker(node)) return;
  graph.current = graph.current === node.id ? null : node.id;
  changed();
  refresh();
}

function timeOverlap(from, to) {
  return Math.max(0, Math.min(to, dateRange?.end ?? Infinity) - Math.max(from, dateRange?.start ?? -Infinity));
}

function timeEntryDuration(entry) {
  if (!dateRange) return entry.ms;
  if (entry.timed) return timeOverlap(entry.at, entry.at + entry.ms);
  return entry.at >= dateRange.start && entry.at < dateRange.end ? entry.ms : 0;
}

function timeTotal(node, now = Date.now()) {
  const logged = (node.logs ?? []).reduce((total, entry) => total + timeEntryDuration(entry), 0);
  return logged + (node.startedAt ? timeOverlap(node.startedAt, now) : 0);
}

function earnedCents(node, now = Date.now()) {
  if (!(node.hourlyRateCents > 0)) return 0;
  const through = node.startedAt
    ? node.startedAt + Math.floor(Math.max(0, now - node.startedAt) / 60000) * 60000
    : now;
  return Math.round(node.hourlyRateCents * timeTotal(node, through) / 3600000);
}

function signedMoney(cents) {
  return `${cents > 0 ? "+" : ""}${USD.format(cents / 100)}`;
}

function eventIncomeCents(node, now) {
  return earnedCents(node, now) + completionValue(node, "gainCents");
}

function completionValue(node, key) {
  if (!node[key]) return 0;
  const completed = (node.completions ?? []).filter((entry) => entry.complete);
  if (!completed.length) return !dateRange && node.complete ? node[key] : 0;
  const awards = node.recurring ? completed : completed.slice(0, 1);
  const count = dateRange ? awards.filter(({ at }) => at >= dateRange.start && at < dateRange.end).length : awards.length;
  return node[key] * count;
}

function eventNetCents(node, now) {
  return eventIncomeCents(node, now) - completionValue(node, "costCents");
}

function updateMapSummary(now = Date.now()) {
  const net = graph.nodes.reduce((sum, node) => sum + eventNetCents(node, now), 0);
  const display = net ? signedMoney(net) : "$0";
  if (gainsTotal.textContent !== display) {
    gainsTotal.textContent = display;
    gainsTotal.classList.toggle("money-positive", net > 0);
    gainsTotal.classList.toggle("money-negative", net < 0);
  }
  const current = readOnlyTree() || workspace.view !== "tree" ? null : activeTimer() ?? getNode(graph.current);
  const label = current?.title ?? "";
  currentEventId = current?.id ?? null;
  if (currentEventName.textContent !== label) {
    currentEventName.textContent = label;
    currentEventLabel.title = label ? `Current event: ${label}` : "";
  }
  currentEventLabel.hidden = !current;
}
currentEventLabel.addEventListener("click", () => {
  if (currentEventId != null) choose(currentEventId);
});

function writeEarnings(node, amount, now) {
  const cents = eventIncomeCents(node, now);
  const display = signedMoney(cents);
  if (amount.textContent === display) return;
  amount.textContent = display;
  amount.classList.toggle("money-positive", cents > 0);
  amount.title = `Earned ${display}`;
}

function netAmount(cents) {
  const amount = element("strong", "money-amount", signedMoney(cents));
  amount.classList.toggle("money-positive", cents > 0);
  amount.classList.toggle("money-negative", cents < 0);
  return amount;
}

function renderFinancialDetails(section, now = Date.now()) {
  const entries = graph.nodes.map((node) => ({
    node,
    net: eventNetCents(node, now)
  })).filter(({ net }) => net !== 0);
  const total = entries.reduce((sum, { net }) => sum + net, 0);
  const summary = element("div", "finance-total");
  summary.append(element("span", "", "Net total"), netAmount(total));
  const list = element("div", "finance-list");
  for (const { node, net } of entries) {
    const row = element("div", "finance-row");
    row.append(button(node.title, "text-button", () => choose(node.id)), netAmount(net));
    list.append(row);
  }
  if (!entries.length) list.append(element("p", "", "No events with a net gain or loss yet."));
  section.dataset.liveEarnings = liveEarningsKey(now);
  section.replaceChildren(summary, list);
}

function updateCardEarnings(node, now) {
  const amount = cards.get(node.id)?.querySelector(".node-earnings");
  if (amount) writeEarnings(node, amount, now);
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((unit) => String(unit).padStart(2, "0")).join(":");
}

function stopTimer(node, now = Date.now()) {
  if (!node.startedAt) return;
  const ms = Math.max(0, now - node.startedAt);
  if (ms) (node.logs ??= []).push({ at: node.startedAt, ms, note: "", timed: true });
  delete node.startedAt;
}

function restoreRunningTimer() {
  const running = graph.nodes.filter((node) => node.startedAt);
  if (!running.length) return;
  const newest = running.reduce((latest, node) => {
    if (node.complete) return latest;
    return !latest || node.startedAt > latest.startedAt ? node : latest;
  }, null);
  const current = newest?.id ?? graph.current;
  if (running.length === 1 && newest && current === graph.current) return;
  const now = Date.now();
  for (const node of running) {
    if (node !== newest) stopTimer(node, now);
  }
  graph.current = current;
  save();
}

function toggleTimer(node) {
  if (node.complete || (!node.startedAt && taskBlocker(node))) return;
  const now = Date.now();
  if (node.startedAt) stopTimer(node, now);
  else {
    for (const { tree } of workspace.graphs) {
      for (const running of tree.nodes) stopTimer(running, now);
    }
    node.startedAt = now;
    graph.current = node.id;
  }
  changed();
  refreshGraph();
  renderDrawer();
  draw();
  drawer.querySelector(".timer-toggle")?.focus({ preventScroll: true });
}

function syncTimerTicker() {
  if (activeTimer()) {
    if (timerTicker === undefined) timerTicker = setInterval(updateTimerDisplay, 250);
  } else if (timerTicker !== undefined) {
    clearInterval(timerTicker);
    timerTicker = undefined;
  }
}

function liveEarningsKey(now) {
  return graph.nodes.filter((node) => node.startedAt).map((node) => earnedCents(node, now)).join(",");
}

function updateTimerDisplay() {
  const node = activeTimer();
  if (!node) return;
  const now = Date.now();
  updateMapSummary(now);
  if (readOnlyTree()) {
    for (const running of graph.nodes) {
      if (running.startedAt) updateCardEarnings(running, now);
    }
  } else updateCardEarnings(node, now);
  const finance = drawerMode === "details" ? drawer.querySelector(".finance-details") : null;
  if (finance && finance.dataset.liveEarnings !== liveEarningsKey(now)) renderFinancialDetails(finance, now);
  const focused = readOnlyTree() ? getNode(selected) : node;
  if (!focused?.startedAt || selected !== focused.id) return;
  const clock = drawer.querySelector(".timer-clock");
  const display = formatTime(timeTotal(focused, now));
  if (clock && clock.textContent !== display) clock.textContent = display;
}

function editLog(node, entry) {
  const duration = element("input");
  duration.placeholder = "00:25:00";
  duration.inputMode = "text";
  duration.value = entry ? formatTime(entry.ms) : "";
  duration.required = true;
  duration.addEventListener("input", () => duration.setCustomValidity(""));
  const note = element("input");
  note.maxLength = 160;
  note.value = entry?.note ?? "";
  const date = datedInput(entry?.at ?? Date.now());
  openEditor({
    heading: "TIME LOG", variant: "time-log",
    title: entry ? "Edit entry" : "Log time",
    content: [labelField("Date and time", date), labelField("Duration (hours:minutes:seconds)", duration), labelField("Note", note)],
    action: () => {
      const match = duration.value.trim().match(/^(\d{1,6}):([0-5]?\d):([0-5]?\d)$/);
      const ms = entry && duration.value === formatTime(entry.ms) ? entry.ms :
        match ? (+match[1] * 3600 + +match[2] * 60 + +match[3]) * 1000 : 0;
      if (!ms) {
        duration.setCustomValidity("Enter a positive duration, such as 00:25:00.");
        duration.reportValidity();
        return false;
      }
      const at = editedTimestamp(date, entry?.at);
      if (at === null) return false;
      if (entry) Object.assign(entry, { at, ms, note: note.value.trim() });
      else (node.logs ??= []).push({ at, ms, note: note.value.trim() });
      changed();
      updateCardEarnings(node);
      updateMapSummary();
      renderDrawer();
    }
  });
}

function renderRangedTimeLog(node) {
  const logs = (node.logs ?? []).filter((entry) => timeEntryDuration(entry) > 0).sort((a, b) => b.at - a.at);
  if (!logs.length) return;
  const section = element("section", "drawer-section");
  section.append(element("h3", "", "Time log in range"));
  for (const entry of logs) {
    const row = element("div", "log-row");
    const details = element("div");
    details.append(element("strong", "", formatTime(timeEntryDuration(entry))),
      element("small", "", logDateLabel.format(entry.at)));
    if (entry.note) details.append(element("small", "", entry.note));
    row.append(details);
    section.append(row);
  }
  drawer.append(section);
}

function renderTime(node, blocker) {
  const section = element("section", "drawer-section");
  section.append(element("h3", "", "Time tracked"));
  const controls = element("div", "timer-controls");
  const clock = element("output", "timer-clock", formatTime(timeTotal(node)));
  clock.setAttribute("aria-live", "off");
  controls.append(clock);
  if (!node.complete) {
    const timer = button(node.startedAt ? "Ⅱ Pause" : "▶ Play", "button quiet timer-toggle", () => toggleTimer(node));
    timer.disabled = !!blocker;
    controls.append(timer);
  }
  controls.append(button("＋ Log time", "button quiet", () => editLog(node)));
  section.append(controls);
  if (node.hourlyRateCents > 0) section.append(element("p", "money-detail", `Hourly rate ${USD.format(node.hourlyRateCents / 100)}`));
  if (node.costCents > 0) section.append(element("p", "money-detail", `Cost ${USD.format(node.costCents / 100)}`));
  if (node.gainCents > 0) section.append(element("p", "money-detail", `Gain on completion ${USD.format(node.gainCents / 100)}`));
  if (node.startedAt) section.append(element("div", "timer-running", "Timer running"));
  const logs = node.logs ?? [];
  for (const entry of [...logs].sort((a, b) => b.at - a.at)) {
    const row = element("div", "log-row");
    const details = element("div");
    details.append(element("strong", "", formatTime(entry.ms)));
    const date = logDateLabel.format(entry.at);
    details.append(element("small", "", date));
    if (entry.note) details.append(element("small", "", entry.note));
    const edit = button("Edit", "text-button", () => editLog(node, entry));
    const remove = button("×", "close", () => {
      node.logs = logs.filter((item) => item !== entry);
      changed();
      updateCardEarnings(node);
      updateMapSummary();
      renderDrawer();
    });
    remove.setAttribute("aria-label", `Remove time entry for ${date}`);
    row.append(details, edit, remove);
    section.append(row);
  }
  drawer.append(section);
}

function datedInput(at) {
  const field = element("input");
  field.type = "datetime-local";
  field.required = true;
  field.value = dateTimeValue(at);
  field.addEventListener("input", () => field.setCustomValidity(""));
  return field;
}

function editedTimestamp(field, previous) {
  if (previous !== undefined && field.value === dateTimeValue(previous)) return previous;
  const at = +new Date(field.value);
  if (validTimestamp(at) && field.value && dateTimeValue(at) === field.value) return at;
  field.setCustomValidity("Enter a valid date and time.");
  field.reportValidity();
  return null;
}

function editCompletionDate(node, entry) {
  const date = datedInput(entry?.at ?? Date.now());
  openEditor({
    heading: "COMPLETION HISTORY",
    title: entry ? "Edit status date" : "Set completion date",
    content: [labelField("Date and time", date)],
    action: () => {
      const at = editedTimestamp(date, entry?.at);
      if (at === null) return false;
      const history = node.completions ?? [];
      if (at > Date.now() || (node.createdAt !== undefined && eventDate(at) < eventDate(node.createdAt))) {
        date.setCustomValidity("Choose a date from the event date through today.");
      } else if (entry) {
        const index = history.indexOf(entry);
        if ((index > 0 && at < history[index - 1].at) ||
            (index + 1 < history.length && at > history[index + 1].at)) {
          date.setCustomValidity("Keep this change between the previous and next status changes.");
        }
      }
      if (!date.reportValidity()) return false;
      if (entry) entry.at = at;
      else (node.completions ??= []).push({ at, complete: true });
      save();
      refresh();
    }
  });
}

function renderCompletionHistory(node) {
  const section = element("section", "drawer-section completion-history");
  section.append(element("h3", "", "Completion history"));
  const entries = (node.completions ?? []).filter(({ at }) => !dateRange || at < dateRange.end);
  if (!entries.length) {
    const unknown = node.undatedCompletion || (node.complete && !node.completions?.length);
    section.append(element("p", "money-detail", unknown ? "Completion date unknown" : "No status changes recorded."));
    if (unknown && !readOnlyTree()) section.append(button("Set completion date", "text-button", () => editCompletionDate(node)));
  }
  for (const entry of [...entries].reverse()) {
    const row = element("div", "log-row");
    const details = element("div");
    details.append(element("strong", "", entry.complete ? "Completed" : "Reopened"),
      element("small", "", logDateLabel.format(entry.at)));
    row.append(details);
    if (!readOnlyTree()) row.append(button("Edit date", "text-button", () => editCompletionDate(node, entry)));
    section.append(row);
  }
  drawer.append(section);
}

function openForm(node, from = selected ?? ROOT) {
  editing = node;
  form.reset();
  fields.title.setCustomValidity("");
  fields.title.value = node?.title ?? "";
  fields.description.value = node?.description ?? "";
  fields.eventDate.setCustomValidity("");
  fields.eventDate.required = node?.id !== ROOT;
  fields.eventDate.value = node?.createdAt !== undefined ? eventDate(node.createdAt) : node ? "" : eventDate(Date.now());
  $("#event-date-field").hidden = node?.id === ROOT;
  fields.recurring.checked = !!node?.recurring;
  $("#recurring-field").hidden = node?.id === ROOT;
  $("#task-money-fields").hidden = node?.id === ROOT;
  for (const [name, key] of Object.entries(MONEY_FIELDS)) {
    const field = fields[name];
    const cents = node?.[key];
    field.setCustomValidity("");
    field.value = cents === undefined ? "" : (cents / 100).toFixed(2);
  }
  const sources = [anchor, ...graph.nodes];
  fields.source.replaceChildren(new Option("No connection · outer ring", ""), ...sources.map((item) =>
    new Option(item.complete ? `${item.title} (completed)` : item.title, item.id)
  ));
  fields.source.value = sources.some((item) => item.id === from) ? from : ROOT;
  $("#connection-fields").hidden = !!node;
  $("#dialog-title").textContent = node ? "Edit event" : "New event";
  $("#submit-button").textContent = node ? "Save changes" : "Add event";
  dialog.showModal();
  fields.title.focus();
}

for (const field of [fields.title, fields.eventDate, ...Object.keys(MONEY_FIELDS).map((name) => fields[name])]) {
  field.addEventListener("input", () => field.setCustomValidity(""));
}

function parseCents(field) {
  const value = field.value.trim();
  if (!value) return undefined;
  const parts = value.match(/^(\d*)(?:\.(\d{1,2}))?$/);
  if (!parts) return NaN;
  const cents = Number(parts[1]) * 100 + Number((parts[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : NaN;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!fields.title.value.trim()) {
    fields.title.setCustomValidity("Enter a title.");
    fields.title.reportValidity();
    return;
  }
  const values = { title: fields.title.value.trim(), description: fields.description.value.trim() };
  if (editing?.id !== ROOT) {
    const date = fields.eventDate.value;
    const at = localDate(date);
    if (!Number.isFinite(at) || date < EVENT_START_DATE ||
        (editing?.completions ?? []).some((entry) => eventDate(entry.at) < date)) {
      fields.eventDate.setCustomValidity("Choose a date from November 1, 2026 through the first recorded status change.");
      fields.eventDate.reportValidity();
      return;
    }
    values.createdAt = editing?.createdAt !== undefined && date === eventDate(editing.createdAt) ? editing.createdAt : at;
    values.recurring = fields.recurring.checked || undefined;
    for (const [name, key] of Object.entries(MONEY_FIELDS)) {
      const field = fields[name];
      const cents = parseCents(field);
      if (Number.isNaN(cents)) {
        field.setCustomValidity("Enter a dollar amount with up to two decimal places.");
        field.reportValidity();
        return;
      }
      values[key] = cents;
    }
  }
  let node = editing;
  if (node) Object.assign(node, values);
  else {
    node = { id: crypto.randomUUID?.() ?? `node-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...values };
    graph.nodes.push(node);
    if (fields.source.value) graph.edges.push([fields.source.value, node.id]);
    layout();
  }
  if (node.id === ROOT) graph.anchor = { ...values };
  changed();
  dialog.close();
  if (node.complete) refresh();
  else choose(node.id);
});

function snapshotGraph(map, now) {
  const state = JSON.parse(JSON.stringify(map));
  for (const node of state.nodes) stopTimer(node, now);
  return state;
}

function backup(now = Date.now()) {
  return {
    format: BACKUP_FORMAT, version: 6, savedAt: new Date(now).toISOString(),
    workspace: { ...workspace, graphs: workspace.graphs.map((item) => ({ ...item, tree: snapshotGraph(item.tree, now) })) }
  };
}

function readGraphBackup(state, legacy = false) {
  if (!Array.isArray(state?.nodes) || !Array.isArray(state?.edges)) {
    throw new Error("This backup contains invalid map data.");
  }
  function invalid() { throw new Error("This backup contains invalid map data."); }
  const ids = new Set([ROOT]);
  const taskText = (node) => {
    if (typeof node?.title !== "string" || !node.title.trim() || node.title.length > 80 ||
        typeof node.description !== "string") invalid();
    if (legacy && node.tag !== undefined && (typeof node.tag !== "string" || node.tag.length > 28)) invalid();
    const { title, description } = node;
    return legacy ? { title, description, tag: node.tag } : { title, description };
  };
  const nodes = state.nodes.map((node) => {
    const values = taskText(node);
    if (typeof node.id !== "string" || !node.id || ids.has(node.id)) invalid();
    ids.add(node.id);
    if (node.angle !== undefined && !Number.isFinite(node.angle)) invalid();
    if (node.complete !== undefined && typeof node.complete !== "boolean") invalid();
    if (node.collapsed !== undefined && typeof node.collapsed !== "boolean") invalid();
    if (node.recurring !== undefined && typeof node.recurring !== "boolean") invalid();
    if (node.completionCount !== undefined && (!Number.isSafeInteger(node.completionCount) || node.completionCount < 0)) invalid();
    if (node.mapVisibility !== undefined && !["hidden", "visible"].includes(node.mapVisibility)) invalid();
    const money = {};
    for (const key of Object.values(MONEY_FIELDS)) {
      const cents = node[key];
      if (cents !== undefined && (!Number.isSafeInteger(cents) || cents < 0)) invalid();
      money[key] = cents;
    }
    if (node.createdAt !== undefined && !validTimestamp(node.createdAt)) invalid();
    if (node.completions !== undefined && !Array.isArray(node.completions)) invalid();
    let previous = -Infinity;
    const completions = node.completions?.map((entry) => {
      if (!validTimestamp(entry?.at) || entry.at < previous || typeof entry.complete !== "boolean") invalid();
      previous = entry.at;
      return { at: entry.at, complete: entry.complete };
    });
    if (node.logs !== undefined && !Array.isArray(node.logs)) invalid();
    const logs = (node.logs ?? []).map((entry) => {
      if (!validTimestamp(entry?.at) || (entry.timed !== undefined && typeof entry.timed !== "boolean") ||
        !Number.isSafeInteger(entry.ms) || entry.ms <= 0 || typeof entry.note !== "string" || entry.note.length > 160) invalid();
      return { at: entry.at, ms: entry.ms, note: entry.note, timed: entry.timed || undefined };
    });
    return {
      id: node.id, ...values, angle: node.angle === undefined ? undefined : node.angle % TAU,
      complete: !!node.complete, collapsed: node.collapsed || undefined, mapVisibility: node.mapVisibility,
      recurring: node.recurring || undefined, completionCount: node.completionCount, ...money, logs,
      createdAt: node.createdAt, completions
    };
  });
  const links = new Set();
  const edges = state.edges.map((edge) => {
    if (!Array.isArray(edge)) invalid();
    const [from, to, options] = edge;
    const key = JSON.stringify([from, to]);
    if (!ids.has(from) || !ids.has(to) || from === to || links.has(key)) invalid();
    links.add(key);
    if (options === undefined) return [from, to];
    if (!options || typeof options !== "object" ||
      (options.label !== undefined && (typeof options.label !== "string" || options.label.length > 48)) ||
      (options.bend !== undefined && (!Number.isFinite(options.bend) || Math.abs(options.bend) > .85))) invalid();
    return [from, to, { label: options.label, bend: options.bend }];
  });
  if (state.hideCompleted !== undefined && typeof state.hideCompleted !== "boolean") invalid();
  const current = nodes.some((node) => node.id === state.current && !node.complete) ? state.current : null;
  const savedAnchor = state.anchor === undefined ? undefined : taskText(state.anchor);
  const tree = { nodes, edges, current, anchor: savedAnchor, hideCompleted: state.hideCompleted || undefined };
  return legacy ? { ...tree, tagNames: state.tagNames } : tree;
}

function readBackup(text) {
  const { format, version, graph: savedGraph, workspace: savedWorkspace } = JSON.parse(text) ?? {};
  if (format === BACKUP_FORMAT && version === 1) return initializeEventDates(migrateTree(readGraphBackup(savedGraph, true)));
  if (format === BACKUP_FORMAT && version === 2 && Array.isArray(savedWorkspace?.maps)) {
    return migrateWorkspace(savedWorkspace, (tree) => readGraphBackup(tree, true));
  }
  if (format === BACKUP_FORMAT && [3, 4, 5, 6].includes(version)) return normalizeWorkspace(savedWorkspace, readGraphBackup);
  throw new Error("Choose an ArcheIncognita JSON backup.");
}

let saveHandle = null;

async function exportMap({ quick = false } = {}) {
  const snapshot = backup();
  const name = `archeincognita-${snapshot.savedAt.slice(0, 10)}.json`;
  const contents = JSON.stringify(snapshot, null, 2) + "\n";
  const native = window.webkit?.messageHandlers?.archeBackup;
  if (native) {
    try {
      const saved = await native.postMessage({ action: quick ? "quicksave" : "save", name, contents });
      if (saved) toast(typeof saved === "string" ? `Saved to ${saved}.` : "Backup saved.");
    } catch {
      toast("Could not save the backup.");
    }
    return;
  }
  if (window.showSaveFilePicker) {
    try {
      if (!quick || !saveHandle) {
        saveHandle = await window.showSaveFilePicker({
          suggestedName: saveHandle?.name ?? name,
          types: [{ description: "ArcheIncognita backup", accept: { "application/json": [".json"] } }]
        });
      }
      const writable = await saveHandle.createWritable();
      await writable.write(contents);
      await writable.close();
      toast(`Saved to ${saveHandle.name}.`);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      saveHandle = null;
    }
  }
  if (quick) toast("This browser can’t overwrite files, so a new copy was downloaded.");
  const file = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const download = element("a");
  download.href = url;
  download.download = name;
  document.body.append(download);
  download.click();
  download.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resetMapView() {
  dateRange = graphRanges.get(workspace.activeGraphId) ?? null;
  graph = displayedGraph();
  anchor = mapAnchor();
  selected = null;
  selectedEdge = null;
  draftBend = null;
  drawerMode = null;
  connectionSource = null;
  gesture = null;
  pinch = null;
  viewport.classList.remove("grabbing");
  updateConnectionPreview();
  following = null;
  fitted = true;
  updateView();
  refresh();
}

function applyBackup(state) {
  graphRanges.clear();
  if (state.graphs) workspace = state;
  else {
    const month = activeMonth() ?? workspace.graphs[0];
    month.tree = state;
    workspace.activeGraphId = month.id;
  }
  resetMapView();
  save();
}

function graphNameEditor(action) {
  const current = activeMonth();
  const rename = action === "__rename__";
  const duplicate = action === "__duplicate__";
  if ((rename || duplicate) && !current) return;
  const input = element("input");
  input.required = true;
  input.maxLength = 60;
  input.placeholder = initialMonth;
  input.value = rename ? current.name : duplicate ? `${current.name.slice(0, 53)} copy` : "";
  input.addEventListener("input", () => input.setCustomValidity(""));
  const title = rename ? "Rename graph" : duplicate ? "Duplicate current graph" : "New graph from scratch";
  openEditor({
    heading: "Actions", title,
    content: [labelField("Graph name", input), ...(duplicate ? [
      element("p", "", "Copies events, connections, dates, and values into an independent graph.")
    ] : [])],
    submit: rename ? "Rename" : duplicate ? "Duplicate" : "Create graph",
    action: () => {
      const name = input.value.trim();
      const taken = workspace.graphs.some((month) =>
        (!rename || month !== current) && month.name.toLowerCase() === name.toLowerCase());
      if (!name || taken) {
        input.setCustomValidity(taken ? "That name is already in use." : "Enter a graph name.");
        input.reportValidity();
        return false;
      }
      if (rename) {
        current.name = name;
        updateGraphPicker();
      } else {
        const id = crypto.randomUUID?.() ?? `graph-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const tree = duplicate ? snapshotGraph(current.tree, Date.now()) : { nodes: [], edges: [] };
        workspace.graphs.push({ id, name, tree });
        workspace.activeGraphId = id;
        workspace.view = "tree";
        resetMapView();
      }
      save();
    }
  });
  input.focus();
  input.select();
}

function requestGraphDelete() {
  const current = activeMonth();
  if (!current || workspace.graphs.length < 2) return;
  const count = current.tree.nodes?.length ?? 0;
  openEditor({
    heading: "Actions",
    title: "Delete current graph?",
    content: [element("p", "", `“${current.name}” will be removed with everything in it: ${count === 1 ? "1 event" : `${count} events`}, their connections, and time logs. Minor tasks, TAP cards, and your other graphs stay. Use Save first if you want a backup.`)],
    submit: "Delete graph",
    action: () => {
      const index = workspace.graphs.indexOf(current);
      workspace.graphs.splice(index, 1);
      graphRanges.delete(current.id);
      workspace.activeGraphId = workspace.graphs[Math.max(0, index - 1)].id;
      workspace.view = "tree";
      resetMapView();
      save();
      toast(`Deleted “${current.name}”.`);
    }
  });
}

function openCollectionEditor(view, entry) {
  const { key, name, add } = VIEWS[view];
  const minor = view === "minor";
  const title = element("input");
  title.required = true;
  title.maxLength = 80;
  title.value = entry?.title ?? "";
  title.addEventListener("input", () => title.setCustomValidity(""));
  const description = element("textarea");
  description.rows = 5;
  description.required = !minor;
  description.value = entry?.description ?? "";
  description.addEventListener("input", () => description.setCustomValidity(""));
  openEditor({
    heading: name, title: entry ? (minor ? "Edit task" : "Edit TAP") : add,
    content: [labelField(minor ? "Task" : "Trigger or goal", title),
      labelField(minor ? "Notes (optional)" : "What to do", description)],
    submit: entry ? "Save changes" : add,
    action: () => {
      const values = { title: title.value.trim(), description: description.value.trim() };
      const empty = !values.title ? title : !minor && !values.description ? description : null;
      if (empty) {
        empty.setCustomValidity(empty === title ? "Enter a title." : "Enter what to do.");
        empty.reportValidity();
        return false;
      }
      if (entry) Object.assign(entry, values);
      else {
        const id = crypto.randomUUID?.() ?? `card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        workspace[key].push({ id, ...values, ...(minor ? { complete: false } : {}) });
      }
      save();
      renderCollection();
    }
  });
  title.focus();
}

function deleteCollectionEntry(view, entry) {
  const { key, name } = VIEWS[view];
  openEditor({
    heading: name, title: view === "minor" ? "Delete task?" : "Delete TAP?",
    content: [element("p", "", `Delete “${entry.title}”?`)], submit: "Delete",
    action: () => {
      workspace[key] = workspace[key].filter((item) => item !== entry);
      save();
      renderCollection();
    }
  });
}

function positionCollectionCard(card, placement) {
  card.classList.toggle("positioned", !!placement);
  if (!placement) return;
  card.style.setProperty("--card-x", `${placement.x * 100}%`);
  card.style.setProperty("--card-y", `${placement.y}px`);
}

function collectionDragHandle(card, grid, entry) {
  const handle = button("⠿", "collection-drag");
  handle.title = "Drag to move, or use the arrow keys";
  handle.setAttribute("aria-label", `Move ${entry.title}`);
  let drag;
  const positionAt = (left, top) => {
    const bounds = grid.getBoundingClientRect();
    const travel = Math.max(1, bounds.width - card.offsetWidth);
    return {
      x: Math.max(0, Math.min(1, (left - bounds.left) / travel)),
      y: Math.max(0, Math.min(1_000_000, top - bounds.top))
    };
  };
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || drag) return;
    const bounds = card.getBoundingClientRect();
    drag = { pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
      grabX: event.clientX - bounds.left, grabY: event.clientY - bounds.top };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointermove", (event) => {
    if (event.pointerId !== drag?.pointer) return;
    if (!drag.placement && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 4) return;
    drag.placement = positionAt(event.clientX - drag.grabX, event.clientY - drag.grabY);
    card.classList.add("dragging");
    positionCollectionCard(card, drag.placement);
  });
  const finish = (event) => {
    if (event.pointerId !== drag?.pointer) return;
    if (event.type === "pointerup" && drag.placement) {
      entry.placement = positionAt(event.clientX - drag.grabX, event.clientY - drag.grabY);
      save();
    }
    positionCollectionCard(card, entry.placement);
    card.classList.remove("dragging");
    drag = null;
  };
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) handle.addEventListener(type, finish);
  const directions = new Map([["ArrowLeft", [-1, 0]], ["ArrowRight", [1, 0]], ["ArrowUp", [0, -1]], ["ArrowDown", [0, 1]]]);
  handle.addEventListener("keydown", (event) => {
    if (drag) return;
    const shift = directions.get(event.key);
    if (!shift) return;
    event.preventDefault();
    const bounds = card.getBoundingClientRect();
    const step = event.shiftKey ? 40 : 10;
    entry.placement = positionAt(bounds.left + shift[0] * step, bounds.top + shift[1] * step);
    positionCollectionCard(card, entry.placement);
    save();
  });
  return handle;
}

function renderCollection() {
  const view = workspace.view;
  const { name, key } = VIEWS[view];
  collection.replaceChildren();
  if (!key) return;
  collection.setAttribute("aria-label", name);
  const entries = workspace[key];
  if (!entries.length) {
    collection.append(element("p", "collection-empty", view === "minor"
      ? "Add a task you want to remember." : "Add a trigger or goal and what to do when it comes up."));
    return;
  }
  const grid = element("div", "collection-grid");
  for (const entry of entries) {
    const card = element("article", "collection-card");
    const actions = element("div", "collection-actions");
    actions.append(iconButton("edit", `Edit ${entry.title}`, () => openCollectionEditor(view, entry)),
      iconButton("delete", `Delete ${entry.title}`, () => deleteCollectionEntry(view, entry), "quiet danger"));
    if (view === "minor") {
      const head = element("div", "collection-card-head");
      const check = iconButton("complete", "", () => {
        entry.complete = !entry.complete;
        updateCompletion();
        save();
      }, "quiet success");
      function updateCompletion() {
        const label = `${entry.complete ? "Reopen" : "Complete"} ${entry.title}`;
        check.setAttribute("aria-label", label);
        check.setAttribute("aria-pressed", entry.complete);
        check.title = label;
        card.classList.toggle("completed", entry.complete);
      }
      updateCompletion();
      head.append(element("h2", "", entry.title), check);
      card.append(head);
      if (entry.description) card.append(element("p", "", entry.description));
      card.append(actions);
    } else {
      const details = element("details");
      details.append(element("summary", "", entry.title), element("p", "", entry.description), actions);
      card.append(details);
    }
    card.append(collectionDragHandle(card, grid, entry));
    positionCollectionCard(card, entry.placement);
    grid.append(card);
  }
  collection.append(grid);
}

function updateGraphPicker() {
  const actions = element("optgroup");
  actions.label = "Actions";
  actions.append(new Option("Rename current", MAP_ACTIONS[0]),
    new Option("New from scratch", MAP_ACTIONS[1]), new Option("Duplicate current", MAP_ACTIONS[2]));
  const remove = new Option("Delete current", MAP_ACTIONS[3]);
  remove.disabled = workspace.graphs.length < 2;
  if (remove.disabled) remove.title = "The last graph can’t be deleted.";
  actions.append(remove);
  mapPicker.replaceChildren(...workspace.graphs.map(({ id, name }) => new Option(name, id)), actions);
  mapPicker.value = workspace.activeGraphId;
}

function addDays(date, days) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function openDateFilter() {
  const today = new Date();
  const from = element("input");
  const to = element("input");
  from.type = to.type = "date";
  from.max = to.max = "9999-12-31";
  from.min = to.min = "0001-01-01";
  from.value = dateRange?.from ?? "";
  to.value = dateRange?.to ?? "";
  const fields = element("div", "date-filter-fields");
  fields.append(labelField("Start date", from), labelField("End date", to));
  const presets = element("div", "date-presets");
  const monthTitle = element("strong");
  const grid = element("div", "date-grid");
  const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
  const calendar = element("div", "date-calendar");
  const navigation = element("div", "date-navigation");
  let month = new Date(localDate(to.value || from.value || eventDate(today)));
  month.setDate(1);
  let pickingEnd = false;
  let calendarFocus;
  const shiftMonth = (amount) => {
    month.setMonth(month.getMonth() + amount);
    drawCalendar();
  };
  const prev = button("‹", "button quiet", () => shiftMonth(-1));
  const next = button("›", "button quiet", () => shiftMonth(1));
  prev.setAttribute("aria-label", "Previous month");
  next.setAttribute("aria-label", "Next month");
  navigation.append(prev, monthTitle, next);
  calendar.append(navigation, grid);

  function drawCalendar() {
    monthTitle.textContent = monthFormat.format(month);
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => element("span", "weekday", name));
    const leading = (month.getDay() + 6) % 7;
    const first = addDays(month, -leading);
      let focusButton;
    for (let index = 0; index < 42; index++) {
      const date = addDays(first, index);
      const value = eventDate(date);
      const chosen = value === from.value || value === to.value;
      const day = button(String(date.getDate()), "date-day", () => {
        if (!pickingEnd) {
          from.value = value;
          to.value = value;
        } else {
          to.value = value < from.value ? from.value : value;
          if (value < from.value) from.value = value;
        }
        pickingEnd = !pickingEnd;
        from.setCustomValidity("");
        to.setCustomValidity("");
        if (date.getMonth() !== month.getMonth()) {
          month = date;
          month.setDate(1);
        }
        calendarFocus = value;
        drawCalendar();
      });
      day.setAttribute("aria-label", dateLabel.format(date));
      day.setAttribute("aria-pressed", chosen);
      day.classList.toggle("inside-range", !!from.value && !!to.value && value > from.value && value < to.value);
      day.classList.toggle("outside-month", date.getMonth() !== month.getMonth());
      day.classList.toggle("today", value === eventDate(today));
      if (value === calendarFocus) focusButton = day;
      days.push(day);
    }
    grid.replaceChildren(...days);
    if (calendarFocus) focusButton?.focus();
    calendarFocus = undefined;
  }

  const setDates = (start, end) => {
    from.value = start ? eventDate(start) : "";
    to.value = end ? eventDate(end) : "";
    from.setCustomValidity("");
    to.setCustomValidity("");
    pickingEnd = false;
    month = new Date(end ?? today);
    month.setDate(1);
    drawCalendar();
  };
  for (const [label, dates] of [
    ["All dates", [null, null]],
    ["Today", [today, today]],
    ["Last 7 days", [addDays(today, -6), today]],
    ["This month", [new Date(today.getFullYear(), today.getMonth(), 1), today]]
  ]) presets.append(button(label, "button quiet", () => setDates(...dates)));
  for (const field of [from, to]) {
    field.addEventListener("input", () => {
      from.setCustomValidity("");
      to.setCustomValidity("");
      pickingEnd = false;
      const at = localDate(field.value);
      if (Number.isFinite(at)) {
        month = new Date(at);
        month.setDate(1);
      }
      drawCalendar();
    });
  }
  drawCalendar();
  openEditor({
    heading: activeMonth().name, title: "Date range", content: [presets, fields, calendar],
    submit: "Apply range",
    action: () => {
      if (!from.value && !to.value) {
        graphRanges.delete(workspace.activeGraphId);
      } else {
        const start = localDate(from.value);
        const last = localDate(to.value);
        if (!Number.isFinite(start) || !Number.isFinite(last) || last < start) {
          to.setCustomValidity("Choose both dates, with the end on or after the start.");
          to.reportValidity();
          return false;
        }
        graphRanges.set(workspace.activeGraphId, { from: from.value, to: to.value, start, end: +addDays(last, 1) });
      }
      resetMapView();
    }
  });
}

$("#date-filter").addEventListener("click", openDateFilter);

function updateView() {
  const view = workspace.view;
  const tree = view === "tree";
  updateGraphPicker();
  $("#map").dataset.view = view;
  newButtonLabel.textContent = VIEWS[view].add;
  newButton.hidden = tree && readOnlyTree();
  $("#details-button").hidden = !tree && !mobileLayout.matches;
  mobileZoom.hidden = !tree;
  $("#fit").hidden = completedToggle.hidden = !tree;
  $("#map-controls").hidden = !tree;
  $("#gains-summary").hidden = !tree;
  $("#date-filter").hidden = !tree;
  $("#date-filter").classList.toggle("active", !!dateRange);
  $("#date-filter-label").textContent = dateRange
    ? dateLabel.formatRange(dateRange.start, localDate(dateRange.to)) : "All dates";
  $("#minor-view").setAttribute("aria-pressed", view === "minor");
  $("#tap-view").setAttribute("aria-pressed", view === "tap");
  collection.hidden = tree;
  renderCollection();
  updateMapSummary();
}

mapPicker.addEventListener("change", () => {
  const id = mapPicker.value;
  if (MAP_ACTIONS.includes(id)) {
    mapPicker.value = workspace.activeGraphId;
    if (id === "__delete__") requestGraphDelete();
    else graphNameEditor(id);
    return;
  }
  if (!workspace.graphs.some((month) => month.id === id)) return;
  workspace.activeGraphId = id;
  workspace.view = "tree";
  resetMapView();
  save();
});
for (const view of ["minor", "tap"]) {
  $(`#${view}-view`).addEventListener("click", () => {
    workspace.view = workspace.view === view ? "tree" : view;
    resetMapView();
    save();
  });
}

$("#export-map").addEventListener("click", () => exportMap());
window.archeSave = (quick) => exportMap({ quick });
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "s" || !(event.metaKey || event.ctrlKey) || event.altKey) return;
  // The Mac app handles ⌘S through its File menu.
  if (window.webkit?.messageHandlers?.archeBackup) return;
  event.preventDefault();
  exportMap({ quick: !event.shiftKey });
}, { capture: true });
$("#import-map").addEventListener("click", async () => {
  const native = window.webkit?.messageHandlers?.archeBackup;
  if (!native) {
    $("#import-file").click();
    return;
  }
  try {
    const contents = await native.postMessage({ action: "load" });
    if (typeof contents === "string") openBackup(contents);
  } catch {
    toast("Could not open the backup.");
  }
});
$("#import-file").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;
  try {
    openBackup(await file.text());
  } catch {
    toast("Could not open the backup.");
  }
});

function openBackup(contents) {
  let state;
  try {
    state = readBackup(contents);
  } catch (error) {
    toast(error instanceof SyntaxError ? "This file is not a valid ArcheIncognita JSON backup." : error.message);
    return;
  }
  const isWorkspace = !!state.graphs;
  const summary = isWorkspace
    ? "Loading this backup replaces your graphs, minor tasks, and TAP entries."
    : "Loading this backup replaces your selected graph.";
  openEditor({
    heading: "MAP FILES",
    title: "Import this backup?",
    content: [element("p", "", summary), button("Back up my workspace first", "button quiet", exportMap)],
    submit: isWorkspace ? "Replace workspace" : "Replace tree",
    action: () => { applyBackup(state); toast("Backup imported."); }
  });
}

function startGesture(event, mode, id) {
  if (event.button !== 0 || !event.isPrimary || gesture || pinch) return;
  if (mode === "move" && connectionSource) return;
  gesture = { mode, id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY };
}

function queueGesture(event) {
  if (!gesture || event.pointerId !== gesture.pointer) return;
  pendingPointer = event;
  if (gestureFrame !== undefined) return;
  gestureFrame = requestAnimationFrame(() => {
    gestureFrame = undefined;
    const pointer = pendingPointer;
    pendingPointer = undefined;
    if (pointer) moveGesture(pointer);
  });
}

function moveGesture(event) {
  if (!gesture || event.pointerId !== gesture.pointer) return;
  const dx = event.clientX - gesture.startX;
  const dy = event.clientY - gesture.startY;
  if (!gesture.moved) {
    if (Math.hypot(dx, dy) < 5) return;
    beginMotion();
    gesture.moved = true;
    gesture.camera = { ...camera };
    gesture.bounds = viewport.getBoundingClientRect();
    if (event.type !== "pointerup") viewport.setPointerCapture(event.pointerId);
    viewport.classList.toggle("grabbing", gesture.mode !== "connect");
    if (gesture.mode !== "connect") {
      following = null;
      fitted = false;
    }
  }
  const bounds = gesture.bounds;
  gesture.x = event.clientX - bounds.left;
  gesture.y = event.clientY - bounds.top;
  if (gesture.mode === "pan") {
    camera.x = gesture.camera.x + dx / camera.zoom;
    camera.y = gesture.camera.y + dy / camera.zoom;
    draw();
  } else if (gesture.mode === "move") {
    const point = geometry.get(gesture.id);
    const mouse = unproject((gesture.x - center.x) / camera.zoom - camera.x, (gesture.y - center.y) / camera.zoom - camera.y);
    const angle = Math.atan2(mouse.y, mouse.x);
    gesture.angle = angle;
    point.x = Math.cos(angle) * point.radius;
    point.y = Math.sin(angle) * point.radius;
    positionCard(gesture.id);
    for (const edge of incidentViews.get(gesture.id) ?? []) updateEdge(edge);
  } else {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".node")?.dataset.id;
    const nextTarget = target !== gesture.id ? target : null;
    if (nextTarget !== gesture.target) {
      cards.get(gesture.target)?.classList.remove("target");
      gesture.target = nextTarget;
      cards.get(nextTarget)?.classList.add("target");
    }
    updateConnectionPreview();
  }
}

function settleEventPosition(id) {
  const { radius } = geometry.get(id);
  placeOnRing(id, radius, getNode(id).angle);
  positionCard(id);
  for (const edge of incidentViews.get(id) ?? []) updateEdge(edge);
}

function finishGesture(event) {
  if (!gesture || event.pointerId !== gesture.pointer) return;
  cancelAnimationFrame(gestureFrame);
  gestureFrame = undefined;
  if (event.type === "pointerup" && (gesture.moved || pendingPointer)) moveGesture(event);
  pendingPointer = undefined;
  const finished = gesture;
  gesture = null;
  cards.get(finished.target)?.classList.remove("target");
  if (finished.mode === "connect") updateConnectionPreview();
  if (!finished.moved) return;
  viewport.classList.remove("grabbing");
  endMotion();
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 0);
  if (finished.mode === "move") {
    if (event.type === "pointerup") {
      getNode(finished.id).angle = finished.angle;
      save();
    }
    settleEventPosition(finished.id);
    return;
  }
  if (event.type === "pointerup" && finished.mode === "connect" && finished.target) {
    addEdge(finished.id, finished.target);
    return;
  }
  if (finished.mode === "connect") syncCamera();
}

function setZoom(value, x = center.x, y = center.y, defer = false) {
  const zoom = Math.min(MAX_ZOOM, Math.max(.04, value));
  camera.x += (x - center.x) * (1 / zoom - 1 / camera.zoom);
  camera.y += (y - center.y) * (1 / zoom - 1 / camera.zoom);
  camera.zoom = zoom;
  following = null;
  fitted = false;
  if (defer) scheduleCameraDraw();
  else endMotion();
}

function zoomBy(factor, x, y) {
  setZoom(camera.zoom * factor, x, y);
}

function pinchPoints(touches, bounds) {
  const first = touches[0];
  const second = touches[1];
  return {
    x: (first.clientX + second.clientX) / 2 - bounds.left,
    y: (first.clientY + second.clientY) / 2 - bounds.top,
    distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
  };
}

viewport.addEventListener("touchstart", (event) => {
  if (workspace.view !== "tree" || event.touches.length !== 2 || pinch) return;
  const bounds = viewport.getBoundingClientRect();
  const points = pinchPoints(event.touches, bounds);
  if (!points.distance) return;
  event.preventDefault();
  if (gesture) finishGesture({ pointerId: gesture.pointer, type: "pointercancel" });
  beginMotion();
  following = null;
  fitted = false;
  pinch = { bounds, points, camera: { ...camera } };
}, { passive: false });

viewport.addEventListener("touchmove", (event) => {
  if (!pinch || event.touches.length !== 2) return;
  event.preventDefault();
  const next = pinchPoints(event.touches, pinch.bounds);
  const origin = pinch.points;
  const start = pinch.camera;
  const zoom = Math.min(MAX_ZOOM, Math.max(.04, start.zoom * next.distance / origin.distance));
  camera = {
    zoom,
    x: start.x + (next.x - center.x) / zoom - (origin.x - center.x) / start.zoom,
    y: start.y + (next.y - center.y) / zoom - (origin.y - center.y) / start.zoom
  };
  scheduleCameraDraw();
}, { passive: false });

for (const type of ["touchend", "touchcancel"]) {
  viewport.addEventListener(type, (event) => {
    if (!pinch || event.touches.length >= 2) return;
    event.preventDefault();
    pinch = null;
    endMotion();
  }, { passive: false });
}

viewport.addEventListener("pointerdown", (event) => {
  if (workspace.view === "tree" && !event.target.closest(".node, .edge-hit")) startGesture(event, "pan");
});
window.addEventListener("pointermove", queueGesture);
window.addEventListener("pointerup", finishGesture);
window.addEventListener("pointercancel", finishGesture);
viewport.addEventListener("wheel", (event) => {
  if (workspace.view !== "tree") return;
  event.preventDefault();
  if (gesture) return;
  const bounds = viewport.getBoundingClientRect();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1);
  const nextZoom = camera.zoom * Math.exp(-delta * .0016);
  if (Math.min(MAX_ZOOM, Math.max(.04, nextZoom)) === camera.zoom) return;
  beginMotion();
  setZoom(nextZoom, event.clientX - bounds.left, event.clientY - bounds.top, true);
  motionTimeout = setTimeout(endMotion, 120);
}, { passive: false });

zoomLevel.addEventListener("focus", () => {
  zoomEditStart = zoomLevel.value;
  zoomLevel.select();
});
zoomLevel.addEventListener("blur", () => {
  const original = zoomEditStart;
  zoomEditStart = undefined;
  const value = zoomLevel.value.trim();
  if (value && value !== original && Number.isFinite(Number(value))) setZoom(Number(value) / 100);
  zoomLevel.value = String(Math.round(camera.zoom * 1000) / 10);
});
zoomLevel.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    zoomLevel.value = zoomEditStart ?? zoomLevel.value;
    event.stopPropagation();
  } else if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  zoomLevel.blur();
});

$("#zoom-in").addEventListener("click", () => zoomBy(1.23));
$("#zoom-out").addEventListener("click", () => zoomBy(1 / 1.23));
function centerOnArche() {
  following = null;
  fitted = false;
  camera = focusCamera(ROOT);
  endMotion();
}
$("#zoom-reset").addEventListener("click", centerOnArche);
mobileZoom.addEventListener("click", centerOnArche);
completedToggle.addEventListener("click", () => {
  graph.hideCompleted = !graph.hideCompleted;
  if (graph.hideCompleted) {
    for (const node of graph.nodes) {
      if (node.complete && node.mapVisibility === "visible") delete node.mapVisibility;
    }
  }
  if (!readOnlyTree()) save();
  refresh();
});
$("#fit").addEventListener("click", () => {
  fitted = true;
  following = null;
  syncCamera();
});
newButton.addEventListener("click", () => {
  if (workspace.view === "tree") {
    if (!readOnlyTree()) openForm(null);
  }
  else openCollectionEditor(workspace.view);
});
$("#details-button").addEventListener("click", () => {
  if (workspace.view !== "tree") {
    workspace.view = "tree";
    resetMapView();
    save();
  }
  if (drawerMode === "details") {
    closeDrawer();
    return;
  }
  selected = null;
  selectedEdge = null;
  drawerMode = "details";
  refresh();
});
$("#cancel-button").addEventListener("click", () => dialog.close());
$("#cancel-form").addEventListener("click", () => dialog.close());
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || dialog.open || editDialog.open || mobileMenu.open) return;
  if (connectionSource) cancelConnection();
  else if (drawerMode) closeDrawer();
});

function updateResponsiveControls() {
  const mobile = mobileLayout.matches;
  const actions = $("#file-actions");
  const links = $("#workspace-links");
  const mobileActions = $("#mobile-menu-actions");
  if (mobile) {
    mobileActions.append(actions, links);
    $(".map-filters").append(newButton);
    $("#mobile-menu-button").after($("#date-filter"));
    $("#current-event-label").after($("#gains-summary"));
  } else {
    if (mobileMenu.open) mobileMenu.close();
    $("#header-actions").prepend(actions, newButton);
    mapPicker.after($("#date-filter"));
    $(".map-toolbar").append($("#gains-summary"));
    $("#map").append(links);
  }
  const zoomActions = mobile ? $("#mobile-quick-controls") : $("#desktop-zoom");
  zoomActions.append($("#fit"), completedToggle);
  $("#details-button").hidden = !mobile && workspace.view !== "tree";
}

$("#mobile-menu-button").addEventListener("click", () => mobileMenu.showModal());
for (const modal of [dialog, editDialog]) {
  let pressedBackdrop = false;
  const outside = (event) => {
    if (event.target !== modal) return false;
    const box = modal.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  };
  modal.addEventListener("pointerdown", (event) => { pressedBackdrop = outside(event); });
  modal.addEventListener("click", (event) => {
    if (pressedBackdrop && outside(event)) modal.close();
    pressedBackdrop = false;
  });
}
$("#mobile-menu-close").addEventListener("click", () => mobileMenu.close());
mobileMenu.addEventListener("click", (event) => {
  if (event.target.closest("#mobile-menu-actions button")) {
    mobileMenu.close();
  } else if (event.target === mobileMenu && event.clientX < mobileMenu.getBoundingClientRect().left) {
    mobileMenu.close();
  }
}, { capture: true });
mobileLayout.addEventListener?.("change", updateResponsiveControls);
updateResponsiveControls();

updateView();
restoreRunningTimer();
const locksChanged = enforceTaskLocks();
refresh();
if (migrated || locksChanged) save();
new ResizeObserver(syncCamera).observe(viewport);

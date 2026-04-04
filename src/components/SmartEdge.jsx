import { useNodes } from '@xyflow/react';
import { useMemo } from 'react';

const GRID = 24;   // grid cell size in pixels
const PAD  = 20;   // obstacle padding around each node

// ── Heap ──────────────────────────────────────────────────────────────────────
class MinHeap {
  constructor() { this.d = []; }
  push(key, pri) { this.d.push({ key, pri }); this._up(this.d.length - 1); }
  pop() {
    const top = this.d[0];
    const last = this.d.pop();
    if (this.d.length) { this.d[0] = last; this._dn(0); }
    return top;
  }
  get size() { return this.d.length; }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.d[p].pri <= this.d[i].pri) break;
      [this.d[p], this.d[i]] = [this.d[i], this.d[p]];
      i = p;
    }
  }
  _dn(i) {
    const n = this.d.length;
    for (;;) {
      let m = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.d[l].pri < this.d[m].pri) m = l;
      if (r < n && this.d[r].pri < this.d[m].pri) m = r;
      if (m === i) break;
      [this.d[m], this.d[i]] = [this.d[i], this.d[m]];
      i = m;
    }
  }
}

// ── Grid helpers ──────────────────────────────────────────────────────────────
const toGrid  = (x, y, ox, oy) => [Math.round((x - ox) / GRID), Math.round((y - oy) / GRID)];
const toWorld = (c, r, ox, oy) => [ox + c * GRID, oy + r * GRID];

function buildObstacles(nodes, excludeIds, ox, oy, cols, rows) {
  const blocked = new Uint8Array(cols * rows);
  for (const n of nodes) {
    if (excludeIds.has(n.id)) continue;
    const w = n.measured?.width  ?? 240;
    const h = n.measured?.height ?? 140;
    const [c0, r0] = toGrid(n.position.x - PAD,     n.position.y - PAD,     ox, oy);
    const [c1, r1] = toGrid(n.position.x + w + PAD, n.position.y + h + PAD, ox, oy);
    for (let r = Math.max(0, r0); r <= Math.min(rows - 1, r1); r++)
      for (let c = Math.max(0, c0); c <= Math.min(cols - 1, c1); c++)
        blocked[r * cols + c] = 1;
  }
  return blocked;
}

// A* (4-directional, weighted: prefer horizontal to match left-to-right layout)
function astar(blocked, cols, rows, sc, sr, ec, er) {
  const key = (c, r) => r * cols + c;
  const h   = (c, r) => Math.abs(c - ec) + Math.abs(r - er);

  const gCost   = new Float32Array(cols * rows).fill(Infinity);
  const parent  = new Int32Array(cols * rows).fill(-1);
  const heap    = new MinHeap();

  const sk = key(sc, sr);
  gCost[sk] = 0;
  heap.push(sk, h(sc, sr));

  // [dc, dr, moveCost]  — slightly prefer horizontal
  const dirs = [[1,0,1],[-1,0,1],[0,1,1.2],[0,-1,1.2]];

  while (heap.size) {
    const { key: cur } = heap.pop();
    const cr = Math.floor(cur / cols);
    const cc = cur - cr * cols;

    if (cc === ec && cr === er) {
      const path = [];
      let k = cur;
      while (k !== -1) { path.unshift([k - Math.floor(k / cols) * cols, Math.floor(k / cols)]); k = parent[k]; }
      return path;
    }

    for (const [dc, dr, cost] of dirs) {
      const nc = cc + dc, nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const nk = key(nc, nr);
      if (blocked[nk]) continue;
      const ng = gCost[cur] + cost;
      if (ng < gCost[nk]) {
        gCost[nk] = ng;
        parent[nk] = cur;
        heap.push(nk, ng + h(nc, nr));
      }
    }
  }
  return null;
}

// Remove collinear midpoints
function simplify(path) {
  if (path.length <= 2) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const [pc, pr] = path[i - 1], [cc, cr] = path[i], [nc, nr] = path[i + 1];
    if (cc - pc !== nc - cc || cr - pr !== nr - cr) out.push([cc, cr]);
  }
  out.push(path[path.length - 1]);
  return out;
}

// SVG path with rounded corners — radius grows toward target
function buildD(waypoints, ox, oy) {
  if (!waypoints?.length) return '';
  const pts = waypoints.map(([c, r]) => toWorld(c, r, ox, oy));
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;

  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  const n = pts.length;

  for (let i = 1; i < n; i++) {
    if (i === n - 1) { d += ` L ${pts[i][0]} ${pts[i][1]}`; continue; }

    // progress 0→1 from source to target; radius grows toward target
    const progress = i / (n - 1);
    const R = 6 + 22 * progress;    // 6px near source → 28px near target

    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const d1 = Math.hypot(x1 - x0, y1 - y0);
    const d2 = Math.hypot(x2 - x1, y2 - y1);
    if (!d1 || !d2) { d += ` L ${x1} ${y1}`; continue; }

    const r = Math.min(R, d1 / 2, d2 / 2);
    const ux1 = (x1 - x0) / d1, uy1 = (y1 - y0) / d1;
    const ux2 = (x2 - x1) / d2, uy2 = (y2 - y1) / d2;

    d += ` L ${x1 - ux1 * r} ${y1 - uy1 * r}`;
    d += ` Q ${x1} ${y1} ${x1 + ux2 * r} ${y1 + uy2 * r}`;
  }
  return d;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SmartEdge({
  source, target,
  sourceX, sourceY,
  targetX, targetY,
  style = {},
  markerEnd,
}) {
  const nodes = useNodes();

  const result = useMemo(() => {
    let minX = Math.min(sourceX, targetX);
    let minY = Math.min(sourceY, targetY);
    let maxX = Math.max(sourceX, targetX);
    let maxY = Math.max(sourceY, targetY);

    for (const n of nodes) {
      const w = n.measured?.width  ?? 240;
      const h = n.measured?.height ?? 140;
      minX = Math.min(minX, n.position.x - PAD);
      minY = Math.min(minY, n.position.y - PAD);
      maxX = Math.max(maxX, n.position.x + w + PAD);
      maxY = Math.max(maxY, n.position.y + h + PAD);
    }

    const margin = GRID * 4;
    const ox   = minX - margin;
    const oy   = minY - margin;
    const cols = Math.ceil((maxX - minX + margin * 2) / GRID) + 2;
    const rows = Math.ceil((maxY - minY + margin * 2) / GRID) + 2;

    const blocked = buildObstacles(nodes, new Set([source, target]), ox, oy, cols, rows);

    const [sc, sr] = toGrid(sourceX, sourceY, ox, oy);
    const [ec, er] = toGrid(targetX, targetY, ox, oy);

    // Ensure start/end cells are passable
    blocked[sr * cols + sc] = 0;
    blocked[er * cols + ec] = 0;

    const raw = astar(blocked, cols, rows, sc, sr, ec, er);
    if (!raw) return null;

    return { waypoints: simplify(raw), ox, oy };
  }, [nodes, source, target, sourceX, sourceY, targetX, targetY]);

  const stroke      = style.stroke      ?? 'rgba(180,180,180,0.55)';
  const strokeWidth = style.strokeWidth ?? 3;

  const d = result
    ? buildD(result.waypoints, result.ox, result.oy)
    : `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;

  return (
    <>
      {/* Wide invisible hit area for easier selection */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={18} />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={markerEnd}
      />
    </>
  );
}

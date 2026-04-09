import { useStore } from '../store';

// Must match autoLayout constants in store.js
const GRID_W  = 400;  // col * GRID_W  = node left edge
const NODE_W  = 240;  // node width
const NODE_H  = 160;  // node height
const COL_GAP = 160;  // GRID_W - NODE_W
const R       = 10;   // corner radius
const RAIL_PAD = 36;  // px clearance above/below the grid for long-range edges

// Rounded orthogonal polyline — all turns are 90° with radius R
function buildPath(pts) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], c = pts[i], n = pts[i + 1];
    const dx1 = c.x - p.x, dy1 = c.y - p.y;
    const dx2 = n.x - c.x, dy2 = n.y - c.y;
    const l1 = Math.hypot(dx1, dy1), l2 = Math.hypot(dx2, dy2);
    if (l1 < 0.01 || l2 < 0.01) { d += ` L ${c.x} ${c.y}`; continue; }
    const r = Math.min(R, l1 / 2, l2 / 2);
    d += ` L ${c.x - (dx1 / l1) * r} ${c.y - (dy1 / l1) * r}`;
    d += ` Q ${c.x} ${c.y} ${c.x + (dx2 / l2) * r} ${c.y + (dy2 / l2) * r}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

// Center x of the gap between col and col+1
function gapCenter(col) {
  return col * GRID_W + NODE_W + COL_GAP / 2; // e.g. col=0 → x=320
}

export default function SmartEdge({
  source, target,
  sourceX, sourceY,
  targetX, targetY,
  style = {},
  markerEnd,
}) {
  const targetNode = useStore((s) => s.nodes.find((n) => n.id === target));
  const nodes      = useStore((s) => s.nodes);
  const dashed = targetNode?.data?.requiresAll === false;

  // Derive grid columns from handle positions:
  //   sourceX = srcCol * GRID_W + NODE_W   (right handle)
  //   targetX = tgtCol * GRID_W            (left  handle)
  const srcCol  = Math.round((sourceX - NODE_W) / GRID_W);
  const tgtCol  = Math.round(targetX / GRID_W);
  const colSpan = tgtCol - srcCol;

  let d;

  if (colSpan <= 1) {
    // ── Adjacent columns: simple H→V→H stair through the gap centre ──────────
    const jx = (sourceX + targetX) / 2; // always = gapCenter(srcCol) on a clean grid
    if (Math.abs(sourceY - targetY) < 1) {
      d = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else {
      const sign = targetY > sourceY ? 1 : -1;
      const r = Math.min(R, Math.abs(targetY - sourceY) / 2,
                         Math.abs(jx - sourceX), Math.abs(targetX - jx));
      d = [
        `M ${sourceX} ${sourceY}`,
        `L ${jx - r} ${sourceY}`,
        `Q ${jx} ${sourceY} ${jx} ${sourceY + sign * r}`,
        `L ${jx} ${targetY - sign * r}`,
        `Q ${jx} ${targetY} ${jx + r} ${targetY}`,
        `L ${targetX} ${targetY}`,
      ].join(' ');
    }
  } else {
    // ── Skipping edge: fly over the grid on a horizontal rail ─────────────────
    // Rail sits above or below ALL nodes so it never crosses a node bounding box.
    const nodeYs = nodes.map((n) => n.position?.y ?? 0);
    const minY   = Math.min(...nodeYs);
    const maxY   = Math.max(...nodeYs);

    // Go above when source is higher than or equal to target (keeps the U tidy);
    // go below otherwise.
    const railY = sourceY <= targetY
      ? minY - RAIL_PAD
      : maxY + NODE_H + RAIL_PAD;

    // Exit through the gap immediately after the source column,
    // enter through the gap immediately before the target column.
    const exitX  = gapCenter(srcCol);
    const enterX = gapCenter(tgtCol - 1);

    d = buildPath([
      { x: sourceX, y: sourceY },
      { x: exitX,   y: sourceY },
      { x: exitX,   y: railY   },
      { x: enterX,  y: railY   },
      { x: enterX,  y: targetY },
      { x: targetX, y: targetY },
    ]);
  }

  const gradId    = `edge-shine-${source}-${target}`;
  const DASH_CYCLE = 20;
  const approxLen  = Math.abs(targetX - sourceX) + Math.abs(targetY - sourceY);
  const dashOffset = approxLen % DASH_CYCLE;

  return (
    <>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="-600" y1="0" x2="600" y2="0">
          <stop offset="0%"   stopColor="rgba(148,100,32,0)"     />
          <stop offset="25%"  stopColor="rgba(200,140,45,0.28)"  />
          <stop offset="50%"  stopColor="rgba(255,220,100,0.62)" />
          <stop offset="75%"  stopColor="rgba(200,140,45,0.28)"  />
          <stop offset="100%" stopColor="rgba(148,100,32,0)"     />
          <animateTransform
            attributeName="gradientTransform"
            type="translate"
            from="-2200 0"
            to="3000 0"
            dur="9s"
            repeatCount="indefinite"
          />
        </linearGradient>
      </defs>

      {/* hit area */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={20} />
      {/* dark background border — separates overlapping paths */}
      <path d={d} fill="none" stroke="#090c11" strokeWidth={10}
            strokeLinecap="round" strokeLinejoin="round" />
      {/* base edge */}
      <path
        d={d}
        fill="none"
        stroke={style.stroke ?? 'rgba(148,100,32,0.72)'}
        strokeWidth={style.strokeWidth ?? 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '8 12' : undefined}
        strokeDashoffset={dashed ? dashOffset : undefined}
        markerEnd={markerEnd}
      />
      {/* gradient shine overlay */}
      <path
        d={d}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={style.strokeWidth ?? 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '8 12' : undefined}
        strokeDashoffset={dashed ? dashOffset : undefined}
      />
    </>
  );
}

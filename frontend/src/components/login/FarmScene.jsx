/**
 * Full-bleed pastoral background for the sign-in page.
 *
 * Presentational only: no props, no state, no context, no network. Palette,
 * loop durations and easing all live in `src/index.css` under `@theme`.
 *
 * GEOMETRY NOTES
 * viewBox is 1600x1000 with `xMidYMid slice`. Because slice scales by the
 * larger ratio, every landscape viewport shows the full x range 0..1600 and
 * crops vertically instead — worst case (21:9) is y 162..838. So:
 *   - elements are spread across the whole 0..1600 width, and
 *   - every base sits at y <= 820, with nothing critical above y = 170.
 * Layer fills bleed to x -120..1720 so there is no seam at any aspect ratio.
 *
 * GROUND LINES (bases are sunk a few units below each edge, never floating)
 *   midground  y = 578   barn, windmill, trees, fence
 *   pasture    y ~ 665   far + mid cows, far hay bale
 *   near grass y ~ 780   near cows, farmer, near hay bale
 */

/* Cow silhouette, drawn once. Position, scale and depth-fade come from the
   wrapper <g>; graze tempo comes from the .farm-cow-* class in the stylesheet.
   No faces, eyes or udders — silhouette readability only. */
function Cow({ className }) {
  return (
    <g className={className}>
      <g className="farm-cow-body">
        <g className="fill-farm-figure">
          {/* legs */}
          <rect x="-19" y="-16" width="4.2" height="16" rx="2.1" />
          <rect x="-11.5" y="-16" width="4.2" height="16" rx="2.1" />
          <rect x="8.5" y="-16" width="4.2" height="16" rx="2.1" />
          <rect x="15.5" y="-16" width="4.2" height="16" rx="2.1" />
          {/* tail */}
          <rect x="21" y="-38" width="3.2" height="19" rx="1.6" />
          {/* body */}
          <rect x="-24" y="-40" width="47" height="25" rx="12" />
        </g>
        {/* spots */}
        <g className="fill-farm-cream">
          <ellipse cx="2" cy="-31" rx="8" ry="6.5" />
          <ellipse cx="-13" cy="-23" rx="4.2" ry="3.5" />
        </g>
        {/* head — pivots at the shoulder, dips and chews */}
        <g className="farm-cow-head fill-farm-figure">
          <rect x="-34" y="-37" width="12.5" height="19" rx="5.6" />
          <rect x="-44" y="-31" width="14" height="11.5" rx="5" />
          <rect x="-49" y="-27.5" width="7.5" height="7" rx="3" />
        </g>
      </g>
    </g>
  )
}

/* Flat geometric tree: trunk plus three overlapping canopy circles. */
function Tree() {
  return (
    <>
      <rect className="fill-farm-figure" x="-4" y="-26" width="8" height="26" rx="3" />
      <g className="fill-farm-pasture-deep">
        <circle cx="0" cy="-40" r="21" />
        <circle cx="-13" cy="-31" r="14" />
        <circle cx="13" cy="-32" r="15" />
      </g>
    </>
  )
}

/* Perspective fence: [x, groundY, height] — posts tighten and shorten as the
   line recedes to the right. Edit the array to reshape the run. */
const FENCE_POSTS = [
  [690, 584, 34],
  [762, 582, 31],
  [828, 580, 28.5],
  [888, 578, 26],
  [942, 576, 24],
  [990, 575, 22],
  [1032, 573, 20.5],
  [1070, 572, 19],
  [1103, 571, 17.5],
  [1132, 570, 16],
]

export default function FarmScene() {
  return (
    <div className="farm-scene pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <svg
        className="h-full w-full"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* golden-hour sky: dusty blue lifting off a pale cream horizon */}
          <linearGradient id="farm-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-farm-sky-top)" />
            <stop offset="58%" stopColor="var(--color-farm-sky-mid)" />
            <stop offset="100%" stopColor="var(--color-farm-sky-low)" />
          </linearGradient>
        </defs>

        {/* ================= LAYER 1 — SKY ================================ */}
        <rect x="-120" y="-120" width="1840" height="820" fill="url(#farm-sky)" />

        {/* cloud-1 */}
        <g transform="translate(210 168)">
          <g className="farm-cloud fill-farm-cream" opacity="0.5">
            <ellipse cx="0" cy="0" rx="54" ry="17" />
            <ellipse cx="-34" cy="6" rx="34" ry="12" />
            <ellipse cx="26" cy="7" rx="40" ry="13" />
            <ellipse cx="6" cy="-11" rx="30" ry="14" />
          </g>
        </g>

        {/* cloud-2 */}
        <g transform="translate(820 104)">
          <g className="farm-cloud farm-cloud-2 fill-farm-cream" opacity="0.42">
            <ellipse cx="0" cy="0" rx="44" ry="14" />
            <ellipse cx="30" cy="5" rx="30" ry="10" />
            <ellipse cx="-6" cy="-9" rx="24" ry="11" />
          </g>
        </g>

        {/* cloud-3 */}
        <g transform="translate(1330 244)">
          <g className="farm-cloud farm-cloud-3 fill-farm-cream" opacity="0.34">
            <ellipse cx="0" cy="0" rx="62" ry="16" />
            <ellipse cx="-40" cy="5" rx="34" ry="11" />
            <ellipse cx="34" cy="4" rx="38" ry="12" />
          </g>
        </g>

        {/* bird — one arc every 26s */}
        <g transform="translate(180 268)">
          <path
            className="farm-bird stroke-farm-figure"
            d="M0 0 Q7 -8 14 0 Q21 -8 28 0"
            fill="none"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>

        {/* ================= LAYER 2 — FAR HILLS ========================== */}
        {/* One token, three opacities: cheap, correct atmospheric perspective. */}
        <path
          className="fill-farm-hill"
          opacity="0.5"
          d="M-120 496 C 140 452 340 500 620 476 C 900 452 1120 496 1380 470 C 1520 456 1640 476 1720 466 L1720 1010 L-120 1010 Z"
        />
        <path
          className="fill-farm-hill"
          opacity="0.75"
          d="M-120 528 C 180 494 420 534 700 514 C 980 494 1180 532 1420 512 C 1560 500 1660 516 1720 510 L1720 1010 L-120 1010 Z"
        />
        <path
          className="fill-farm-hill"
          d="M-120 556 C 220 528 480 562 780 546 C 1080 530 1300 560 1540 546 C 1640 540 1690 548 1720 546 L1720 1010 L-120 1010 Z"
        />

        {/* ================= LAYER 3 — MIDGROUND FARM ===================== */}
        {/* field the barn, windmill, trees and fence all stand on (y ~ 570) */}
        <path
          className="fill-farm-field"
          d="M-120 586 C 200 566 420 578 700 570 C 980 562 1240 576 1720 566 L1720 1010 L-120 1010 Z"
        />

        {/* tree-1 — far left, small */}
        <g transform="translate(112 578) scale(0.68)">
          <Tree />
        </g>

        {/* barn + silo — silo drawn first so the roof overlaps it */}
        <g transform="translate(330 578)">
          {/* silo */}
          <path className="fill-farm-cream" d="M158 0 L158 -138 A24 24 0 0 1 206 -138 L206 0 Z" />
          {/* barn body */}
          <rect className="fill-farm-barn" x="0" y="-104" width="140" height="104" rx="4" />
          {/* roof */}
          <path
            className="fill-farm-figure"
            d="M-12 -104 L62 -152 Q70 -156.5 78 -152 L152 -104 Z"
          />
          {/* door */}
          <rect className="fill-farm-cream" x="52" y="-54" width="36" height="54" rx="3" />
          {/* windows — these are the lit ones in the dusk palette */}
          <rect className="fill-farm-window" x="20" y="-84" width="20" height="20" rx="2.5" />
          <rect className="fill-farm-window" x="100" y="-84" width="20" height="20" rx="2.5" />
        </g>

        {/* tree-2 + tree-3 — an uneven copse, not evenly spaced */}
        <g transform="translate(580 578) scale(0.96)">
          <Tree />
        </g>
        <g transform="translate(636 578) scale(0.6)">
          <Tree />
        </g>

        {/* fence — recedes right toward the horizon */}
        <g className="fill-farm-figure" opacity="0.72">
          {/* rails */}
          <path d="M690 549 L1132 553.4 L1132 556 L690 553 Z" />
          <path d="M690 561 L1132 560 L1132 562.5 L690 564.5 Z" />
          {/* posts */}
          {FENCE_POSTS.map(([x, y, h]) => (
            <rect key={x} x={x - 2.6} y={y - h} width="5.2" height={h} rx="2.4" />
          ))}
        </g>

        {/* windmill — tower, cap, then the rotating blade assembly */}
        <g transform="translate(1215 578)">
          <path className="fill-farm-figure" d="M-17 0 L-7.5 -104 L7.5 -104 L17 0 Z" />
          <rect className="fill-farm-figure" x="-11" y="-116" width="22" height="14" rx="6" />
        </g>
        <g transform="translate(1215 470)">
          <g className="farm-windmill-blades fill-farm-figure">
            <rect x="-4.5" y="-62" width="9" height="54" rx="4.5" />
            <rect x="-4.5" y="-62" width="9" height="54" rx="4.5" transform="rotate(90)" />
            <rect x="-4.5" y="-62" width="9" height="54" rx="4.5" transform="rotate(180)" />
            <rect x="-4.5" y="-62" width="9" height="54" rx="4.5" transform="rotate(270)" />
            <circle cx="0" cy="0" r="7" />
          </g>
        </g>

        {/* tree-4 — right side, breaks the windmill/fence rhythm */}
        <g transform="translate(1418 578) scale(0.82)">
          <Tree />
        </g>

        {/* ================= LAYER 4 — FOREGROUND PASTURE ================= */}
        <path
          className="fill-farm-pasture"
          d="M-120 676 C 220 654 520 672 860 662 C 1180 652 1400 668 1720 656 L1720 1010 L-120 1010 Z"
        />

        {/* cow-far — smallest, faded back into the haze */}
        <g transform="translate(430 690) scale(0.62)" opacity="0.72">
          <Cow className="farm-cow-far" />
        </g>

        {/* cow-mid */}
        <g transform="translate(1180 726) scale(0.82)" opacity="0.88">
          <Cow className="farm-cow-mid" />
        </g>

        {/* hay-bale-far */}
        <g transform="translate(1400 742) scale(0.68)" opacity="0.88">
          <rect className="fill-farm-wheat" x="0" y="-42" width="70" height="42" rx="19" />
          <ellipse className="fill-farm-cream" cx="53" cy="-21" rx="13" ry="17" opacity="0.55" />
        </g>

        {/* near grass — the richest band, gives the front row its own ground */}
        <path
          className="fill-farm-pasture-deep"
          d="M-120 792 C 260 770 560 790 900 776 C 1240 762 1460 780 1720 768 L1720 1010 L-120 1010 Z"
        />

        {/* cow-near */}
        <g transform="translate(980 786) scale(1.1)">
          <Cow className="farm-cow-near" />
        </g>

        {/* farmer — walks the full width and resets off-screen, so no fade */}
        <g transform="translate(-200 806)">
          <g className="farm-farmer">
            <g className="farm-farmer-sway" transform="scale(0.92)">
              <g className="fill-farm-figure">
                {/* legs */}
                <rect x="-7" y="-33" width="7" height="33" rx="3.5" />
                <rect x="1.5" y="-33" width="7" height="33" rx="3.5" />
                {/* torso + carrying arm */}
                <rect x="-9" y="-62" width="18" height="32" rx="8" />
                <rect x="8" y="-58" width="5.5" height="26" rx="2.75" />
                {/* head + hat */}
                <circle cx="0" cy="-71" r="8.5" />
                <rect x="-14" y="-79" width="28" height="4.5" rx="2.25" />
                <rect x="-7" y="-86" width="14" height="8" rx="3" />
              </g>
              {/* milk pail */}
              <path
                className="fill-farm-cream"
                d="M9 -32 L23 -32 L21.4 -18.5 Q21.2 -16.5 19.2 -16.5 L12.8 -16.5 Q10.8 -16.5 10.6 -18.5 Z"
              />
            </g>
          </g>
        </g>

        {/* hay-bale-near */}
        <g transform="translate(206 812)">
          <rect className="fill-farm-wheat" x="0" y="-42" width="70" height="42" rx="19" />
          <ellipse className="fill-farm-cream" cx="53" cy="-21" rx="13" ry="17" opacity="0.55" />
        </g>

        {/* cow-front — largest, closest, most saturated */}
        <g transform="translate(640 818) scale(1.34)">
          <Cow className="farm-cow-front" />
        </g>
      </svg>
    </div>
  )
}

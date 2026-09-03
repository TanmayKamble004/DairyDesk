/**
 * Ambient farm band for the sign-in page.
 *
 * Purely presentational: no props, no state, no context, no network. Every
 * dimension, colour and loop duration lives in `src/index.css` under the
 * `@theme` block — tweak there, not here.
 *
 * The viewBox is deliberately much wider (20:1) than any realistic viewport
 * band so `slice` crops the sides rather than the top; the composition is
 * centred around x=1400 and stays intact from 390px to ultrawide.
 */
export default function FarmScene() {
  return (
    <div className="farm-scene pointer-events-none absolute inset-x-0 bottom-0 z-0 select-none">
      <svg
        className="h-full w-full"
        viewBox="0 0 2800 140"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
        focusable="false"
      >
        {/* ---- ground contours (back → front) ------------------------- */}
        <path
          className="fill-farm-ridge-far"
          d="M0 88 C 300 78 620 92 940 84 C 1300 75 1700 90 2100 82 C 2400 76 2620 86 2800 82 L2800 140 L0 140 Z"
        />
        <path
          className="fill-farm-ridge-mid"
          d="M0 104 C 340 94 700 108 1080 100 C 1460 92 1820 106 2200 98 C 2480 92 2680 102 2800 98 L2800 140 L0 140 Z"
        />
        <path
          className="fill-farm-ridge-near"
          d="M0 120 C 400 112 760 124 1160 118 C 1560 112 1900 124 2280 118 C 2520 114 2690 122 2800 119 L2800 140 L0 140 Z"
        />

        {/* ---- bird — one slow arc across the sky every 18s ----------- */}
        <g transform="translate(1180 34)">
          <path
            className="farm-bird animate-farm-bird stroke-farm-figure"
            d="M0 0 Q4 -4.4 8 0 Q12 -4.4 16 0"
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>

        {/* ---- barn + silo — sits on the far ridge -------------------- */}
        <g transform="translate(1090 86)">
          <path className="fill-farm-figure" d="M-6 -34 L30 -53 Q33 -54.4 36 -53 L72 -34 Z" />
          <rect className="fill-farm-structure" x="0" y="-34" width="66" height="34" rx="3" />
          <rect className="fill-farm-accent" x="26" y="-18" width="14" height="18" rx="1.5" />
          <path className="fill-farm-figure" d="M76 0 L76 -41 A9 9 0 0 1 94 -41 L94 0 Z" />
        </g>

        {/* ---- fence — mid ridge, sits behind the cows ---------------- */}
        <g className="fill-farm-figure" opacity="0.5" transform="translate(1300 101)">
          <rect x="0" y="-11" width="252" height="2.4" rx="1.2" />
          <rect x="0" y="-5.6" width="252" height="2.4" rx="1.2" />
          <rect x="0" y="-14" width="3" height="14" rx="1.5" />
          <rect x="50" y="-14" width="3" height="14" rx="1.5" />
          <rect x="100" y="-14" width="3" height="14" rx="1.5" />
          <rect x="150" y="-14" width="3" height="14" rx="1.5" />
          <rect x="200" y="-14" width="3" height="14" rx="1.5" />
          <rect x="249" y="-14" width="3" height="14" rx="1.5" />
        </g>

        {/* ---- cow-1 — faces left, 13s graze loop -------------------- */}
        <g transform="translate(1470 117)">
          <g className="animate-farm-drift">
            {/* legs */}
            <g className="fill-farm-figure">
              <rect x="-15" y="-13" width="3.4" height="13" rx="1.7" />
              <rect x="-9" y="-13" width="3.4" height="13" rx="1.7" />
              <rect x="7" y="-13" width="3.4" height="13" rx="1.7" />
              <rect x="13" y="-13" width="3.4" height="13" rx="1.7" />
              {/* tail */}
              <rect x="16.4" y="-30" width="2.6" height="15" rx="1.3" />
              {/* body */}
              <rect x="-19" y="-31" width="37" height="20" rx="9.5" />
            </g>
            {/* spots */}
            <g className="fill-farm-accent">
              <ellipse cx="1" cy="-24" rx="6.4" ry="5.2" />
              <ellipse cx="-11" cy="-18.5" rx="3.4" ry="2.8" />
            </g>
            {/* head — pivots at the shoulder, dips and chews */}
            <g className="farm-cow-head fill-farm-figure animate-farm-graze">
              <rect x="-27" y="-29" width="10" height="15" rx="4.5" />
              <rect x="-35" y="-24" width="11" height="9" rx="4" />
              <rect x="-39" y="-21.5" width="6" height="5.5" rx="2.4" />
            </g>
          </g>
        </g>

        {/* ---- cow-2 — mirrored, slightly smaller, 17s graze loop ----- */}
        <g transform="translate(1616 119) scale(-0.92 0.92)">
          <g className="farm-cow-2 animate-farm-drift">
            {/* legs */}
            <g className="fill-farm-figure">
              <rect x="-15" y="-13" width="3.4" height="13" rx="1.7" />
              <rect x="-9" y="-13" width="3.4" height="13" rx="1.7" />
              <rect x="7" y="-13" width="3.4" height="13" rx="1.7" />
              <rect x="13" y="-13" width="3.4" height="13" rx="1.7" />
              {/* tail */}
              <rect x="16.4" y="-30" width="2.6" height="15" rx="1.3" />
              {/* body */}
              <rect x="-19" y="-31" width="37" height="20" rx="9.5" />
            </g>
            {/* spots */}
            <g className="fill-farm-accent">
              <ellipse cx="-2" cy="-25" rx="5.6" ry="4.6" />
              <ellipse cx="9" cy="-19" rx="3.2" ry="2.6" />
            </g>
            {/* head — pivots at the shoulder, dips and chews */}
            <g className="farm-cow-head fill-farm-figure animate-farm-graze-slow">
              <rect x="-27" y="-29" width="10" height="15" rx="4.5" />
              <rect x="-35" y="-24" width="11" height="9" rx="4" />
              <rect x="-39" y="-21.5" width="6" height="5.5" rx="2.4" />
            </g>
          </g>
        </g>

        {/* ---- farmer — 20s crossing, 7s carry-sway ------------------- */}
        <g transform="translate(1232 118)">
          <g className="farm-farmer animate-farm-stroll">
            <g className="farm-farmer-sway animate-farm-sway">
              <g className="fill-farm-figure">
                {/* legs */}
                <rect x="-3.6" y="-15" width="3.2" height="15" rx="1.6" />
                <rect x="0.6" y="-15" width="3.2" height="15" rx="1.6" />
                {/* torso + carrying arm */}
                <rect x="-4.2" y="-29" width="8.4" height="15" rx="3.8" />
                <rect x="4" y="-27" width="2.6" height="12" rx="1.3" />
                {/* head + hat brim */}
                <circle cx="0" cy="-33.4" r="4" />
                <rect x="-6.5" y="-36.8" width="13" height="2.2" rx="1.1" />
              </g>
              {/* milk pail */}
              <path
                className="fill-farm-accent"
                d="M5.2 -15 L11.8 -15 L10.9 -8.6 Q10.8 -7.6 9.8 -7.6 L7.2 -7.6 Q6.2 -7.6 6.1 -8.6 Z"
              />
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}

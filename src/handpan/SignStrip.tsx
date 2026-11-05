// The sign strip: seven small glass chips in a row above the dock, one per
// note-hand sign, as you see your right hand held up to the camera: a fist
// for the Ding, one to four fingers for fields 1–4, an open hand for field 5
// and the rock sign (index and pinky up) for field 6. The chosen field's chip
// lights blue; a chip flashes gold when its field is struck. Tap a chip to
// play its field.
import { useEffect, useRef } from "react";

import { sound } from "./audio";
import { GHOST_COLOR } from "./GhostHands";
import { SIGN_FIELDS, signOf, type FieldId, type Sign } from "./notes";
import { handpan, strike, useHandpanVersion } from "./state";

/** A chip's gold flash fades over this long (s). */
const FLASH = 0.6;
/** A tapped chip plays this loud. */
const TAP_VELOCITY = 0.75;

export const STRIP_CSS = `
.hp-strip { position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--hp-strip-bottom));
  display: flex; gap: 4px; pointer-events: auto;
  --chip: min(46px, calc((100vw - 32px - 24px) / 7));
  animation: hp-fade 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.hp-chip { position: relative; width: var(--chip); height: calc(var(--chip) + 12px); border-radius: 12px;
  padding: 0; margin: 0; color: #fff; cursor: pointer; overflow: hidden; outline: none; touch-action: manipulation;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  background: rgb(35 37 40 / .64); border: 1px solid rgb(235 246 253 / .18);
  backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / .22), 0 8px 24px rgb(0 0 0 / .22);
  transition: background 220ms cubic-bezier(0.22, 1, 0.36, 1), border-color 220ms cubic-bezier(0.22, 1, 0.36, 1); }
.hp-chip:focus-visible { box-shadow: 0 0 0 2px ${GHOST_COLOR.note}; }
.hp-chip.on { background: rgb(47 140 255 / .5); border-color: rgb(120 180 255 / .7); }
.hp-chip-flash { position: absolute; inset: 0; opacity: 0; pointer-events: none; background: ${GHOST_COLOR.strike}; }
.hp-chip svg { position: relative; }
.hp-chip-num { position: relative; font: 650 10px/1 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .7); }
.hp-chip.on .hp-chip-num { color: #fff; }
`;

/** Which fingers are up in each sign: thumb, index, middle, ring, pinky. */
const UP: Record<Sign, boolean[]> = {
  fist: [false, false, false, false, false],
  one: [false, true, false, false, false],
  two: [false, true, true, false, false],
  three: [false, true, true, true, false],
  four: [false, true, true, true, true],
  open: [true, true, true, true, true],
  rock: [false, true, false, false, true],
};
/** The fingers' bases and how tall each stands (24 grid). */
const FINGER = [
  { x: 9, top: 4.5 },
  { x: 12, top: 3 },
  { x: 15, top: 4 },
  { x: 17.6, top: 6.5 },
];

/** A sign drawn as a hand held up, palm to you (thumb on the left, as in a mirror). */
export const SignIcon = ({
  sign,
  size = 24,
}: {
  sign: Sign;
  size?: number;
}) => {
  const up = UP[sign];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* the palm */}
      <path d="M7.5 12v4.2a5 5 0 0 0 5 5h.6a5 5 0 0 0 5-5V12" />
      <path
        d="M7.5 12.5c0-1 .4-1.8 1.2-1.8h8.2c.8 0 1.2.8 1.2 1.8"
        opacity=".55"
      />
      {/* the fingers: up, or folded down over the palm */}
      {FINGER.map((f, i) =>
        up[i + 1] ? (
          <path key={f.x} d={`M${f.x} 11.5V${f.top}`} />
        ) : (
          <path key={f.x} d={`M${f.x} 11.2v1.6`} opacity=".9" />
        ),
      )}
      {/* the thumb: out to the side, or across the palm */}
      {up[0] ? (
        <path d="M7.5 15.5L4.2 11.6" />
      ) : (
        <path d="M7.6 15.4c1.3-.4 2.8-.9 4-1.9" opacity=".9" />
      )}
    </svg>
  );
};

type ChipRef = { field: FieldId; flash: HTMLSpanElement | null };

export const SignStrip = () => {
  useHandpanVersion();
  const chips = useRef<ChipRef[]>([]);

  // The gold flashes follow the strikes every frame.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now() / 1000;
      chips.current.forEach((c) => {
        if (!c.flash) return;
        const e = (now - handpan.struckAt[c.field]) / FLASH;
        // eslint-disable-next-line no-param-reassign
        c.flash.style.opacity =
          e >= 0 && e < 1 ? String(0.75 * (1 - e) ** 3) : "0";
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hp-strip" data-hud="strip" aria-label="Note-hand signs">
      {SIGN_FIELDS.map((field, i) => {
        const sign = signOf(field)!;
        const ref: ChipRef = chips.current[i] ?? { field, flash: null };
        chips.current[i] = ref;
        const on = handpan.chosen === field;
        const label = field === 0 ? "Ding" : String(field);
        return (
          <button
            key={field}
            type="button"
            className={`hp-chip ${on ? "on" : ""}`}
            data-hud={`sign-${sign}`}
            aria-label={`${label}: ${sign === "fist" ? "fist" : sign} sign`}
            aria-pressed={on}
            onClick={() => {
              sound.unlock();
              strike(field, TAP_VELOCITY, "pointer");
            }}
          >
            <span
              className="hp-chip-flash"
              ref={(el) => {
                ref.flash = el;
              }}
            />
            <SignIcon sign={sign} />
            <span className="hp-chip-num">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

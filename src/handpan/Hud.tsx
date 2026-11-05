// The page UI, minimal, on Night glass:
//   - your camera, top right (CameraFrame.tsx): tap it to tuck it away; a
//     small camera button then sits in the corner to bring it back
//   - one floating dock, bottom centre, icons only: the view (front,
//     player), day / night, and how to play. A small label shows over a
//     button on hover, or for a moment after a tap.
//   - the sign strip just above the dock (SignStrip.tsx)
//   - the how-to-play steps: the two hands and the seven signs (after
//     Start, or from the dock)
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useXRReady } from "@vincentt-xr/sdk/low-level";

import { GHOST_COLOR } from "./GhostHands";
import {
  DOCK_BOTTOM,
  DOCK_HEIGHT,
  frameRect,
  GUTTER,
  pinToScreen,
  STRIP_GAP,
  type View,
} from "./layout";
import { SIGN_FIELDS, signOf } from "./notes";
import { SignIcon, SignStrip, STRIP_CSS } from "./SignStrip";
import {
  closeHowTo,
  handpan,
  INTRO_CARD_MS,
  nextView,
  setNight,
  toggleCam,
  useHandpanVersion,
} from "./state";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ACCENT = "#f4d968";
/** After a tap the label stays this long (ms). */
const TAP_LABEL = 1000;

const CSS = `
.hp-root { --hp-strip-bottom: ${DOCK_BOTTOM + DOCK_HEIGHT + STRIP_GAP}px; position: absolute; inset: 0; pointer-events: none; color: #fff;
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.hp-glass { background: rgb(35 37 40 / .64);
  backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid rgb(235 246 253 / .18);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / .22), 0 8px 24px rgb(0 0 0 / .22); }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .hp-glass { background: rgb(35 37 40 / .82); } }
.hp-dock { position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + ${DOCK_BOTTOM}px);
  display: flex; gap: 6px; padding: 6px; border-radius: 999px; pointer-events: auto; }
.hp-btn { pointer-events: auto; border: 0; padding: 0; margin: 0; color: inherit; position: relative;
  display: grid; place-items: center; cursor: pointer; outline: none; touch-action: manipulation;
  width: 44px; height: 44px; border-radius: 50%; background: transparent;
  transition: transform 160ms ease-out, background 200ms ${EASE}; }
.hp-btn:hover { background: rgb(255 255 255 / .08); }
.hp-btn:active { transform: scale(0.94); }
.hp-btn:focus-visible { box-shadow: 0 0 0 2px ${ACCENT}; }
.hp-btn.on { color: ${ACCENT}; background: rgb(244 217 104 / .14); }
.hp-btn .hp-mark { position: absolute; bottom: 3px; right: 3px; width: 15px; height: 15px;
  border-radius: 50%; background: ${ACCENT}; color: #232528; display: grid; place-items: center;
  font: 700 9px/1 system-ui, -apple-system, sans-serif; }
.hp-tip { position: absolute; bottom: calc(100% + 12px); left: 50%; transform: translate(-50%, 4px);
  padding: 6px 10px; border-radius: 10px; white-space: nowrap; opacity: 0; pointer-events: none;
  font: 600 12px/1 system-ui, -apple-system, sans-serif;
  transition: opacity 220ms ${EASE}, transform 220ms ${EASE}; }
.hp-tip.show { opacity: 1; transform: translate(-50%, 0); }
@media (hover: hover) { .hp-btn:hover .hp-tip { opacity: 1; transform: translate(-50%, 0); } }
.hp-cam { position: absolute; pointer-events: auto; border: 0; padding: 0; margin: 0;
  background: transparent; cursor: pointer; border-radius: 16px; outline: none; }
.hp-cam:focus-visible { box-shadow: 0 0 0 2px ${ACCENT}; }
.hp-show { position: absolute; right: ${GUTTER}px; top: ${GUTTER}px; }
.hp-nocam { position: absolute; display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border-radius: 16px; font: 600 12px/1.35 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .9);
  animation: hp-fade 260ms ${EASE} both; }
.hp-nocam svg { flex: none; color: rgb(255 255 255 / .7); }
.hp-gone { opacity: 0; pointer-events: none; }
.hp-howto-back { position: absolute; inset: 0; pointer-events: auto; background: rgb(10 10 14 / .25);
  animation: hp-fade 260ms ${EASE} both; }
@keyframes hp-fade { from { opacity: 0; } to { opacity: 1; } }
.hp-howto { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  padding: 16px 18px; border-radius: 22px; display: flex; flex-direction: column; gap: 12px;
  width: min(360px, calc(100% - 32px)); animation: hp-pop2 360ms ${EASE} both; }
@keyframes hp-pop2 { from { opacity: 0; transform: translate(-50%, -46%) scale(.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
.hp-step { display: flex; align-items: center; gap: 14px; font: 600 15px/1.25 system-ui, -apple-system, sans-serif; }
.hp-step .hp-pic { flex: none; width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center;
  background: rgb(255 255 255 / .08); color: #fff; }
.hp-signs { display: flex; justify-content: space-between; margin: 8px 0 0 66px; color: ${GHOST_COLOR.note}; }
.hp-sign { display: flex; flex-direction: column; align-items: center; gap: 2px;
  font: 600 9px/1 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .7); }
.hp-sign svg { color: ${GHOST_COLOR.note}; }
.hp-step .hp-num { color: ${ACCENT}; font-weight: 700; margin-right: 2px; }
.hp-count { position: absolute; left: 22px; right: 22px; bottom: -1px; height: 2px; border-radius: 2px;
  background: rgb(255 255 255 / .12); overflow: hidden; }
.hp-count > div { height: 100%; background: ${ACCENT}; transform-origin: 0 50%;
  animation: hp-count var(--hp-count) linear both; }
@keyframes hp-count { from { transform: scaleX(1); } to { transform: scaleX(0); } }
.hp-leave, .hp-leave .hp-howto { animation: hp-out 320ms ${EASE} both; pointer-events: none; }
@keyframes hp-out { to { opacity: 0; } }
.hp-dock.pulse::after { content: ""; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none;
  animation: hp-pulse 1500ms ${EASE} both; }
@keyframes hp-pulse { from { box-shadow: 0 0 0 0 rgb(244 217 104 / .6); }
  to { box-shadow: 0 0 0 22px rgb(244 217 104 / 0); } }
@media (prefers-reduced-motion: reduce) { .hp-howto, .hp-howto-back, .hp-dock.pulse::after { animation: none; } }
`;
const Icon = ({
  children,
  size = 20,
}: {
  children: ReactNode;
  size?: number;
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const CameraIcon = () => (
  <Icon>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);
/** A camera, crossed out. */
const NoCameraIcon = () => (
  <Icon size={18}>
    <path d="M2.5 2.5l19 19" />
    <path d="M9 6h6.5L17 8h3a1 1 0 0 1 1 1v8.5M18 19H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h3" />
    <path d="M10 10.6a3.5 3.5 0 0 0 4.4 4.4" />
  </Icon>
);
const HelpIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6" />
    <circle cx="12" cy="17" r=".6" fill="currentColor" />
  </Icon>
);
const ViewIcon = () => (
  <Icon>
    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Icon>
);
const MoonIcon = () => (
  <Icon>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </Icon>
);

// ---------------------------------------------------------------- how to play

/** A step picture: a 24 grid drawn large, with a lighter line. */
const Pic = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width={40}
    height={40}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/** Two open hands up inside the camera frame. */
const PicHands = () => (
  <Pic>
    <rect x="1.5" y="3.5" width="21" height="17" rx="3" opacity=".5" />
    {[false, true].map((flip) => (
      <path
        key={String(flip)}
        transform={flip ? "translate(24 0) scale(-1 1)" : undefined}
        d="M10.5 17.5H8.2a2.2 2.2 0 0 1-2-1.3L4.6 13a.9.9 0 0 1 1.5-.9l1.2 1.3V8.3a.8.8 0 0 1 1.6 0v3V7a.8.8 0 0 1 1.6 0v4.3"
      />
    ))}
    <path
      d="M10.5 17.5v-6.2a.8.8 0 0 1 1.5 0M13.5 17.5v-6.2a.8.8 0 0 0-1.5 0"
      opacity=".9"
    />
  </Pic>
);
/** An open hand coming down flat onto a field, with rings. */
const PicPat = () => (
  <Pic>
    <ellipse cx="12" cy="19" rx="8" ry="2.6" opacity=".55" />
    <ellipse cx="12" cy="19" rx="10.5" ry="3.6" opacity=".3" />
    <path d="M6 13.5l2.2-6.8a1 1 0 0 1 1.9.6L9 11.5l2.4-8a1 1 0 0 1 1.9.6l-1.8 7.2 3.4-6.4a1 1 0 0 1 1.8.9l-3 6.1 3.7-3.9a1 1 0 0 1 1.5 1.3l-5.2 6.2a4 4 0 0 1-3.3 1.4H9a3 3 0 0 1-3-2.9Z" />
  </Pic>
);
/** A fist: every note stops. */
const PicFist = () => (
  <Pic>
    <path d="M7 10.5V9a1.5 1.5 0 0 1 3 0v-.5a1.5 1.5 0 0 1 3 0V9a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1a5 5 0 0 1-5-5v-4.5Z" />
    <path d="M7 13.5c1.6 0 3.2-.6 4.3-1.7" />
    <path d="M3 4l3 2M21 4l-3 2" opacity=".6" />
  </Pic>
);
/** A finger tapping a field on the screen, or a computer key. */
const PicTouch = () => (
  <Pic>
    <ellipse cx="12" cy="17.5" rx="9" ry="3.5" opacity=".6" />
    <ellipse cx="12" cy="17.5" rx="3" ry="1.3" opacity=".6" />
    <path d="M12 4v8M10 10l2 2 2-2" />
  </Pic>
);

type Step = {
  key: string;
  pic: ReactNode;
  text: ReactNode;
  tint?: string;
  signs?: boolean;
};
const STEPS: Step[] = [
  { key: "hands", pic: <PicHands />, text: "Hold both hands up to the camera" },
  {
    key: "signs",
    pic: <SignIcon sign="two" size={40} />,
    text: "Right hand: hold up a sign to choose a note",
    tint: GHOST_COLOR.note,
    signs: true,
  },
  {
    key: "pat",
    pic: <PicPat />,
    text: "Left hand: pat down with an open palm to play it",
    tint: GHOST_COLOR.strike,
  },
  {
    key: "fist",
    pic: <PicFist />,
    text: "Keep your palm still to let it ring, make a fist to stop",
    tint: GHOST_COLOR.strike,
  },
  { key: "touch", pic: <PicTouch />, text: "Or tap a field, or press 0–6" },
];

// ---------------------------------------------------------------- the dock

const VIEW_MARK: Record<View, string> = { front: "1", player: "2", top: "3" };
const VIEW_LABEL: Record<View, string> = {
  front: "View: Front",
  player: "View: Player",
  top: "View: Top",
};

type DockButton = {
  id: string;
  label: string;
  icon: ReactNode;
  on?: boolean;
  mark?: string;
  act: () => void;
};

export const Hud = () => {
  useHandpanVersion();
  const [tapped, setTapped] = useState<string | null>(null);
  const tapTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(tapTimer.current), []);
  // The first steps card closes by itself; a closing card fades out.
  const until = handpan.howToUntil;
  useEffect(() => {
    if (until === null) return undefined;
    const t = window.setTimeout(
      () => closeHowTo(),
      Math.max(0, until - performance.now()),
    );
    return () => window.clearTimeout(t);
  }, [until]);
  const open = handpan.howTo;
  const [leaving, setLeaving] = useState(false);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current === open) return undefined;
    wasOpen.current = open;
    setLeaving(!open);
    if (open) return undefined;
    const t = window.setTimeout(() => setLeaving(false), 320);
    return () => window.clearTimeout(t);
  }, [open]);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const frame = frameRect(width, height);
  const hidden = handpan.camHidden;
  // No camera picture (none, or refused): the corner says how to play instead.
  const camera = useXRReady();
  const noCamera = handpan.entered && !camera;

  const buttons: DockButton[] = [
    {
      id: "view",
      label: VIEW_LABEL[handpan.view],
      icon: <ViewIcon />,
      mark: VIEW_MARK[handpan.view],
      act: nextView,
    },
    {
      id: "light",
      label: handpan.night ? "Night" : "Day",
      icon: handpan.night ? <MoonIcon /> : <SunIcon />,
      act: () => setNight(!handpan.night),
    },
    {
      id: "howto",
      label: "How to play",
      icon: <HelpIcon />,
      on: handpan.howTo,
      act: () => {
        if (handpan.howTo) {
          closeHowTo();
          return;
        }
        handpan.howTo = true;
        handpan.changed();
      },
    },
  ];

  return (
    <Html
      fullscreen
      calculatePosition={pinToScreen}
      zIndexRange={[30, 0]}
      style={{ pointerEvents: "none" }}
    >
      <style>{CSS}</style>
      <style>{STRIP_CSS}</style>
      <div className="hp-root">
        {noCamera ? (
          <div
            className="hp-nocam hp-glass"
            data-hud="no-camera"
            role="status"
            style={{
              right: GUTTER,
              top: GUTTER,
              width: Math.min(frame.width, 220),
            }}
          >
            <NoCameraIcon />
            <span>No camera: tap the handpan or press 1–6</span>
          </div>
        ) : null}
        <button
          type="button"
          data-hud="camera"
          className={`hp-cam ${hidden || noCamera ? "hp-gone" : ""}`}
          aria-label="Hide your camera"
          style={{
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
          }}
          onClick={toggleCam}
        />
        <button
          type="button"
          data-hud="camera-show"
          className={`hp-btn hp-glass hp-show ${hidden && !noCamera ? "" : "hp-gone"}`}
          aria-label="Show your camera"
          onClick={toggleCam}
        >
          <CameraIcon />
        </button>

        {handpan.howTo || leaving ? (
          <div
            className={`hp-howto-back ${handpan.howTo ? "" : "hp-leave"}`}
            data-hud="howto"
            role="presentation"
            onPointerDown={() => closeHowTo()}
          >
            <div
              className="hp-howto hp-glass"
              role="dialog"
              aria-label="How to play"
            >
              {handpan.howTo && until !== null ? (
                <div
                  className="hp-count"
                  aria-hidden="true"
                  style={
                    {
                      "--hp-count": `${INTRO_CARD_MS}ms`,
                    } as CSSProperties
                  }
                >
                  <div />
                </div>
              ) : null}
              {STEPS.map((st, i) => (
                <div className="hp-step-wrap" key={st.key}>
                  <div className="hp-step">
                    <span
                      className="hp-pic"
                      style={st.tint ? { color: st.tint } : undefined}
                    >
                      {st.pic}
                    </span>
                    <span>
                      <span className="hp-num">{i + 1}</span> {st.text}
                    </span>
                  </div>
                  {st.signs ? (
                    <div className="hp-signs" aria-hidden="true">
                      {SIGN_FIELDS.map((f) => (
                        <span key={f} className="hp-sign">
                          <SignIcon sign={signOf(f)!} size={22} />
                          <span>{f === 0 ? "Ding" : f}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {handpan.entered ? <SignStrip /> : null}

        <div
          className={`hp-dock hp-glass ${handpan.dockPulseAt !== null ? "pulse" : ""}`}
          data-hud="dock"
        >
          {buttons.map((b) => {
            const showTip = tapped === b.id;
            return (
              <button
                key={b.id}
                type="button"
                data-hud={b.id}
                className={`hp-btn ${b.on ? "on" : ""}`}
                aria-label={b.label}
                aria-pressed={b.on}
                onPointerUp={(e) => {
                  // On touch the label shows for a moment after the tap.
                  if (e.pointerType === "mouse") return;
                  setTapped(b.id);
                  window.clearTimeout(tapTimer.current);
                  tapTimer.current = window.setTimeout(
                    () => setTapped(null),
                    TAP_LABEL,
                  );
                }}
                onClick={b.act}
              >
                {b.icon}
                {b.mark ? <span className="hp-mark">{b.mark}</span> : null}
                <span className={`hp-tip hp-glass ${showTip ? "show" : ""}`}>
                  {b.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Html>
  );
};

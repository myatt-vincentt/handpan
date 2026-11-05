// The songs' page UI, on Night glass:
//   - the songs card (from the dock's note button): each song with Learn and
//     Play, its best stars, and Slower for Play
//   - while learning: a card with the next note's sign, big, and its field
//     ("Field 3 · 3 fingers"), how far through the song you are, and a gentle
//     hint after a wrong field
//   - while playing: the next note's sign with a ring that closes on its beat
//   - at the end: the stars (Play) or a tick (Learn), again and next
import { useEffect, useRef, useState, type ReactNode } from "react";

import { sound } from "./audio";
import { GHOST_COLOR } from "./GhostHands";
import { DOCK_BOTTOM, DOCK_HEIGHT } from "./layout";
import { signOf, type FieldId } from "./notes";
import { SignIcon } from "./SignStrip";
import { bestStars, nextSongId, startSong } from "./SongPlayer";
import { CHARTS } from "./songs";
import { handpan, useHandpanVersion } from "./state";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ACCENT = "#f4d968";
const BLUE = GHOST_COLOR.note;
/** The end card stays up this long (ms). */
const STARS_FOR = 6000;
/** A wrong-field hint shows this long (s of the sound clock). */
const HINT_FOR = 1.8;
/** Play: the ring closes over this many beats before a note. */
const RING_BEATS = 2;

export const SONG_CSS = `
.hp-card { position: absolute; pointer-events: auto; border-radius: 18px; padding: 10px;
  display: flex; flex-direction: column; gap: 6px; animation: hp-in 260ms ${EASE} both; }
@keyframes hp-in { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 0); } }
.hp-row { display: flex; align-items: center; gap: 8px; }
.hp-row .hp-title { flex: 1; font: 600 14px/1.2 system-ui, -apple-system, sans-serif; padding-left: 4px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hp-small { pointer-events: auto; border: 1px solid rgb(235 246 253 / .22); background: rgb(255 255 255 / .08);
  color: #fff; border-radius: 999px; height: 32px; padding: 0 12px; cursor: pointer;
  font: 600 12px/1 system-ui, -apple-system, sans-serif; transition: transform 160ms ease-out; }
.hp-small:active { transform: scale(0.95); }
.hp-small.play { background: ${ACCENT}; color: #232528; border-color: transparent; }
.hp-small.on { box-shadow: inset 0 0 0 1.5px ${ACCENT}; color: ${ACCENT}; }
.hp-best { display: flex; gap: 1px; margin-right: 2px; }
.hp-stars { position: absolute; left: 50%; transform: translateX(-50%); pointer-events: auto;
  display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: 22px;
  animation: hp-pop 420ms ${EASE} both; }
@keyframes hp-pop { from { opacity: 0; transform: translate(-50%, 10px) scale(.92); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
.hp-icon { pointer-events: auto; width: 40px; height: 40px; border-radius: 50%; border: 0;
  background: rgb(255 255 255 / .1); color: #fff; display: grid; place-items: center; cursor: pointer;
  transition: transform 160ms ease-out; }
.hp-icon:active { transform: scale(0.94); }
.hp-learn { position: absolute; left: 50%; transform: translateX(-50%); pointer-events: none;
  display: flex; align-items: center; gap: 14px; padding: 12px 18px 16px 12px; border-radius: 22px;
  min-width: 230px; overflow: hidden; animation: hp-pop 360ms ${EASE} both; }
.hp-learn-pic { position: relative; flex: none; width: 66px; height: 66px; border-radius: 18px; display: grid;
  place-items: center; background: rgb(47 140 255 / .16); color: ${BLUE}; }
.hp-learn-pic.next { animation: hp-next 420ms ${EASE} both; }
@keyframes hp-next { from { transform: scale(.88); opacity: .4; } to { transform: scale(1); opacity: 1; } }
.hp-learn-text { display: flex; flex-direction: column; gap: 4px; }
.hp-learn-title { font: 650 17px/1.15 system-ui, -apple-system, sans-serif; white-space: nowrap; }
.hp-learn-sub { font: 500 12px/1.3 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .62); }
.hp-learn-sub.hint { color: ${ACCENT}; }
.hp-learn-bar { position: absolute; left: 14px; right: 14px; bottom: 7px; height: 3px; border-radius: 3px;
  background: rgb(255 255 255 / .12); overflow: hidden; }
.hp-learn-bar > div { height: 100%; background: ${ACCENT}; transform-origin: 0 50%;
  transition: transform 300ms ${EASE}; }
.hp-ring { position: absolute; inset: -4px; border-radius: 22px; pointer-events: none;
  border: 2px solid ${ACCENT}; opacity: 0; }
@media (prefers-reduced-motion: reduce) { .hp-card, .hp-stars, .hp-learn, .hp-learn-pic.next { animation: none; } }
`;

/** What each sign field is called on the cards. */
export const FIELD_CALL: Record<number, string> = {
  0: "Ding · fist",
  1: "Field 1 · 1 finger",
  2: "Field 2 · 2 fingers",
  3: "Field 3 · 3 fingers",
  4: "Field 4 · 4 fingers",
  5: "Field 5 · open hand",
  6: "Field 6 · rock",
};
const fieldName = (f: FieldId) => (f === 0 ? "the Ding" : `field ${f}`);

const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width={20}
    height={20}
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
export const NoteIcon = () => (
  <Icon>
    <path d="M9 18V5l11-2v13" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </Icon>
);
export const StopIcon = () => (
  <Icon>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
  </Icon>
);
const Star = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" width={34} height={34} aria-hidden="true">
    <path
      d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"
      fill={on ? ACCENT : "rgb(255 255 255 / .18)"}
      stroke={on ? ACCENT : "rgb(255 255 255 / .45)"}
      strokeWidth={1.2}
      strokeLinejoin="round"
    />
  </svg>
);
const SmallStar = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" width={11} height={11} aria-hidden="true">
    <path
      d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"
      fill={on ? ACCENT : "rgb(255 255 255 / .22)"}
    />
  </svg>
);
const TickIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width={34}
    height={34}
    fill="none"
    stroke={ACCENT}
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9.5" strokeOpacity=".45" />
    <path d="M7.5 12.5l3 3 6-7" />
  </svg>
);
const AgainIcon = () => (
  <Icon>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4.5h4.5" />
  </Icon>
);
const NextIcon = () => (
  <Icon>
    <path d="M6 5.5l9 6.5-9 6.5z" fill="currentColor" />
    <path d="M18 5v14" />
  </Icon>
);

/** Where the cards sit: above the strip on a wide screen, under the corner camera on a tall one. */
type Place = { tall: boolean; underCamera: number };

const songCardStyle = ({ tall, underCamera }: Place) =>
  tall
    ? {
        left: "50%",
        transform: "translateX(-50%)",
        top: underCamera,
        width: "calc(100% - 32px)",
        maxWidth: 380,
      }
    : {
        left: "50%",
        transform: "translateX(-50%)",
        bottom: `calc(env(safe-area-inset-bottom, 0px) + ${DOCK_BOTTOM + DOCK_HEIGHT + 12}px)`,
        minWidth: 340,
      };

/** The songs card. */
const SongCard = ({ place }: { place: Place }) => {
  const best = bestStars();
  return (
    <div
      className="hp-card hp-glass"
      data-hud="song-card"
      style={songCardStyle(place)}
    >
      {CHARTS.map((c) => (
        <div className="hp-row" key={c.id}>
          <span className="hp-title">{c.title}</span>
          <span
            className="hp-best"
            aria-label={`Best: ${best[c.id] ?? 0} of 3 stars`}
          >
            {[1, 2, 3].map((i) => (
              <SmallStar key={i} on={i <= (best[c.id] ?? 0)} />
            ))}
          </span>
          <button
            type="button"
            className="hp-small"
            data-hud={`learn-${c.id}`}
            onClick={() => startSong(c.id, "learn")}
          >
            Learn
          </button>
          <button
            type="button"
            className="hp-small play"
            data-hud={`play-${c.id}`}
            onClick={() => startSong(c.id, "play")}
          >
            Play
          </button>
        </div>
      ))}
      <div className="hp-row" style={{ justifyContent: "flex-end" }}>
        <button
          type="button"
          className={`hp-small ${handpan.slow ? "on" : ""}`}
          data-hud="slower"
          aria-pressed={handpan.slow}
          onClick={() => {
            handpan.slow = !handpan.slow;
            handpan.changed();
          }}
        >
          Slower
        </button>
      </div>
    </div>
  );
};

/** The card for the note a song wants next (Learn and Play). */
const NoteCard = ({ place }: { place: Place }) => {
  const s = handpan.session!;
  const note = s.chart.notes[s.next];
  const ring = useRef<HTMLDivElement>(null);
  const [, tick] = useState(0);
  // Play: the ring closes on the note's beat; Learn: the hint fades.
  useEffect(() => {
    let raf = 0;
    let hinted = false;
    const loop = () => {
      const ses = handpan.session;
      if (ses && ring.current) {
        const n = ses.chart.notes[ses.next];
        if (ses.mode === "play" && n) {
          const k = Math.min(1, Math.max(0, (n.beat - ses.beat) / RING_BEATS));
          ring.current.style.opacity = String(k < 1 ? 0.9 * (1 - k) + 0.1 : 0);
          ring.current.style.transform = `scale(${1 + 0.35 * k})`;
        } else ring.current.style.opacity = "0";
      }
      // A hint ending re-draws the card.
      const w = ses?.wrong;
      const showing = !!w && (sound.now() ?? 0) - w.at < HINT_FOR;
      if (hinted && !showing) tick((x) => x + 1);
      hinted = showing;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!note) return null;
  const sign = signOf(note.field)!;
  const { wrong } = s;
  const clock = sound.now() ?? 0;
  const hint =
    wrong !== null && s.mode === "learn" && clock - wrong.at < HINT_FOR
      ? wrong
      : null;
  const total = s.chart.notes.length;
  return (
    <div
      className="hp-learn hp-glass"
      data-hud="note-card"
      style={{ top: place.tall ? place.underCamera : 16 }}
      role="status"
      aria-live="polite"
    >
      <div className="hp-learn-pic next" key={`${s.next}`}>
        <SignIcon sign={sign} size={52} />
        <div className="hp-ring" ref={ring} />
      </div>
      <div className="hp-learn-text">
        <span className="hp-learn-title">{FIELD_CALL[note.field]}</span>
        {hint ? (
          <span className="hp-learn-sub hint">
            That was {fieldName(hint.field)}: show{" "}
            {FIELD_CALL[note.field].split(" · ")[1]}
          </span>
        ) : (
          <span className="hp-learn-sub">
            {s.mode === "learn"
              ? `Show the sign, then pat · ${s.next + 1} of ${total}`
              : `${s.chart.title} · ${s.next + 1} of ${total}`}
          </span>
        )}
      </div>
      <div className="hp-learn-bar" aria-hidden="true">
        <div style={{ transform: `scaleX(${s.progress})` }} />
      </div>
    </div>
  );
};

/** The end of a song: stars (Play) or a tick (Learn), again and next. */
const FinishCard = ({ place }: { place: Place }) => {
  const f = handpan.finish!;
  return (
    <div
      data-hud="stars"
      className="hp-stars hp-glass"
      style={{ top: place.tall ? place.underCamera : "14%" }}
    >
      {f.mode === "play" ? (
        <span
          className="hp-row"
          style={{ gap: 4 }}
          aria-label={`${f.stars} of 3 stars`}
        >
          {[1, 2, 3].map((i) => (
            <Star key={i} on={i <= f.stars} />
          ))}
        </span>
      ) : (
        <span aria-label="Learnt">
          <TickIcon />
        </span>
      )}
      <button
        type="button"
        className="hp-icon"
        data-hud="again"
        aria-label="Again"
        onClick={() => startSong(f.id, f.mode)}
      >
        <AgainIcon />
      </button>
      <button
        type="button"
        className="hp-icon"
        data-hud="next"
        aria-label="Next"
        onClick={() => startSong(nextSongId(f.id), f.mode)}
      >
        <NextIcon />
      </button>
    </div>
  );
};

export const SongCards = ({
  tall,
  underCamera,
}: {
  tall: boolean;
  underCamera: number;
}) => {
  useHandpanVersion();
  const [, tick] = useState(0);
  const finishedAt = handpan.finish?.at ?? null;
  useEffect(() => {
    if (finishedAt === null) return undefined;
    const t = window.setTimeout(() => tick((n) => n + 1), STARS_FOR);
    return () => window.clearTimeout(t);
  }, [finishedAt]);
  const place = { tall, underCamera };
  const showFinish =
    handpan.finish !== null &&
    !handpan.session &&
    performance.now() - handpan.finish.at < STARS_FOR;
  return (
    <>
      {handpan.songCard && !handpan.session ? <SongCard place={place} /> : null}
      {handpan.session ? <NoteCard place={place} /> : null}
      {showFinish ? <FinishCard place={place} /> : null}
    </>
  );
};

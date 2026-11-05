// The strike hand's pats, read from where its palm is on the camera picture.
// Plain code (no scene).
//
// A pat: the palm moves down quickly, then stops or turns back up. It plays
// at the bottom, as loud as the palm was fast at its quickest; a small pat
// still plays, quietly. Speeds and distances are in palm lengths (the hand's
// own size on the picture), so near or far, big hand or small, it feels the
// same. After a pat the palm only has to lift a little, or rest a moment, to
// pat again, so quick repeated pats all play. A slow drift down never plays,
// nor does a sweep that goes more sideways than down.
//
// The tracker loses a fast hand now and then (motion blur): if the palm was
// on its way down, or vanishes for a moment and comes back clearly lower, that
// is a pat too.
//
// A fist held a moment damps every ringing note; so does losing the hand for
// a while.

/** Speeds (palm lengths per second) and distances (palm lengths). */
export const PAT = {
  /** Faster than this, down, starts a pat. */
  start: 1.8,
  /** Slower than this (or going up) ends it: it plays. */
  stop: 0.6,
  /** A pat goes down at least this far. */
  travel: 0.12,
  /** It goes down more than sideways (down ÷ sideways at least this). */
  downShare: 0.8,
  /** Speed → loudness: this slow is the quietest, this fast the loudest. */
  quiet: 1.8,
  loud: 18,
  /** The quietest pat's loudness. */
  floor: 0.25,
  /** After a pat: a lift this high, or a rest this long (s), and it can pat again. */
  relift: 0.08,
  rest: 0.1,
  /** A pat lasting longer than this (s) without stopping is a slow move, not a pat. */
  longest: 0.6,
  /** Speed smoothing (s). */
  smooth: 0.03,
};
/** Lost for at most this long (s) and back lower by this much (palm lengths): a pat. */
export const GAP = { most: 0.3, drop: 0.25 };
/** A fist held this long (s) damps; the hand lost this long (s) damps too. */
export const DAMP = { fist: 0.12, lost: 0.5 };

export type PalmReading = {
  /** Seconds. */
  t: number;
  /** The palm's centre on the picture (screen heights, y up). */
  x: number;
  y: number;
  /** The palm's length on the picture (screen heights). */
  size: number;
  /** The hand is a fist. */
  fist: boolean;
};

export type PatEvent =
  | { kind: "pat"; t: number; velocity: number; speed: number }
  | { kind: "damp"; t: number };

/** Speed → loudness (0..1). */
export const patVelocity = (speed: number) => {
  const k = Math.min(
    1,
    Math.max(0, (speed - PAT.quiet) / (PAT.loud - PAT.quiet)),
  );
  return PAT.floor + (1 - PAT.floor) * k ** 0.8;
};

type Phase = "armed" | "falling" | "spent";

export class PatReader {
  private last: PalmReading | null = null;

  /** Smoothed speed down (palm lengths / s). */
  private down = 0;

  private phase: Phase = "armed";

  /** The fall: where and when it began, its quickest speed, how far sideways. */
  private fall = { t: 0, y: 0, x: 0, peak: 0 };

  /** After a pat: its lowest point, and when the palm last moved. */
  private bottom = { y: 0, still: 0 };

  private fistSince: number | null = null;

  private damped = false;

  /** Where the palm usually rests (y), for how lifted it is now. */
  private rest: number | null = null;

  /** How far above its usual height the palm is (palm lengths, ≥ 0). */
  lift = 0;

  /** Is the hand being followed? */
  get tracked() {
    return this.last !== null;
  }

  /** A reading of the palm; returns what happened. */
  push(r: PalmReading): PatEvent[] {
    const out: PatEvent[] = [];
    const size = Math.max(0.02, r.size);
    const prev = this.last;

    // The fist damps once, after a moment.
    if (r.fist) {
      if (this.fistSince === null) this.fistSince = r.t;
      if (!this.damped && r.t - this.fistSince >= DAMP.fist) {
        this.damped = true;
        out.push({ kind: "damp", t: r.t });
      }
      this.phase = "armed";
      this.down = 0;
      this.last = r;
      return out;
    }
    this.fistSince = null;
    this.damped = false;

    // How lifted the palm is (its usual height follows slowly).
    this.rest =
      this.rest === null
        ? r.y
        : this.rest + (Math.min(r.y, this.rest + size) - this.rest) * 0.02;
    if (r.y < this.rest) this.rest = r.y;
    this.lift = Math.max(0, (r.y - this.rest) / size);

    if (!prev) {
      this.last = r;
      return out;
    }
    const dt = r.t - prev.t;
    if (dt <= 0) return out;

    // Back after a short loss, clearly lower: a pat (blurred on the way down).
    if (dt > 0.07 && dt <= GAP.most) {
      const drop = (prev.y - r.y) / size;
      if (drop >= GAP.drop && this.phase !== "spent") {
        const speed = drop / dt;
        out.push({
          kind: "pat",
          t: r.t,
          velocity: patVelocity(Math.max(speed, this.fall.peak)),
          speed,
        });
        this.toSpent(r);
        this.last = r;
        return out;
      }
    }

    const vNow = (prev.y - r.y) / size / dt;
    const k = 1 - Math.exp(-dt / PAT.smooth);
    this.down += (vNow - this.down) * k;
    // A sudden stop shows at once (the bottom of a pat is a sharp turn).
    if (vNow < PAT.stop) this.down = Math.min(this.down, vNow);

    if (this.phase === "spent") {
      this.bottom.y = Math.min(this.bottom.y, r.y);
      if (Math.abs(vNow) > PAT.stop) this.bottom.still = r.t;
      const lifted = (r.y - this.bottom.y) / size >= PAT.relift;
      const rested = r.t - this.bottom.still >= PAT.rest;
      if (lifted || rested) this.phase = "armed";
    }
    if (this.phase === "armed" && this.down >= PAT.start) {
      this.phase = "falling";
      this.fall = { t: prev.t, y: prev.y, x: prev.x, peak: this.down };
    }
    if (this.phase === "falling") {
      this.fall.peak = Math.max(this.fall.peak, this.down, vNow);
      if (this.down < PAT.stop) {
        const travel = (this.fall.y - r.y) / size;
        const side = Math.abs(r.x - this.fall.x) / size;
        const isPat = travel >= PAT.travel && travel >= side * PAT.downShare;
        if (isPat)
          out.push({
            kind: "pat",
            t: r.t,
            velocity: patVelocity(this.fall.peak),
            speed: this.fall.peak,
          });
        if (isPat) this.toSpent(r);
        else this.phase = "armed";
      } else if (r.t - this.fall.t > PAT.longest) {
        this.phase = "armed";
        this.down = 0;
      }
    }
    this.last = r;
    return out;
  }

  /**
   * No reading this frame, the hand unseen for `lostFor` (s): a long loss
   * damps and forgets the hand.
   */
  missing(t: number, lostFor: number): PatEvent[] {
    if (this.last && lostFor > DAMP.lost) {
      this.last = null;
      this.phase = "armed";
      this.down = 0;
      this.rest = null;
      this.lift = 0;
      this.fistSince = null;
      this.damped = false;
      return [{ kind: "damp", t }];
    }
    return [];
  }

  private toSpent(r: PalmReading) {
    this.phase = "spent";
    this.bottom = { y: r.y, still: r.t };
    this.down = 0;
    this.fall.peak = 0;
  }
}

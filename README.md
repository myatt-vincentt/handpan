# Handpan

A steel handpan on a low stand in a recording studio, played with your hands. Your right hand
shows a sign to choose a note; your left hand pats to play it. A gold ghost hand pats the
handpan with you, the chosen note glows blue, a played note flashes gold with ripples, and the
studio's LED strips glow in the note's colour. Your camera sits small in the top right corner.

- **Start:** the home page shows while the studio, the handpan and the sounds load; Start turns
  the sound on and asks for the camera. Without a camera the studio opens anyway and you play
  by tapping the handpan or with the keyboard.
- **Right hand, the note:** hold up a sign for about a moment: fist for the Ding (the centre,
  D3), 1, 2, 3 or 4 fingers for notes 1 to 4, open hand for 5, rock (index and pinky) for 6.
  Every note is in one scale, so anything you play sounds good together.
- **Left hand, the strike:** pat down with an open palm to play the chosen note; a firmer pat is
  louder. Keep the palm still to let it ring; make a fist to stop all ringing.
- **Songs:** the music-note button opens the song card (Hot Cross Buns, Mary Had a Little Lamb,
  and two grooves). **Learn** waits for each note; **Play** keeps time with a soft drone and
  shaker and gives 1 to 3 stars; **Slower** plays at three-quarter speed.
- **Without hands:** tap or click a note, a chip in the sign strip, or keys 1–6 (0 or Space for
  the Ding, 7 and 8 for the two small notes).
- **The dock:** Songs, View (Front, Player, Top), Day / Night, How to play.

## Files

```
src/handpan/
  HandpanScene.tsx  the scene, loaded after the home page shows
  Home.tsx          the home page
  Hud.tsx           the dock and the how-to-play card
  CameraRig.tsx     the views, fitted to the screen (layout.ts)
  Studio.tsx        the room, its baked day / night light and the LEDs (led.ts)
  Handpan.tsx       the handpan, its stands, the glowing notes and the ripples
  GhostHands.tsx    the gold strike hand (ghost.ts)
  Hands.tsx         hand tracking: signs (signs.ts) and pats (pat.ts)
  SignStrip.tsx     the seven sign chips
  SongCards.tsx, SongPlayer.tsx, session.ts, songs.ts, Sparkles.tsx   Learn and Play
  audio.ts          the recorded handpan, with a made-in-code tone as fallback
  PointerInput.tsx  taps, clicks and keys
  CameraFrame.tsx   your camera in the corner
public/models/      the studio and its bakes, the handpan and the strike hand
public/sounds/      the handpan samples (handpan.json lists them)
```

Credits are in `CREDITS.md`.

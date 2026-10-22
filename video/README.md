# Demo video

`out/chog-break-demo.mp4` (1080p30, 2:08) is built from the real game, not mock-ups. Rebuild it from the repo root:

1. `npm run build && npx vite preview --port 4181` (the captures use the production build)
2. Footage: `node video/capture.mjs <shot>` for `lab`, `swap`, `fight` (`SECONDS=75`), `notebook`, `phone`.
   UI shots step Chrome's virtual time one frame at a time; the arena is stepped by hand (`game.step`). The game's
   own sound effects are recorded sample-exact into `<shot>.sfx.wav` (every AudioContext becomes one
   OfflineAudioContext whose clock is the capture clock).
3. Music: `node video/music.mjs` (needs the dev server on :5173) renders the game's lab and arena tracks offline.
4. On-chain numbers: `node video/receipt.mjs` reads the first mainnet Recorded Splice receipt from Monad RPC.
5. Voice-over: `python video/vo/make_vo.py` (Microsoft neural voice via edge-tts) and `python video/vo/words.py`.
6. Motion graphics: `node video/gfx/render.mjs <scene>` for `open`, `genes`, `fightfx`, `pairs`, `onchain`, `phone`,
   `close`. Each scene in `gfx/scenes.js` is a pure function of time, timed to `vo/vo.json` and `vo/words.json`.
7. Edit: `python video/edit.py` (`REUSE=1` keeps built clips, `PICTURE=keep` redoes only the sound).

Chogs whose art prints crude words (a few caps and shirts) are left out of the walls and kept out of frame.

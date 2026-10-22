# Word timings for the lines whose on-screen graphics hit individual words (edge-tts WordBoundary events).
#   python video/vo/words.py  → video/vo/words.json  {line index: [[word, seconds from the line's first word], ...]}
import asyncio, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from make_vo import LINES, VOICE, RATE  # noqa: E402  (make_vo only runs main() under __main__)

WANT = [0, 17, 20, 27, 34, 35]

async def bounds(text):
    import edge_tts
    c = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    out = []
    async for ch in c.stream():
        if ch["type"] == "WordBoundary":
            out.append([ch["text"], ch["offset"] / 1e7])
    t0 = out[0][1]
    return [[w, round(t - t0, 3)] for w, t in out]

async def main():
    res = {}
    for i in WANT:
        for attempt in range(5):
            try:
                res[i] = await bounds(LINES[i][1]); break
            except Exception as e:
                print(i, type(e).__name__, file=sys.stderr); await asyncio.sleep(3 + attempt * 3)
    json.dump(res, open(os.path.join(os.path.dirname(__file__), "words.json"), "w"), indent=1)
    for i, ws in res.items(): print(i, ws)

asyncio.run(main())

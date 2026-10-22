# Builds the demo voice-over sentence by sentence (Microsoft neural voice via edge-tts), with hand-set pauses,
# and writes vo.wav plus vo.json (each line's start/end, used to time the edit).
#   python video/vo/make_vo.py
import asyncio, json, os, subprocess, sys

VOICE = "en-US-AndrewMultilingualNeural"
RATE = "-4%"
HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(HERE, "gen")

# (section, text, pause after in ms)
LINES = [
    ("open", "There are one thousand, nine hundred and sixty-nine Chog Genesis NFTs.", 450),
    ("open", "We stopped treating them as pictures,", 180),
    ("open", "and started treating them as genetic material.", 1000),
    ("lab", "This is the Lab.", 300),
    ("lab", "Every real Chog is in here, searchable by its actual traits.", 450),
    ("lab", "I'll take one wearing a crown,", 250),
    ("lab", "and one with laser eyes.", 900),
    ("splice", "Splice.", 1500),
    ("splice", "The lab fails, loudly, and something walks out.", 500),
    ("splice", "Laser eyes plus a crown is one of sixteen secret recipes.", 300),
    ("splice", "This is King Beam.", 1000),
    ("genes", "Every trait comes from one of the two parents, and every real trait is a gene.", 400),
    ("genes", "The laser eyes became a charged beam.", 250),
    ("genes", "The crown makes it harder to knock away.", 450),
    ("genes", "Same pair, same mutant. On any device, forever.", 1000),
    ("fight", "Then you fight it.", 600),
    ("fight", "It's a party brawler.", 250),
    ("fight", "Hits raise damage, damage makes you fly further, and you win by knocking the other one off the stage.", 400),
    ("fight", "Your moves come from your parents' traits.", 800),
    ("arena", "And the arena mutates too.", 300),
    ("arena", "The Chogs' backgrounds pick the rules: low gravity, bouncy floors, a toxic floor, meteors.", 350),
    ("arena", "They hit both fighters, so an NFT changes the game without buying power.", 1000),
    ("notebook", "Every experiment lands in your notebook.", 300),
    ("notebook", "Swap one parent, and you get a different creature, different moves, a different fight.", 400),
    ("notebook", "There are almost two million pairs to try.", 1000),
    ("onchain", "If you want the credit, record it on Monad.", 300),
    ("onchain", "The first person to record a pair is its discoverer, permanently.", 450),
    ("onchain", "The small chog fee is split on the spot: thirty-five percent to the owner of each parent.", 300),
    ("onchain", "So a popular Chog earns for its holder.", 500),
    ("onchain", "And your first recording is on us.", 250),
    ("onchain", "Sign a message, and we pay the fee and the gas.", 1000),
    ("phone", "You don't need a wallet to play.", 250),
    ("phone", "It runs in the browser, on your laptop or your phone.", 1000),
    ("close", "One thousand, nine hundred and sixty-nine Chogs.", 350),
    ("close", "Millions of experiments.", 650),
    ("close", "Splice. Break. Repeat.", 1500),
]
LEAD_IN_MS = 600


async def synth(i, text):
    import edge_tts
    out = os.path.join(GEN, f"{i:02d}.mp3")
    for attempt in range(6):
        if os.path.exists(out) and os.path.getsize(out) > 2000:
            return out
        try:
            await edge_tts.Communicate(text, VOICE, rate=RATE).save(out)
        except Exception as e:  # the free endpoint throttles; back off and retry
            print(f"line {i}: {type(e).__name__}, retry {attempt + 1}", file=sys.stderr)
            if os.path.exists(out):
                os.remove(out)
            await asyncio.sleep(4 + attempt * 4)
    raise SystemExit(f"line {i} failed after retries")


def dur(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    return float(r.stdout.strip())


async def main():
    os.makedirs(GEN, exist_ok=True)
    files = [await synth(i, t) for i, (_, t, _) in enumerate(LINES)]
    # 48 kHz mono WAV per line, trimmed of the TTS's own leading/trailing silence so our pauses are exact
    wavs, timeline, t = [], [], LEAD_IN_MS / 1000
    for i, f in enumerate(files):
        w = os.path.join(GEN, f"{i:02d}.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f, "-af",
                        "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
                        "-ar", "48000", "-ac", "1", w], check=True)
        d = dur(w)
        sec, text, pause = LINES[i]
        timeline.append({"i": i, "section": sec, "text": text, "start": round(t, 3), "end": round(t + d, 3)})
        wavs.append((w, pause))
        t += d + pause / 1000
    # assemble with exact silences
    parts, inputs = [], []
    lead = os.path.join(GEN, "lead.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=mono", "-t", str(LEAD_IN_MS / 1000), lead], check=True)
    seq = [lead]
    for w, pause in wavs:
        seq.append(w)
        s = os.path.join(GEN, f"sil{pause}.wav")
        if not os.path.exists(s):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", str(pause / 1000), s], check=True)
        seq.append(s)
    lst = os.path.join(GEN, "list.txt")
    with open(lst, "w") as fh:
        fh.write("".join(f"file '{p.replace(os.sep, '/')}'\n" for p in seq))
    raw = os.path.join(GEN, "vo_raw.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", raw], check=True)
    # gentle voice polish: high-pass, light compression, broadcast loudness
    out = os.path.join(HERE, "vo.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af",
                    "highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=5:release=80,loudnorm=I=-16:TP=-1.5:LRA=7",
                    "-ar", "48000", out], check=True)
    with open(os.path.join(HERE, "vo.json"), "w") as fh:
        json.dump({"voice": VOICE, "duration": round(dur(out), 3), "lines": timeline}, fh, indent=1)
    print("vo.wav", round(dur(out), 2), "s,", len(LINES), "lines")


if __name__ == "__main__":
    asyncio.run(main())

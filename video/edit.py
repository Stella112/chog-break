# Assembles the demo video from the captured footage, the motion graphics, the voice-over, the game's own music
# and the game's own sound effects. Times are seconds on the final timeline and come from vo/vo.json.
#   python video/edit.py  → video/out/chog-break-demo.mp4
import json, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
F = lambda *p: os.path.join(HERE, "footage", *p)
OUT = os.path.join(HERE, "out")
TMP = os.path.join(OUT, "tmp")
os.makedirs(TMP, exist_ok=True)
FPS = 30
FIGHT_SS = float(os.environ.get("FIGHT_SS", "16.9"))  # where in the fight footage the fight section starts


REUSE = os.environ.get("REUSE") == "1"  # keep clips already built in out/tmp (faster re-edits)


def run(args):
    if REUSE and args[-1].endswith(".mp4") and os.path.basename(args[-1]).startswith("s") and os.path.exists(args[-1]):
        return
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", *args], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit("ffmpeg failed: " + args[-1] + "\n" + r.stderr[:1200])


V = "fps=30,scale=1920:1080:flags=lanczos:out_range=tv,setsar=1,format=yuv420p"  # TV range: the JPEG frames are full range


def clip(name, src, ss, dur, pad=0.0, extra=""):
    """exact-length 1080p30 clip; pad = seconds of the first frame held before it"""
    out = os.path.join(TMP, f"{name}.mp4")
    vf = V + (f",tpad=start_duration={pad}:start_mode=clone" if pad else "") + f",tpad=stop_duration=5:stop_mode=clone,trim=duration={dur}" + extra
    run(["-ss", str(ss), "-i", src, "-vf", vf, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "12", out])
    return out


def overlay(name, base, ov, at=0.0):
    """alpha overlay (gfx .mov) on a clip, starting `at` seconds into the clip"""
    out = os.path.join(TMP, f"{name}.mp4")
    run(["-i", base, "-itsoffset", str(at), "-i", ov, "-filter_complex", "[0][1]overlay=eof_action=pass:format=auto," + "format=yuv420p",
         "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "12", out])
    return out


# ---------- picture ----------
# (clip, start on the final timeline); consecutive clips overlap by the crossfade length given with the later one
S = []
S.append((clip("s1_open", F("gfx-open.mp4"), 0, 13.4), 0.0, 0))
S.append((clip("s2_lab", F("lab.mp4"), 0, 23.4, pad=1.75), 13.0, 0.4))  # SPLICE click lands at 22.35, on "Splice."
S.append((clip("s3_genes", F("gfx-genes.mp4"), 0, 14.0), 36.0, 0.4))
fight = clip("s4_fight_raw", F("fight.mp4"), FIGHT_SS, 26.1)
S.append((overlay("s4_fight", fight, F("gfx-fightfx.mov"), at=0.2), 49.7, 0.3))  # labels are timed from 49.9
S.append((clip("s5_notebook", F("notebook.mp4"), 0, 2.9), 75.8, 0))
S.append((clip("s6a_swap", F("swap.mp4"), 3.0, 2.2), 78.7, 0))  # from just after parent B is picked
swapb = clip("s6b_swap_raw", F("swap.mp4"), 9.0, 6.1)
S.append((overlay("s6b_swap", swapb, F("gfx-pairs.mov"), at=2.5), 80.9, 0))  # count starts at 83.4
S.append((clip("s7_onchain", F("gfx-onchain.mp4"), 0, 22.1), 86.7, 0.3))  # +0.3 s for the crossfade into the phone
# phone: the real phone footage sits in the frame's transparent screen
phone = os.path.join(TMP, "s8_phone.mp4")
run(["-f", "lavfi", "-i", "color=c=0x0b0a10:s=1920x1080:r=30:d=5.8", "-ss", "0.5", "-i", F("phone.mp4"), "-i", F("gfx-phone.mov"),
     "-filter_complex", "[1]fps=30,scale=1160:652,trim=duration=5.8,setpts=PTS-STARTPTS[p];[0][p]overlay=380:300[b];[b][2]overlay=format=auto,format=yuv420p",
     "-t", "5.8", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "12", phone])
S.append((phone, 108.5, 0.3))
S.append((clip("s9_close", F("gfx-close.mp4"), 0, 13.6), 114.0, 0.3))
TOTAL = 114.0 + 13.6


def dur(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True)
    return float(r.stdout.strip())


# chain with xfade (or a hard cut when the crossfade is 0)
inputs, fc, prev, acc = [], [], "[n0]", None
for i, (p, start, xf) in enumerate(S):
    inputs += ["-i", p]
    fc.append(f"[{i}:v]scale=out_range=tv,format=yuv420p,setsar=1,settb=1/15360[n{i}]")
    if i == 0:
        acc = dur(p)
        continue
    lab = f"[v{i}]"
    if xf:
        fc.append(f"{prev}[{i}:v]xfade=transition=fade:duration={xf}:offset={start:.3f}{lab}".replace(f"[{i}:v]", f"[n{i}]"))
    else:
        # hard cut: trim what came before to the cut point, then concat
        fc.append(f"{prev}trim=duration={start:.3f},setpts=PTS-STARTPTS[c{i}];[c{i}][{i}:v]concat=n=2:v=1:a=0,fps=30,settb=1/15360{lab}".replace(f"[{i}:v]", f"[n{i}]"))
    prev = lab
picture = os.path.join(TMP, "picture.mp4")
fc.append(f"{prev}trim=duration={TOTAL},noise=alls=3:allf=t,format=yuv420p[vout]")
if not (os.environ.get("PICTURE") == "keep" and os.path.exists(picture)):
    run([*inputs, "-filter_complex", ";".join(fc), "-map", "[vout]", "-c:v", "libx264", "-preset", "slow", "-crf", "16", picture])

# ---------- sound ----------
# game sound effects, cut exactly like the picture they belong to
sfx = [
    (F("lab.sfx.wav"), 0, 21.65, 14.75),           # lab footage frame 0 sits at 14.75
    (F("fight.sfx.wav"), FIGHT_SS, 26.1, 49.7),
    (F("swap.sfx.wav"), 3.0, 2.2, 78.7),
    (F("swap.sfx.wav"), 9.0, 4.5, 80.9),
]
music_lab, music_arena = F("music", "lab.wav"), F("music", "arena.wav")
ai = ["-i", os.path.join(HERE, "vo", "vo.wav"), "-i", music_lab, "-i", music_arena] + sum([["-i", s[0]] for s in sfx], [])
fa = [
    f"[0]aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur={TOTAL},asplit=2[vo][key]",  # padded: the ducker stops when its key ends
    # the lab theme, the arena theme under the fight, then the lab theme again; faded and kept well under the voice
    "[1]loudnorm=I=-20:TP=-3,asplit=2[l1][l2]",
    "[l1]atrim=0:50.2,afade=t=in:d=1.5,afade=t=out:st=49.4:d=0.8[m1]",
    "[2]loudnorm=I=-20:TP=-3,atrim=0:26.6,afade=t=in:d=0.5,afade=t=out:st=25.6:d=1.0,adelay=49700|49700[m2]",
    f"[l2]atrim=50:{50 + TOTAL - 75.6:.2f},asetpts=PTS-STARTPTS,afade=t=in:d=1.0,afade=t=out:st={TOTAL - 75.6 - 2.5:.2f}:d=2.5,adelay=75600|75600[m3]",
    "[m1][m2][m3]amix=inputs=3:normalize=0,volume=0.55[mus]",
    "[mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]",
]
for i, (p, ss, d, at) in enumerate(sfx):
    ms = int(at * 1000)
    fa.append(f"[{3 + i}]atrim={ss}:{ss + d},asetpts=PTS-STARTPTS,afade=t=out:st={max(0, d - 0.25)}:d=0.25,volume=2.4,adelay={ms}|{ms}[s{i}]")
fa.append("[vo][duck]" + "".join(f"[s{i}]" for i in range(len(sfx))) + f"amix=inputs={2 + len(sfx)}:normalize=0,atrim=0:{TOTAL},alimiter=limit=0.89:attack=2:release=60,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
mix = os.path.join(TMP, "mix.wav")
run([*ai, "-filter_complex", ";".join(fa), "-map", "[aout]", "-ar", "48000", mix])

final = os.path.join(OUT, "chog-break-demo.mp4")
run(["-i", picture, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", final])
print(final, round(dur(final), 2), "s")

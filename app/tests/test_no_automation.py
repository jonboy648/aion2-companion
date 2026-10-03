"""Hard rule: the app never sends input to the game or reads game memory/packets."""
import re
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent
SELF = Path(__file__).resolve()

FORBIDDEN = [
    "SendInput", "keybd_event", "mouse_event", "pyautogui", "pynput", "pydirectinput",
    "import keyboard", "import mouse", "win32api", "interception", "ahk", "autoit",
    "ReadProcessMemory", "WriteProcessMemory", "OpenProcess", "scapy", "pydivert",
    "PostMessage", "SendMessage",
]
PATTERNS = [(w, re.compile(r"\b" + re.escape(w) + r"\b")) for w in FORBIDDEN]


def source_files(root: Path = APP_ROOT) -> list[Path]:
    files = list(root.glob("aion2c/**/*.py")) + list(root.glob("scripts/*.ps1"))
    return [f for f in files if f.resolve() != SELF]


def scan(files: list[Path]) -> list[tuple[str, str]]:
    hits = []
    for f in files:
        text = f.read_text(encoding="utf-8", errors="replace")
        for word, rx in PATTERNS:
            if rx.search(text):
                hits.append((str(f), word))
    return hits


def test_no_automation_apis():
    files = source_files()
    assert len(files) > 30, f"only {len(files)} files scanned"
    assert scan(files) == []


def test_scanner_flags_sendinput(tmp_path):
    bad = tmp_path / "bad.py"
    bad.write_text("ctypes.windll.user32.SendInput(1, 0, 0)\n", encoding="utf-8")
    assert ("SendInput" in [w for _, w in scan([bad])])

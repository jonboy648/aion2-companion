"""Global hotkey (receive only). P6 owns the file; W0 wrote parse_hotkey."""

MOD_ALT, MOD_CONTROL, MOD_SHIFT, MOD_WIN = 0x0001, 0x0002, 0x0004, 0x0008
_MODS = {"alt": MOD_ALT, "ctrl": MOD_CONTROL, "control": MOD_CONTROL, "shift": MOD_SHIFT, "win": MOD_WIN}


def parse_hotkey(text: str) -> tuple[int, int]:
    """'Ctrl+Alt+P' -> (0x0003, 0x50). F1-F12 -> 0x70..0x7B, single char -> its uppercase code."""
    mods, vk = 0, 0
    for part in (p.strip() for p in text.split("+") if p.strip()):
        low = part.lower()
        if low in _MODS:
            mods |= _MODS[low]
        elif low.startswith("f") and low[1:].isdigit() and 1 <= int(low[1:]) <= 12:
            vk = 0x70 + int(low[1:]) - 1
        elif len(part) == 1:
            vk = ord(part.upper())
        else:
            raise ValueError(f"unsupported hotkey part: {part!r}")
    if not vk:
        raise ValueError(f"no key in hotkey: {text!r}")
    return mods, vk


# ---- registration (P6) -------------------------------------------------------------------
# Receive-only: RegisterHotKey asks Windows to tell us when the combo is pressed. Nothing is
# ever sent to another process.
import sys  # noqa: E402

from PySide6.QtCore import QAbstractNativeEventFilter, QCoreApplication  # noqa: E402
from PySide6.QtGui import QKeySequence, QShortcut  # noqa: E402

WM_HOTKEY = 0x0312
_HOTKEY_ID = 0xA10C


class _HotkeyFilter(QAbstractNativeEventFilter):
    def __init__(self, hotkey_id: int, callback):
        super().__init__()
        self._id, self._cb = hotkey_id, callback

    def nativeEventFilter(self, eventType, message):
        if eventType in (b"windows_generic_MSG", "windows_generic_MSG"):
            import ctypes
            from ctypes import wintypes

            msg = wintypes.MSG.from_address(int(message))
            if msg.message == WM_HOTKEY and msg.wParam == self._id:
                self._cb()
        return False, 0


class HotkeyHandle:
    """Result of `install_hotkey`. `native` is True when the OS-level hotkey is active;
    otherwise an in-app QShortcut is used and `warning` explains why."""

    def __init__(self, text: str):
        self.text = text
        self.native = False
        self.warning = ""
        self._filter = None
        self._shortcut = None

    def close(self) -> None:
        if self._filter is not None:
            import ctypes

            ctypes.windll.user32.UnregisterHotKey(None, _HOTKEY_ID)
            QCoreApplication.instance().removeNativeEventFilter(self._filter)
            self._filter = None
        if self._shortcut is not None:
            self._shortcut.setEnabled(False)
            self._shortcut = None


def install_hotkey(text: str, callback, shortcut_parent=None, allow_native: bool = True) -> HotkeyHandle:
    """Register `text` (e.g. 'Ctrl+Alt+P') globally; on failure fall back to an in-app QShortcut
    parented to `shortcut_parent` (works only while one of our windows has focus)."""
    h = HotkeyHandle(text)
    try:
        mods, vk = parse_hotkey(text)
    except ValueError as e:
        h.warning = f"Bad hotkey '{text}': {e}"
        return h
    app = QCoreApplication.instance()
    if allow_native and sys.platform == "win32" and app is not None:
        import ctypes

        if ctypes.windll.user32.RegisterHotKey(None, _HOTKEY_ID, mods | 0x4000, vk):  # 0x4000 = no auto-repeat
            h._filter = _HotkeyFilter(_HOTKEY_ID, callback)
            app.installNativeEventFilter(h._filter)
            h.native = True
            return h
        h.warning = f"Global hotkey {text} is taken by another program; in-app shortcut only."
    else:
        h.warning = f"Global hotkey unavailable here; using in-app shortcut {text}."
    if shortcut_parent is not None:
        h._shortcut = QShortcut(QKeySequence(text), shortcut_parent)
        h._shortcut.activated.connect(callback)
    return h

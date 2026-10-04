"""Generate src/components/game/game.css from game.css.tpl: embeds the filigree corner SVGs and the grain as data URIs."""
import pathlib
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent / "src" / "components" / "game"


def corner(tf: str) -> str:
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>"
        "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f7dd96'/><stop offset='1' stop-color='#b8862c'/></linearGradient></defs>"
        f"<g transform='{tf}'><g fill='none' stroke='url(#g)' stroke-linecap='round'>"
        "<path d='M1.5 26V9Q1.5 1.5 9 1.5H26' stroke-width='1.7'/>"
        "<path d='M6.5 22V11.5Q6.5 6.5 11.5 6.5H22' stroke-width='.9' opacity='.7'/>"
        "<path d='M1.5 16Q5.5 16 5.5 12' stroke-width='.9' opacity='.8'/><path d='M16 1.5Q16 5.5 12 5.5' stroke-width='.9' opacity='.8'/>"
        "</g><path d='M5 1.2L8.8 5 5 8.8 1.2 5Z' fill='url(#g)'/><circle cx='26' cy='1.6' r='1.3' fill='#f7dd96'/><circle cx='1.6' cy='26' r='1.3' fill='#f7dd96'/></g></svg>"
    )
    return 'url("data:image/svg+xml,' + urllib.parse.quote(svg, safe="/:=' ()") + '")'


NOISE = (
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E"
    "%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E"
    "%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1.2 -.1'/%3E%3C/filter%3E"
    "%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
)

tpl = (ROOT / "game.css.tpl").read_text(encoding="utf-8")
out = (
    tpl.replace("@NOISE@", NOISE)
    .replace("@TL@", corner("translate(0 0)"))
    .replace("@TR@", corner("translate(28 0) scale(-1 1)"))
    .replace("@BL@", corner("translate(0 28) scale(1 -1)"))
    .replace("@BR@", corner("translate(28 28) scale(-1 -1)"))
)
(ROOT / "game.css").write_text(out, encoding="utf-8")
print("wrote", ROOT / "game.css", len(out))

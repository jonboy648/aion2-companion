# Artwork And Card Shader Provenance

## Current Home Preview (October 4, evening)

Later refinement: Emerald Gorge is now the initial scene and remains selected
for review. Its Three.js shader animates masked waterfall flow, fine spray and
pool reflections in source-image coordinates. The whole-image zoom is removed.
The original source PNG is unchanged. Rendering stops offscreen, on pause, and
in hidden tabs; reduced-motion and unavailable WebGL use the original image.
The class srcsets now offer 1254px WebP images encoded at quality 92 directly
from Jon's 1254x1254 originals, plus the existing 640px versions. No upscaling.

Jon supplied four original scenes, copied without modification from the local
`assets/source-art` collection to `web/public/brand/scenes`: Moonlit Floating
Gothic Sky City, Celestial Cathedral of Radiant Light, Mystical Waterfall Ruins
in the Emerald Gorge, and Crimson Eclipse Over Ruined Gothic Citadel.
The original files remain in source-art. The Home preview uses slow camera
drift and crossfades, with a pause control and static reduced-motion mode.

The class name strips reuse the earlier Paper Warp integration.
`@paper-design/shaders` and `@paper-design/shaders-react` 0.0.81 are Apache-2.0;
the package LICENSE and NOTICE are retained in `web/public/licenses/paper-design`.
Rendering is lazy, pixel-capped, limited to eight desktop or two mobile canvases,
paused for reduced motion, and unmounted while the document is hidden.
The CSS gradient remains as the GPU/chunk-load fallback.

The Ruixen Gradient Footer source was supplied directly by Jon in chat. It keeps
the supplied rainbow stops and SVG reveal with our real site navigation.
Reduced motion uses a static footer-local band. No demo subscription form or
placeholder links are included.

## Original Artwork

The restored-original preview uses three original generated images in
web/public/brand: cube-crest.webp and the two atreia-inspired-vista WebP sizes.
These are invented companion-brand art, not NCSOFT scenery or verified game
locations. They were produced with the built-in image generation tool, then
resized and WebP-compressed. Emblem alpha is preserved. The complete generation
prompts are recorded below. No official scenery is hosted. Existing class
emblems remain hotlinks to the official icon CDN.

### Scenery Prompt

Use case: stylized-concept. Asset type: original ultra-wide scenic backdrop for
the Home screen of Become Cube, an unaffiliated fantasy MMORPG companion tool.
Create an exquisite, believable 3D fantasy landscape matte painting, NOT a UI
screenshot. Broad cinematic horizontal composition, approximately 2.5:1. A clear
mountain valley with pale stone cliffside architecture, a few soaring ancient
white-stone arches, a bright river far below, lush pine-green forests and weathered
rock. An elegant floating crystalline cubic relic in the far-right middle distance
echoes our cube brand, very subtle and physically grounded, not a glowing orb.
Cool daylight, silver mist in the distance but crisp visible architecture and
rocks, gentle warm light on stone. Refined forest green, pearl white, silver and
muted copper/gold details, balanced colors; not dark blue/purple dominated. The
right two-thirds show a magnificent readable vista; the left third has quieter
low-detail dark evergreen rock and shadowed foliage to support white overlaid
text, no characters there. Keep the central horizon near the upper third; subject
architecture and relic stay visible in a shallow horizontal crop. Visually rich
yet restrained and realistic, premium game environmental concept art with careful
atmospheric perspective. Original invented environment, not a named Aion location,
no copyrighted game imagery. No typography, no logo, no text, no UI, no frames,
no game characters, no discrete decorative orbs, no particles, no bokeh, no fire,
no heavy bloom or blur.

### Emblem Prompt

Use case: logo-brand. Asset type: original standalone transparent PNG emblem for
Become Cube, an unaffiliated fantasy MMO companion. Create a refined jewel-like
cubic crest, not a generic wireframe SaaS cube. One unmistakable small isometric
cube with three visible faces, clean bold silhouette: translucent deep emerald
left face, pearl-silver right face, warm champagne-gold top face, elegant beveled
brushed-gold edgework. A subtle open C-shaped cut through the front face is part
of its geometry. Two short swept angular gold fins behind the cube echo flight
without literal feathered wings; keep them compact and restrained. Elegant
precise 3D emblem rendering, sculptural and premium, crisp details at 64 pixels,
restrained highlight and reflections, not ornate medieval filigree. Centered
composition, all parts inside square canvas with little empty padding. Genuine
transparent alpha background, isolated emblem only. No text, no words, no frame,
no plaque, no surrounding scene, no decorative orbs or bokeh, no sparks, no long
wings, no giant glow/shadow. Original design, no existing game insignia copied.

## Paper Warp

The user supplied a feature-card example. This integration adapts its Warp
background to existing class data, links and dimensions, preserving the original
ornate/ornate-sm/ornate-hover border classes and decorative corner layers.
It does not transplant the example's feature marketing page or fake Learn more
controls. The named UI component is in web/src/components/ui/feature-shader-cards.tsx.
Paper's Warp shader is lazy-loaded through paper-warp.tsx so other shaders are
tree-shaken and the graphics chunk is not part of the initial application bundle.
This small React adapter uses the public core ShaderMount/warpFragmentShader
APIs: 0.0.81's React initializer does not catch asynchronous initialization
errors. The adapter catches texture/GPU failures, removes failed canvases and
disposes lost contexts. It does not change Paper's shader or rendering engine.

- Packages: @paper-design/shaders-react and @paper-design/shaders 0.0.81,
  pinned exactly in package.json and package-lock.json. The core package is
  already the React package's dependency; the direct pin declares the adapter's
  import without adding another engine or duplicate runtime.
- Both packages declare Apache-2.0. Their installed LICENSE and NOTICE files
  have been inspected; a redistribution copy is deployed under
  web/public/licenses/paper-shaders/ (Copyright 2026 Paper).
- [Official repository and license](https://github.com/paper-design/shaders)
- [Current Warp API](https://shaders.paper.design/warp)

The supplied example's dots shape is not in the current Warp API. This adapter
uses checks/stripes. The effect is decorative and cannot intercept clicks.
Titles, roles, icons and real class links remain accessible above a dark scrim.

Animation is stopped with speed=0 for reduced motion or hidden tabs; the package
also pauses offscreen instances. At most eight shader contexts are enabled on
desktop and two below 640px, without dropping any cards/links. A ResizeObserver
caps pixels to card area at DPR 1 on phones / 1.5 elsewhere, with an absolute
50,000-pixel ceiling per card. Static gradients remain underneath for unavailable
WebGL, capped cards, lazy-load delays and caught shader errors. Graphics probing
and imports occur after client mount, never during SSR/prerender.

## Baseline

main 6698937, built in an isolated detached worktree with the same toolchain:
CSS 70.26 KB (13.59 gzip), main JS 546.64 KB (168.04 gzip), worker 3.77 KB.
The production build prerenders 22 pages. Post-integration results are recorded
in docs/original-artwork-preview.md.

## Beam Search

The follow-up Home preview adapts the user's Spectrum UI BeamSearch pattern
to the real character search. border-beam 1.4.1 is pinned in package.json and
package-lock.json. It declares MIT (Copyright 2026 Jakub Antalik); its full
license is deployed at web/public/licenses/border-beam/LICENSE.

- [Official Border beam docs](https://libraries.dev/beam)
- [Official repository](https://github.com/Jakubantalik/Libraries.dev)

The installed API supports a gold palette. The Home control uses its line
preset, a restrained gold focus accent and matching existing faction tokens;
it does not introduce a perpetual rainbow effect or an unsupported shortcut.
The reusable component and theme utility live under web/src/components/ui.
The library runtime is lazy-loaded only for focused, visible, motion-enabled
controls; the input remains outside the decorative layer. Reduced motion keeps
a static focus outline. Missing/legacy matchMedia and failed chunk downloads
fall back to the ordinary usable field. Unmounting only the effect avoids the
library line preset's fade-animationend lifecycle trap without replacing its
animation engine. Verification and size deltas are in docs/home-search-preview.md.

## User-Supplied Crest And Scenery

The next local preview uses Jon's two supplied generated images, copied without
changing their pixels. These are not downloaded NCSOFT artwork. Their generation
prompts were not provided, so the older prompts above do not describe these files.

- web/public/brand/cube-crest-prismatic.png: Downloads/Analysis output 1 (1).png,
  512 x 512, 289,690 bytes; transparent emerald cube with pearl/gold wings.
- web/public/brand/sky-citadel.png: Downloads/Analysis output 2.png,
  1176 x 469, 1,069,501 bytes; the supplied floating-citadel scenery.

The crest reveals once on entrance, then tilts slightly on hover or keyboard
focus. Reduced motion removes the reveal and tilt. The previous cube-crest.webp
remains an image-error fallback. The scene uses only a contrast scrim, not a
replacement layout; original ornate class borders and faction themes remain.
These exact PNG assets total 1,359,191 bytes and are larger than the previous
WebP assets. They have not been re-encoded in this iteration.

## Prism Activity Indicator

The supplied PrismFluxLoader is adapted to the existing ProgressPanel rather
than adding a demo page or cycling fictional status messages. It keeps the
engine's actual progress text and one polite status region. The component is in
web/src/components/ui/prism-flux-loader.tsx, with a lazy Three.js scene.

- Packages: three 0.186.1 (runtime) and @types/three 0.186.0 (development), pinned
  in package.json and package-lock.json. Existing lucide-react provides the
  static Box fallback; no new icon package is needed.
- Three.js declares MIT; the installed full license was inspected and copied
  to web/public/licenses/three/LICENSE (Copyright 2010-2026 three.js authors).

The scene has six face marks, gold edges and a DPR ceiling of 1.5. Drawing is
capped at 30 FPS. Reduced motion produces one static frame; hidden/offscreen
indicators stop their animation loop. Scene import, canvas creation and rendering
occur only after client mount. Missing WebGL2, rejected downloads, context loss
and GPU errors leave the ordinary static cube and real progress text usable.
Unmounting cancels animation, listeners and observers and releases GPU resources.
Strict build, 22-page prerender, tests and browser evidence/size deltas are recorded
in docs/crest-and-prism-preview.md.

## Gradient Start Here Button

The user supplied Emerald UI's Gradient Borders Button, whose source header
declares MIT, author @emerald-ui, version 1.0.0, dated 2026-02-11, and
https://emerald-ui.com. That attribution is retained in
web/src/components/ui/gradient-borders-button.tsx. The integration uses the
existing typed cn utility, clsx, tailwind-merge and Radix Slot; no dependency
or lockfile change was needed for this button.

Only the first Home quick action, Start here, receives this treatment. It stays
a real /guide link, not an anchor nested in a button. The supplied cyan/magenta
radial border and emerald bottom hairline brighten on hover or keyboard focus.
The Home-specific border mask preserves the approved black/50 glass center.
All other quick actions and ornate class frames are unchanged. Reduced motion
disables the opacity transitions; there is no continuous animation or timer.

Verification: 237 tests across 39 files pass; npm run build passes and
prerenders 22 pages. JevBrowser checks at 1440x1000, 390x844 and 320x568 cover
stable hover geometry, no overlap/overflow, transparency, light/dark OS settings,
focus indication, reduced motion and real guide navigation. Screenshots and
the check report are local artifacts under output/gradient-button/.

Build after this button: CSS 87.98 kB (17.07 gzip), main JS 559.18 kB
(172.69 gzip). Compared with the approved glass preview, that is CSS +6.20 kB
(+1.00 gzip) and JS +2.14 kB (+0.64 gzip). Compared with main 6698937's
same-toolchain baseline above, the whole visual branch is CSS +17.72 kB
(+3.48 gzip) and JS +12.54 kB (+4.65 gzip). Existing lazy graphics chunks and
worker remain unchanged; the existing large-chunk/fixture-import build warnings
remain. This is a local preview, not a deployed change.

## Square Class-Art Grid

The next local Home preview adapts Jon's supplied LogoCloud2 component into
a data-driven class selector in web/src/components/ui/logo-cloud-2.tsx and
logo-cloud-2.css. It preserves the reference's shared dividers, full-width
top/bottom rules, intersection Plus icons and two-column/mobile,
four-column/desktop layout. Company logos and demo copy are not included.
No component license was stated in the supplied snippet; no separate license
claim is made here. Existing lucide-react supplies PlusIcon without a new package.

Jon supplied the eight original generated, text-free square portraits below.
All source files are under C:/Users/jonca/Downloads and share the prefix
"ChatGPT Image Oct 4, 2026, ". Their 1254x1254 PNGs remain untouched outside
the repository. No NCSOFT artwork was downloaded for this update.

| Class | Source Filename Suffix |
| --- | --- |
| Gladiator | 01_06_24 PM-1.png |
| Templar | 01_06_26 PM-2.png |
| Assassin | 01_06_28 PM-3.png |
| Ranger | 01_06_30 PM-4.png |
| Sorcerer | 01_06_32 PM-5.png |
| Spiritmaster | 01_06_34 PM-6.png |
| Cleric | 01_06_36 PM-7.png |
| Chanter | 01_06_42 PM-8.png |

FFmpeg's libwebp encoder creates 320px and 640px copies at quality 84 with
Lanczos resizing, under web/public/brand/classes/<class>-<size>.webp. The PNGs
total 22,180,412 bytes; all sixteen WebPs total 1,240,384 bytes (320px set:
297,384; 640px set: 943,000). The narrowly scoped .gitignore permits these
responsive WebPs without removing the project's general artwork exclusions.

Class names and existing role labels are real text over a bottom-only contrast
fade, not embedded in the images. Width/height, square aspect ratio and eight
static loading slots reserve layout space. Responsive srcset/sizes and lazy
loading select an appropriate image; a failed source reveals the existing class
emblem without losing the label or build link. Replacement image sources can
recover after an error. Reduced motion removes the hover brightness transition.
Decorative dividers/Plus icons are hidden from assistive technology and cannot
intercept clicks. Search, scenery, crest, quick actions, engine and routes are
unchanged. Home no longer renders ornate shader class buttons; those original
components remain available elsewhere in the source tree.

Verification: 240 tests across 40 files pass; strict npm run build passes and
prerenders 22 pages. JevBrowser verifies 1440/1920px desktops, 768px tablet,
390px phone and 320px small phone: correct column counts, rendered portraits,
square geometry, no text overflow, pointer-transparent crosses, stable hover,
keyboard focus, reduced motion and actual Chanter builder selection. Evidence
is under output/class-grid/, including desktop.png and mobile.png.

Build: CSS 90.92 kB (17.54 gzip), main JS 558.40 kB (172.14 gzip). Against the
gradient-button preview, CSS is +2.94 kB (+0.47 gzip), JS -0.78 kB (-0.55 gzip).
Paper Warp's 45.92 kB lazy chunk is no longer emitted because the Home grid
does not import it. Three.js, BorderBeam and worker chunks remain; existing
large-chunk and fixture-import warnings remain. No dependency changes, push
or deployment were performed for this grid update.

## Dashboard Preservation (2026-10-04)

Preserved from the dirty working tree at `D:/Aion2-visual-polish` HEAD
`41da69b` into `D:/Aion2-dashboard`, branch `codex/dashboard-refresh`,
starting at `f47d00d`. The historical verification and size reports above
belong to the visual preview, not this dashboard branch. The coordinator
reported the fresh pinned-main baseline green (25 files / 151 tests).
After that gate, the owned focused run passed 12 files / 80 tests.

Approved references:
- `D:/Aion2-visual-polish/docs/superpowers/plans/2026-10-04-dashboard-refresh.md`
- `D:/Aion2-visual-polish/docs/superpowers/specs/2026-10-04-dashboard-and-native-map-design.md`

Current Home preserves transparent glass, supplied scenery, prismatic crest,
quick actions and the rectangular class grid (84px desktop / 80px mobile).
The earlier square-grid description records the preceding preview. Home
imports LogoCloud and RuixenMoonChat, with no feature-shader imports. Data,
engine, types, gear and fixtures remain owned by their integration workers.

Coordinator integration requirements:
- Add global imports to `web/src/index.css`, after the existing game CSS:
  `./components/ui/beam-search.css`, `./components/ui/prism-flux-loader.css`,
  `./components/ui/brand-crest.css`, then `./original-home-artwork.css`.
  Moon Chat and LogoCloud import their own CSS locally.
- Header: import `BrandCrest` from `@/components/ui/brand-crest`, render
  `<BrandCrest />` in the Home brand link and apply its `brand-home` class.
- Runtime packages: `border-beam@1.4.1`, `three@0.186.1`;
  development types: `@types/three@0.186.0`. Existing React, lucide-react,
  Radix Slot, cn, clsx and tailwind-merge suffice for the remaining components.
  Paper shaders are not required by this preserved Home.
- Tests use the existing Vitest `VITE_ENGINE=mock` configuration; no new
  environment variables are required. Production uses the existing engine
  selection. PrismFluxLoader is exported for coordinator integration into
  the current progress UI; no obsolete ProgressPanel was transplanted.
- HomeArt tests Home directly and separately verifies BrandCrest's supplied
  image, decorative semantics, fixed dimensions and image-error fallback.
  Shared Layout integration remains a coordinator check: its header still
  needs BrandCrest and the brand-home class. The four global CSS imports
  above are also pending. Runtime Beam/Three packages are installed;
  @types/three is absent from package.json and node_modules at verification.

Focused verification (2026-10-04):
`npx vitest run src/pages/HomeArt.test.tsx src/features/build/SearchBox.test.tsx
src/components/ui/beam-search.test.tsx src/components/ui/beam-search.ssr.test.tsx
src/components/ui/beam-search.lazy-failure.test.tsx
src/components/ui/gradient-borders-button.test.tsx
src/components/ui/logo-cloud-2.test.tsx
src/components/ui/prism-flux-loader.test.tsx
src/components/ui/prism-flux-loader.ssr.test.tsx
src/components/ui/prism-flux-loader.lifecycle.test.tsx
src/components/ui/prism-flux-loader.lazy-failure.test.tsx
src/components/ui/prism-flux-scene.test.ts`
passed 12 files / 80 tests in the destination web directory. The initial
run exposed the pending shared-header wiring; crest coverage was moved to
the owned component, including fallback coverage. Product visual code was
not changed to accommodate that integration gap. All 24 asset/license pairs
were rechecked with zero SHA-256 mismatches. No full suite, build, browser,
server, commit or push was run by the preservation worker.

Owned text imports:
- `web/src/pages/Home.tsx`
- `web/src/pages/HomeArt.test.tsx`
- `web/src/features/build/SearchBox.tsx`
- `web/src/features/build/SearchBox.test.tsx`
- `web/src/original-home-artwork.css`
- `docs/brand-assets.md`
- `web/src/components/ui/beam-search.css`
- `web/src/components/ui/beam-search.lazy-failure.test.tsx`
- `web/src/components/ui/beam-search.ssr.test.tsx`
- `web/src/components/ui/beam-search.test.tsx`
- `web/src/components/ui/beam-search.tsx`
- `web/src/components/ui/brand-crest.css`
- `web/src/components/ui/brand-crest.tsx`
- `web/src/components/ui/gradient-borders-button.test.tsx`
- `web/src/components/ui/gradient-borders-button.tsx`
- `web/src/components/ui/logo-cloud-2.css`
- `web/src/components/ui/logo-cloud-2.test.tsx`
- `web/src/components/ui/logo-cloud-2.tsx`
- `web/src/components/ui/prism-flux-loader.css`
- `web/src/components/ui/prism-flux-loader.lazy-failure.test.tsx`
- `web/src/components/ui/prism-flux-loader.lifecycle.test.tsx`
- `web/src/components/ui/prism-flux-loader.ssr.test.tsx`
- `web/src/components/ui/prism-flux-loader.test.tsx`
- `web/src/components/ui/prism-flux-loader.tsx`
- `web/src/components/ui/prism-flux-scene.test.ts`
- `web/src/components/ui/prism-flux-scene.ts`
- `web/src/components/ui/ruixen-moon-chat.css`
- `web/src/components/ui/ruixen-moon-chat.tsx`
- `web/src/components/ui/beam-search-utils/use-surface-theme.ts`
- `web/public/brand/classes/.gitignore`
- `web/public/licenses/border-beam/LICENSE`
- `web/public/licenses/three/LICENSE`

Asset preservation SHA-256: each listed source and destination digest is
identical. Files were copied using explicit paths without re-encoding.

| Asset (relative to repository) | Source SHA-256 = Destination SHA-256 |
| --- | --- |
| `web/public/brand/atreia-inspired-vista-960.webp` | `842c6b846dccc8f8ecf4e1d092d904b82c3019ba092f29fa3b5d9994cf89464d` |
| `web/public/brand/atreia-inspired-vista.webp` | `0cc60f6819d1aa02356df4b73081e817d5854605d6bc29daa969bf6dbe722b60` |
| `web/public/brand/cube-crest-prismatic.png` | `338a45f8409f409b7174faecb4e0d4f869733395a5af62b2261c8e134fd6b3a5` |
| `web/public/brand/cube-crest.webp` | `6c96aff11dc0b82c85ddc92ab2739d1af4c5ae3fc175e9257258f58c6560b73b` |
| `web/public/brand/sky-citadel.png` | `7bc54567141e34a127ae677c854cc1c78441ef0f832c5e462f1e228da3e1bc15` |
| `web/public/brand/classes/assassin-320.webp` | `9b9d91ba368fe6c290b31eb3f65ac290b1c503bd8a2c64b484e22bc3e1fe134a` |
| `web/public/brand/classes/assassin-640.webp` | `92513efc85213dd6b82fc490945ddb411ace841f6bd103b07a19e60a7a147301` |
| `web/public/brand/classes/chanter-320.webp` | `9c112a18b198fa8dfb7c0df6ef384c44ff3ae3e85cba7e999eb66afe16abb888` |
| `web/public/brand/classes/chanter-640.webp` | `7d6da075808789fdc22d9b7dc9136c5ba935af6e81131704766946437e3c69c7` |
| `web/public/brand/classes/cleric-320.webp` | `efce0f939b11d3569bfed22035a7a329cee617b85387c0b0434a50ed6d0f8375` |
| `web/public/brand/classes/cleric-640.webp` | `51b5e5966b5142ff1d146933c18f5a91077242324d41b72ef50a75ca324a745a` |
| `web/public/brand/classes/gladiator-320.webp` | `f1dba119a62d1aad43ac647f9f66a81d1a82414e60bace9eeba72e0d7661a4d2` |
| `web/public/brand/classes/gladiator-640.webp` | `ed49d141300ca52a5de565b4c78f040e311bc0ade8beab73bc45add1267856ba` |
| `web/public/brand/classes/ranger-320.webp` | `be6231c24e9e04d783043c00016eef72437b98ca3b1187aef4cd2a7fb3249b51` |
| `web/public/brand/classes/ranger-640.webp` | `3d521522c67071edd0fdfc13f32273d932f08deab7bddcec661bd54aa970c96e` |
| `web/public/brand/classes/sorcerer-320.webp` | `a810001d053760acad070eeef4b90a9203da9ae102d717f277b4500ff8c7a882` |
| `web/public/brand/classes/sorcerer-640.webp` | `8f8a63db5b1dce868414b080c2a468928e5909e81f332d999e303f3d01017a18` |
| `web/public/brand/classes/spiritmaster-320.webp` | `1937e2e094d642cc39e6c7aad0ca45397226735238db9319666ea9390806ceee` |
| `web/public/brand/classes/spiritmaster-640.webp` | `fb68ba95de30bb38f826487c8e4a099ccee97d701d853dfe414bae426155bbac` |
| `web/public/brand/classes/templar-320.webp` | `e398409c369c41bc495a5492150690a6a00957868aedd742cb3b78ce5526fc93` |
| `web/public/brand/classes/templar-640.webp` | `0f94f810dd14ba39221304c102b3a6448de4d83889f67034596759fc9ab55831` |
| `web/public/licenses/border-beam/LICENSE` | `915a283980628a0ca9e7b423ebafc6f3a0fa1e630ff17d34e59034808d92011c` |
| `web/public/licenses/three/LICENSE` | `8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc` |

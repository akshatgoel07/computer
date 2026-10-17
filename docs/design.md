# Windows 7 build spec

Use Windows 7 Aero at 96 DPI and 100% browser zoom. All lengths use CSS pixels unless a table specifies another unit.
Use a 1366 × 768 viewport for the reference layout. Let W and H denote the viewport width and height.
Use `box-sizing: border-box` for every shell element. Set body margin to 0 and overflow to hidden.
Import asset keys from `@/assets`. Resolve CSS image variables in React from those keys, never from literal asset paths.
This file defines fixed replica values. Boot delays, glass colors, and menu geometry are reconstruction targets, not measurements from a Windows installation.

## 1. Boot sequence

Start the clock after `images.bootActivity` and `images.logonBackground` decode. Use a black preload screen with 0 text and 0 sound.
Use `performance.now()` for elapsed time. Clear each timer when the component unmounts.

| Stage | Interval | Duration | Background | Content and position | Sound |
| --- | --- | --- | --- | --- | --- |
| Starting Windows | 0–7000 ms | 7000 ms | `#000000` | Sprite center at `(W/2,H/2-28)`. Text center at `(W/2,H/2+111)` | Silent |
| Welcome | 7000–9000 ms | 2000 ms | `images.logonBackground`, center center / cover, fallback `#07517f` | Spinner and `Welcome` form a centered group at `(W/2,H/2)` | `sounds.startup` at 7000 ms |
| Desktop reveal | 9000–9500 ms | 500 ms | Desktop under welcome layer | Welcome opacity 1 → 0, `ease-out`. Desktop opacity 1 throughout | Silent |
| Desktop | 9500 ms onward | 0 ms transition | `images.wallpaper` | Remove welcome layer. Accept shell input | Silent |

The boot text is exactly `Starting Windows`, in Segoe UI, 23px, weight 400, line-height 30px, color `#ffffff`.
Place `© Microsoft Corporation` at bottom 36px, horizontally centered, 11px/16px, weight 400, color `#aaaaaa`.
The sprite uses `images.bootActivity`. The sheet is 1400 × 3000px: a grid of 7 columns and 15 rows with 105 frames of 200 × 200px in reading order.
Display each frame at 200 × 200px, without interpolation between frames. Use 15 fps, or 1000/15 ms per frame.
Set background-size to `1400px 3000px`. For frame f, set background-position to `calc(-200px * (f % 7)) calc(-200px * floor(f / 7))`.
Use zero-based frames 0–59 once, then loop frames 60–104. At 7000 ms, enter Welcome after frame 104.
If preload extends the black stage, do not advance the sprite clock before decode.
The [boot updater specification](https://www.coderforlife.com/projects/win7boot/) confirms 105 frames, 200px cells, and 15 fps.

Set Welcome text to 24px/32px, weight 400, color `#ffffff`, and shadow `0 2px 4px #00304d`.
Use a 24 × 24px spinner, with a 12px gap before the text. Align the spinner center with the text center.
Construct 12 radial bars in CSS. Each bar is 2 × 6px, radius 1px, at radius 8px, with 30deg spacing.
Use `#ffffff` bars, opacity steps of 1/12, and a 1000 ms clockwise loop in 12 steps.
The asset contract has 0 spinner assets. This spinner is a reconstruction.

Play the startup sound once at Welcome entry, never during the black boot screen.
Resume the AudioContext on the first pointerdown or keydown. Browser policy can block both boot sounds before that input.
Keep the sequence automatic. Discard an unavailable boot sound at its stage end. Do not replay it during a later desktop action.
Use gain 1 for system sounds. Do not trim the source files.

## 2. Desktop

Set the desktop to `position: fixed; inset: 0`. Set its background to `images.wallpaper`, center center / cover, without repeat.
Reserve the bottom 40px for the taskbar. Let the wallpaper extend behind the glass.
Use z-index 0 for wallpaper, 10 for desktop icons, 100–999 for windows, 1000 for taskbar, 1100 for Start menu, and 2000 for boot.

| Item | Value |
| --- | --- |
| Grid | 76px columns × 100px rows, column first, origin x=0px y=0px |
| Cell hit area | 76 × 94px, top inset 2px, radius 2px, border 1px |
| Image | 48 × 48px, x=14px y=8px within cell |
| Label | Width 74px, top 60px, centered, Segoe UI 12px/15px, weight 400, `#ffffff` |
| Label shadow | `1px 1px 2px #000000, 0 0 3px #000000` |
| Label wrap | 2 lines, 30px maximum height, overflow hidden |
| Rest border and fill | `rgba(255,255,255,0)` |
| Hover fill / border | `rgba(170,220,255,.18)` / `rgba(225,245,255,.45)` |
| Selected fill / border | `rgba(105,185,235,.35)` / `rgba(210,240,255,.85)` |
| Selected hover fill | `rgba(125,205,255,.45)` |
| Keyboard focus | `1px dotted #ffffff`, offset -3px |

Place Computer, Recycle Bin, and Road Rash in rows 0, 1, and 2 of column 0.
Use `icons.computer`, `icons.recycleEmpty`, and `icons.roadRash`. Use `icons.recycleFull` when the bin contains at least 1 item.
Use `icons.documents` for Documents entries. Do not use emoji as icons.
Select on single click. Open on double-click or Enter. Use the native `dblclick` event to honor the host click interval.
Clear selection on a click on the wallpaper. Keep icon selection separate from window focus.

## 3. Taskbar

Set the taskbar to `position: fixed; left: 0; right: 0; bottom: 0; height: 40px`.
Use this glass treatment. The colors define the replica at the reference wallpaper.

```css
.taskbar {
  background: linear-gradient(180deg,
    rgba(171,212,239,.68) 0%, rgba(88,143,184,.68) 3%,
    rgba(36,80,118,.76) 48%, rgba(16,50,81,.80) 49%,
    rgba(32,70,105,.78) 100%);
  border-top: 1px solid rgba(7,24,40,.95);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.55);
  backdrop-filter: blur(12px);
  color: #ffffff;
}
.task-button {
  width: 60px; height: 40px; padding: 3px 13px;
  border: 1px solid rgba(255,255,255,0); border-radius: 3px;
  background: rgba(255,255,255,0);
}
.task-button[data-running="true"] {
  border-color: rgba(8,26,42,.8);
  background: linear-gradient(180deg,rgba(255,255,255,.32) 0%,rgba(255,255,255,.08) 48%,rgba(0,0,0,.13) 49%,rgba(255,255,255,.14) 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.36);
}
.task-button:hover {
  border-color: rgba(12,34,52,.9);
  background: radial-gradient(ellipse at 50% 100%,rgba(112,213,255,.8) 0%,rgba(204,240,255,.27) 65%,rgba(255,255,255,.13) 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.55);
}
.task-button[data-active="true"] {
  border-color: #102a40;
  background: linear-gradient(180deg,rgba(255,255,255,.55) 0%,rgba(255,255,255,.22) 48%,rgba(112,177,219,.35) 49%,rgba(179,225,255,.45) 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.65),inset 0 -2px 5px rgba(255,255,255,.45);
}
.task-button:active { filter: brightness(.85); }
```

Reserve x=0–58px for Start. Place the first task button at x=58px. Use a 2px gap between buttons.
Use 32 × 32px task icons. Pin Computer then Road Rash, with `icons.computer` and `icons.roadRash`.
Group each app into 1 button. A pinned button gains its running state after launch.
An inactive task button restores and focuses its window. An active task button minimizes its window.

Use `images.startOrb` as a 54 × 162px vertical sprite. Its three 54 × 54px cells are normal, hover, and pressed.
Set its element to 54 × 54px, left 0px, bottom -7px. The image includes transparent space around the visible orb.
Set background-size to `54px 162px`. Use y positions 0px, -54px, and -108px.
Use pressed state while the Start menu is open. Change sprite state with 0 ms delay.
The [Start orb template](https://www.door2windows.com/how-to-create-a-windows-7-start-orb/) specifies this sheet format.
The asset lane must preserve these dimensions. The current tree contains 0 image files for dimension verification.

| Notification element | Geometry and style |
| --- | --- |
| Container | Right 15px, bottom 0px, height 40px, display flex, gap 0px, padding-left 8px |
| Hidden icons button | 24 × 40px, triangle 6 × 4px, `#ffffff`, centered |
| Action Center, network, volume | 24 × 40px each, CSS vector 16 × 16px, `#ffffff`, shadow `0 1px 1px #172b3b` |
| Clock | 80 × 40px, padding-top 3px, center alignment, 12px/16px, weight 400 |
| Clock time | Local time, `h:mm tt`, 12-hour clock, example `9:41 AM` |
| Clock date | Local date, `M/d/yyyy`, example `10/17/2026` |
| Clock update | Every 1000 ms, read the current Date value |
| Notification hover | Fill `rgba(255,255,255,.15)`, border `1px solid rgba(255,255,255,.35)`, radius 2px |
| Show desktop | Right 0px, width 15px, height 40px, border-left `1px solid #142b3e` |
| Show desktop fill | `linear-gradient(90deg,rgba(255,255,255,.08) 0%,rgba(255,255,255,.25) 100%)` |
| Show desktop hover | Fill `rgba(255,255,255,.4)`, inset shadow `0 0 0 1px rgba(255,255,255,.65)` |

Use inline SVG paths for the 3 notification symbols. Do not add external icon assets or dependencies.
After 1000 ms over Show desktop, hide window content for Aero Peek. Restore it on pointer leave.
On Show desktop click, minimize all visible windows. A second click restores that same set.

## 4. Start menu

Use width 410px, height 488px, left 0px, bottom 40px. Use 7px outer padding and 0px column gap.
The left pane is 252px wide. The right pane is 142px wide. The outer 2px border completes the 410px width.
Use this CSS under `.win7`. Keep the user tile outside the clipping area.

```css
.start-menu {
  border: 1px solid #172b3c; border-radius: 7px 7px 0 0;
  background: linear-gradient(135deg,rgba(107,154,183,.96) 0%,rgba(39,72,97,.97) 38%,rgba(18,37,56,.97) 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.5),2px 0 10px rgba(0,0,0,.6);
  backdrop-filter: blur(12px);
  font: 400 12px/16px "Segoe UI",sans-serif;
}
.start-left {
  background: #ffffff; color: #000000;
  border: 1px solid #91a4b3; border-radius: 4px;
}
.start-left .entry {
  border: 1px solid rgba(255,255,255,0); border-radius: 3px;
  background: #ffffff;
}
.start-left .entry:hover, .start-left .entry:focus-visible {
  background: linear-gradient(180deg,#f3f9ff 0%,#d6ebff 100%);
  border-color: #7da2ce; box-shadow: inset 0 0 0 1px #ffffff;
}
.start-right { color: #ffffff; text-shadow: 0 1px 2px #122c40; }
.start-right .entry {
  border: 1px solid rgba(255,255,255,0); border-radius: 3px;
}
.start-right .entry:hover, .start-right .entry:focus-visible {
  border-color: #111e2b;
  background: linear-gradient(180deg,rgba(255,255,255,.25) 0%,rgba(255,255,255,.06) 48%,rgba(0,0,0,.12) 49%,rgba(255,255,255,.14) 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.32);
}
.shutdown {
  color: #ffffff; border: 1px solid #142534; border-radius: 3px 0 0 3px;
  background: linear-gradient(180deg,#a1b3bf 0%,#526d82 48%,#324e65 49%,#526d82 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.4);
}
.shutdown:hover { background: linear-gradient(180deg,#c9e7f8 0%,#779db9 48%,#456f91 49%,#86b0d0 100%); }
.shutdown:active { background: linear-gradient(180deg,#38556c 0%,#65859d 100%); }
```

Measure pane coordinates from each pane's top-left corner. Both panes have height 472px.
Use the following fixed left pane layout.

| Region | Bounds | Contents |
| --- | --- | --- |
| Pinned list | x=4 y=4 w=242 h=92 | Computer, Road Rash, each 44px high, gap 2px, icon 32px, inset 6px, text gap 8px |
| Separator | x=8 y=98 w=234 h=1 | `linear-gradient(90deg,#ffffff 0%,#d7d7d7 50%,#ffffff 100%)` |
| Recent list | x=4 y=103 w=242 h=298 | Distinct recent apps, maximum 6, row 40px, icons 32px, inset 6px, text gap 8px |
| All Programs | x=4 y=402 w=242 h=29 | Triangle 4 × 7px at x=12, text at x=30, `All Programs` |
| Search footer | x=0 y=434 w=250 h=36 | Fill `#f1f5f9`, border-top `1px solid #c9d4df` |
| Search input | x=9 y=442 w=232 h=23 | White fill, border `1px solid #7f9db9`, radius 2px, inset shadow `0 1px 2px rgba(0,0,0,.2)` |

Use search placeholder `Search programs and files`, color `#6d6d6d`, font 12px/18px, weight 400, font-style italic.
Use input text color `#000000` and font-style normal. Give text a 6px left inset and 24px right inset.
Construct a search glyph with a 9px circle, 1px border `#526679`, and a 5 × 1px handle at 45deg.
Place the glyph right 7px, top 6px. Search app names without case sensitivity and without a delay.
Replace the recent region with results. Use `No items match your search.` for 0 results.
All Programs replaces the recent region with all app entries. Its footer label becomes `Back` with a left triangle.
Do not list a pinned app in the recent region. An empty recent list keeps its blank area.

Use `images.userTile` at x=45px, y=-23px within the right pane, size 48 × 48px.
Use a 54 × 54px tile frame at x=42px, y=-26px, padding 2px, border `1px solid #dce8ef`, radius 5px.
Give the frame background `#58768d` and shadow `0 2px 5px rgba(0,0,0,.65),inset 0 0 0 1px #6f8598`.
Start the right links at x=8px, y=38px, width 128px. Give each row 30px height and 7px horizontal padding.
Use this exact link order. All right links use text only, with 0 icons.

| Link | Top y | Action |
| --- | --- | --- |
| Akshat | 38px | Open user folder |
| Documents | 68px | Open Documents |
| Pictures | 98px | Open Pictures |
| Music | 128px | Open Music |
| Games | 158px | Open Games |
| Separator | 192px | Height 2px, top `#1b3449`, bottom `rgba(255,255,255,.2)`, width 112px, left 16px |
| Computer | 198px | Open Computer |
| Control Panel | 228px | Open Control Panel |
| Devices and Printers | 258px | Open Devices and Printers |
| Default Programs | 288px | Open Default Programs |
| Help and Support | 318px | Open Help and Support |
| Separator | 352px | Same 2px separator |
| Shut down | 434px | Main button x=12px, width 85px, height 24px |
| Shutdown arrow | 434px | Button x=97px, width 24px, height 24px, radius `0 3px 3px 0` |

Use 11px/16px for `Devices and Printers` so the label fits on 1 line. Keep the other links at 12px/16px.
Use a right triangle of 4 × 7px for the shutdown arrow. The arrow opens a 132px popup above the button.
Use popup rows of 24px for `Switch user`, `Log off`, `Lock`, `Restart`, `Sleep`, and `Shut down`.
Use popup fill `#f0f0f0`, text `#000000`, border `1px solid #979797`, radius 0px, padding 2px, and the left entry hover style.
Shut down closes windows and enters a 1500 ms logon-background screen with `Shutting down...`, then black.
Restart uses the same screen, then restarts the boot clock at 0ms. Log off returns to Welcome after 1500ms.
The other power entries preserve desktop state and show a logon-background screen with a centered `Akshat` tile.
Enter or a tile click returns to the desktop. Browser code cannot control host power or user accounts.
Shell destinations require local app windows. Use the exact link label as the title when a destination has no app content.
Toggle Start on its button click or the Windows key if the browser receives that key.
Close Start on Escape, outside pointerdown, or an app launch. Focus search on open and return focus to Start on Escape.
Use a 120 ms opacity transition from 0 to 1 on open and 100 ms from 1 to 0 on close.

## 5. Window frame

Use the scoped 7.css build inside `.win7`. Use `<section class="window glass active">` for the foreground window.
Use `.title-bar`, `.title-bar-text`, `.title-bar-controls`, and `.window-body` as direct frame parts.
7.css supplies frame borders, shadows, title buttons, title glow, glass blur, and control hover states.
Use its `aria-label="Minimize"`, `aria-label="Maximize"`, `aria-label="Restore"`, and `aria-label="Close"` button hooks.
Use `.window-body.has-space` only for content that needs the library's inner space.
The [7.css window guide](https://khang-nd.github.io/7.css/#window) defines these classes. Keep its control artwork.

| Shell addition | Exact behavior or override |
| --- | --- |
| Normal frame | Outer size includes 8px left, right, bottom borders and 30px title area. Radius 6px |
| Initial rectangle | Width 800px, height 520px, x=80px, y=60px. Cascade each next window by 24px on both axes |
| Minimum rectangle | Width 320px, height 200px, limited to viewport dimensions on smaller screens |
| Active | `.active` only on focused window. Set `--w7-w-bg: #4580b0`. Title color `#000000`, glow `0 0 8px #ffffff,0 0 4px #ffffff` |
| Inactive | Remove `.active`. Set `--w7-w-bg: #b7cbd9`. Title color `#434343`, glow `0 0 5px rgba(255,255,255,.8)` |
| Body | Fill `#ffffff`, text `#000000`, margin 0px for app canvas |
| Title | Icon 16 × 16px at x=8px y=7px. Text at x=30px y=7px, 12px/16px, weight 400 |
| Maximize | x=0px, y=0px, width W, height H-40px, radius 0px, frame padding 0px, title area 30px |
| Resize | 8px edge hit areas and 12 × 12px corner hit areas, 0px outside frame |
| Drag | Title pointerdown captures pointer. Commit geometry on pointerup. Keep 48px of title visible horizontally and y at least 0px |
| Double-click title | Toggle normal/maximized. Exclude title controls from the handler |
| Close | Opacity 1 → 0 and scale 1 → .95 over 150 ms, then remove record |
| Open | Opacity 0 → 1 and scale .95 → 1 over 150 ms |
| Minimize | Transform frame rectangle into its task button rectangle over 200 ms, opacity 1 → 0 |
| Restore | Reverse minimize transform over 200 ms. Restore saved normal/maximized state |

Use `cubic-bezier(.2,0,.2,1)` for window transitions. Keep minimized app components mounted, with display none after the transition.
Save the normal rectangle before maximize. Do not overwrite it on minimize or viewport resize.
Clamp the visible rectangle to the work area after viewport resize. Keep the taskbar visible above maximized windows.
Focus on frame pointerdown. After close or minimize, focus the highest visible window in z-order.
Use pointer capture and requestAnimationFrame for geometry. Do not add Motion or a drag dependency.

## 6. Sound map

Use the Windows Default scheme. An asset's presence does not enable its event.
Use this map for the available contract. The contract lacks Windows Error, Question, mail, device, and battery sound keys.
Do not replace those absent sounds with unrelated sounds. Keep those unsupported events silent until the asset contract expands.

| Event | Asset key | Trigger |
| --- | --- | --- |
| Windows startup | `sounds.startup` | Welcome entry, once per boot |
| Windows Logon | `sounds.logon` | Silent. Windows 7 turns this sound off by default |
| Windows Logoff | `sounds.logoff` | Explicit Log off, once, not on every shutdown |
| Exit Windows | `sounds.shutdown` | Shut down or Restart entry, once |
| Default Beep | `sounds.ding` | Invalid action with no error dialog |
| Exclamation | `sounds.exclamation` | Warning dialog entry |
| Critical Stop | `sounds.critical` | Critical error dialog entry |
| System Notification | `sounds.notify` | System notification event |
| System tray balloon | `sounds.balloon` | First display of a notification balloon |
| Start Navigation | `sounds.navigation` | Explorer destination change, not desktop app launch |
| Empty Recycle Bin | `sounds.recycle` | Confirmed bin empty action, only if count exceeds 0 |
| Minimize | Silent | `sounds.minimize` exists but stays unused in Windows Default |
| Maximize and Restore | Silent | `sounds.restore` exists but stays unused in Windows Default |
| Menu Command | Silent | `sounds.menu` exists but stays unused in Windows Default |
| Menu Popup and Start open/close | Silent | 0 sound calls |
| Open/close app, focus, drag, resize | Silent | 0 sound calls |
| Icon select, hover, search input | Silent | 0 sound calls |
| Asterisk and Question | Unsupported | Contract has 0 matching keys, no substitution |

Use 1 shared AudioContext and 1 decoded buffer per sound key. Deduplicate concurrent fetches by key.
Create 1 source node per play. Disconnect it on ended. Keep 0 loops for system sounds.
Do not play both System Notification and balloon for the same balloon. Prefer `sounds.balloon` for that event.
The [Microsoft sound guide](https://learn.microsoft.com/en-us/windows/win32/uxguide/vis-sound) describes Windows 7 sound use, but not a complete registry map.
The event assignments above require an installation check, especially Asterisk and System Notification. Do not claim full scheme coverage with this contract.

## 7. Fonts

Use the Segoe UI font faces from the asset lane's `src/styles/fonts.css`. The current asset contract has 0 font keys.
Do not add font URLs in shell components. Use `font-family: "Segoe UI", Tahoma, sans-serif` and letter-spacing 0px.
Use weight 400 for every row below. Do not synthesize weight 600 or 700 for default shell text.

| Element | Font size | Line-height |
| --- | --- | --- |
| Starting Windows | 23px | 30px |
| Boot copyright | 11px | 16px |
| Welcome and shutdown status | 24px | 32px |
| Desktop labels | 12px | 15px |
| Start entries, right links, All Programs | 12px | 16px |
| Devices and Printers | 11px | 16px |
| Search input | 12px | 18px |
| Shut down and power popup | 12px | 16px |
| Taskbar clock | 12px | 16px |
| Window title and default body | 12px | 16px |
| Tooltip | 12px | 16px |

## 8. Cursors

| Element or state | Cursor |
| --- | --- |
| Desktop, icons, Start, task buttons, menus, title controls, title drag | `cursors.arrow`, fallback `default` |
| Actual web hyperlink inside app content | `cursors.link`, fallback `pointer` |
| Welcome and app initialization while input cannot act | `cursors.busy`, fallback `wait` |
| Black boot | `none` |
| Search and editable text | Native `text`, contract has 0 text cursor keys |
| Resize top/bottom | Native `ns-resize` |
| Resize left/right | Native `ew-resize` |
| Resize top-left/bottom-right | Native `nwse-resize` |
| Resize top-right/bottom-left | Native `nesw-resize` |

Resolve cursor variables from imported keys, for example `url(${cursors.arrow}), default`. Preserve each CUR file's intrinsic hotspot.
Use the arrow on shell buttons. Native Windows buttons do not use the link cursor.

## 9. Components and state

| File | Responsibility |
| --- | --- |
| `src/boot/BootSequence.tsx` | Own preload, elapsed time, stage changes, and the startup sound request |
| `src/boot/BootScreen.tsx` | Draw the black stage and the 105-frame activity sprite |
| `src/boot/WelcomeScreen.tsx` | Draw logon background, spinner, and status text |
| `src/boot/boot.css` | Define boot positions, sprite viewport, and welcome transition |
| `src/shell/Desktop.tsx` | Compose wallpaper, icons, windows, taskbar, and Start menu inside `.win7` |
| `src/shell/DesktopIcon.tsx` | Handle selection, double-click, Enter, and icon label |
| `src/shell/Taskbar.tsx` | Draw app buttons and apply group focus/minimize behavior |
| `src/shell/StartButton.tsx` | Select the 3 sprite states and expose expanded state |
| `src/shell/NotificationArea.tsx` | Draw CSS vectors, clock, and Show desktop |
| `src/shell/StartMenu.tsx` | Own pinned/recent lists, search, right links, and power popup |
| `src/shell/WindowFrame.tsx` | Compose 7.css frame, controls, focus, drag, resize, and minimize transform |
| `src/shell/shell.css` | Define shell geometry and glass overrides from this spec |
| `src/stores/windowStore.ts` | Own app windows, normal rectangles, focus, z-order, and Show desktop set |
| `src/stores/shellStore.ts` | Own boot stage, Start state, icon selection, recent app IDs, and bin count |
| `src/lib/apps.ts` | Define app IDs, titles, icon keys, initial rectangles, and React.lazy factories |
| `src/lib/sound.ts` | Own shared audio context, buffer cache, input unlock, and event-to-key map |
| `src/lib/windowGeometry.ts` | Calculate work area, drag limits, resize limits, and task button transforms |

Use this shape in the Zustand window store. Keep DOM nodes, pointer offsets, audio nodes, and animation frames outside the store.
Use app IDs from the app registry. Each registry entry uses `React.lazy` and its imported icon key.

```ts
type Rect = { x: number; y: number; width: number; height: number }
type WindowMode = 'normal' | 'maximized'
type WindowRecord = {
  id: string
  appId: AppId
  title: string
  normalRect: Rect
  mode: WindowMode
  minimized: boolean
}
type WindowStore = {
  windows: Record<string, WindowRecord>
  order: string[]
  activeId: string | null
  desktopRestoreIds: string[]
  open: (appId: AppId) => void
  close: (id: string) => void
  focus: (id: string) => void
  setNormalRect: (id: string, rect: Rect) => void
  minimize: (id: string) => void
  restore: (id: string) => void
  toggleMaximize: (id: string) => void
  toggleDesktop: () => void
}
```

Store order from back to front. Compute z-index as 100 plus the visible order index.
Keep activeId null when 0 windows are visible. Never focus a minimized window without restore.
Use 1 instance per app for the initial build. An open action restores an existing instance instead of a duplicate.
Keep the last 6 distinct unpinned app IDs in shell state. Do not persist open windows or boot stage across page loads.
Keep app content mounted through minimize. Use a Suspense fallback with the normal frame and a 24px spinner.

| ryOS source | Port | Cut |
| --- | --- | --- |
| BootScreen | Stage cleanup, preload before reveal, completion callback | Random progress, Radix dialog, theme branches, debug UI |
| StartMenu | Registry app launch, close after launch, explicit open state | i18n, XP sidebar, emoji, About dialog, Radix dependency |
| WindowFrame | Frame/content boundary, saved rectangle, focus and close lifecycle | Drawer, Exposé, phone sheets, dock offsets, Motion |
| useSound | Shared context, decoded buffer cache, pending-fetch map, source cleanup | Theme sounds, mobile quotas, global audio settings, retries framework |
| useWindowManager | Work-area clamp, pointer offset, transient geometry, final store commit | Menu-bar insets, theme metrics, touch sheets, move/resize sounds |
| xp theme | Explicit taskbar/work-area dimensions | Theme registry, XP wallpaper, 30px taskbar value |
| xp-custom.css | Scoped chrome and title/body separation | Entire XP stylesheet, XP fonts, XP control images |

The reference `WindowFrame.tsx` only re-exports its implementation from `layout/window-frame/WindowFrame.tsx`.
Do not copy the XP palette or dimensions. The values in this file define the Windows 7 shell.
Do not add Radix, Motion, an icon package, an i18n package, or a theme engine.

### Verification and limits

Check the build with `corepack pnpm@11.5.0 build`. Compare the shell at 1366 × 768 and 100% zoom.
Check sprite dimensions after asset delivery. The boot sheet is 1400 × 3000px. The orb sheet is 108 × 324px, shown at 54 × 162px.
Check active, inactive, maximized, minimized, and restored windows. Check each Start link and each keyboard exit.
The 7000/2000/500 ms sequence is a fixed demo sequence. Windows boot duration depends on hardware.
Glass gradients, menu dimensions, spinner bars, and notification vectors need comparison with a Windows 7 screenshot.
The sound contract cannot reproduce every Windows Default event. Check the silent event assignments against a clean Windows 7 installation.

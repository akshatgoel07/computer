# Explorer and Aero build spec

This spec extends [the shell spec](design.md). The target is Windows 7 SP1, Aero, English, 96 DPI, and 100% zoom. The reference viewport is 1366 × 768px. The work area is 1366 × 728px. Sections 2, 3, 4, 5, 6, 7, and 8 of `design.md` define the desktop, taskbar, Start menu, frame, sounds, fonts, and cursors.

This file replaces their Explorer destinations, game entries, app instance limit, taskbar glow, and Peek behavior. The site contains 0 games. All other shell rules remain in effect. All app chrome uses `.win7`. Each app uses `React.lazy` and the `@/` alias.

Exact CSS values below define the replica. They are not all measurements from an original installation. Values with status C need calibration against Windows 7 SP1. Values with status D follow a documented API default. Status R identifies a deliberate scope or browser restriction. Each table inherits C unless it states D or R.

The final table lists every calibration group. Asset paths occur only in the asset table. Components read keys from `@/assets`.

## 1. Virtual file system

### Physical tree and shell locations

The physical root is `C:\`. Each indentation level below denotes 1 parent relation. The shell hides hidden nodes and file extensions by default. The data retains the complete file name.

```text
C:\
  PerfLogs
  Program Files
    Common Files
    Internet Explorer
    Windows Media Player
  Program Files (x86)
    Common Files
  Users
    Akshat
      Contacts
      Desktop
      Documents
      Downloads
      Favorites
      Links
      Music
      Pictures
      Saved Games
      Searches
      Videos
    Public
      Documents
      Downloads
      Music
        Sample Music
          Kalimba.mp3
          Maid with the Flaxen Hair.mp3
          Sleep Away.mp3
      Pictures
        Sample Pictures
          Chrysanthemum.jpg
          Desert.jpg
          Hydrangeas.jpg
          Jellyfish.jpg
          Koala.jpg
          Lighthouse.jpg
          Penguins.jpg
          Tulips.jpg
      Videos
        Sample Videos
          Wildlife.wmv
  Windows
    System32
    Web
      Wallpaper
```

`Program Files (x86)` selects the 64 bit installation target. The Windows folders are inert replicas, with 0 executable system files. All folders without listed files start empty. A new text document starts empty.

No extra sample document represents a stock Windows file. `Desktop` combines `C:\Users\Akshat\Desktop` with 2 shell items, Computer and Recycle Bin. Shell items are not physical files.

`Akshat` opens `C:\Users\Akshat`. `Computer` contains Local Disk (C:) and DVD RW Drive (D:), with 0 disc items. `Libraries` contains Documents, Music, Pictures, and Videos. Each library merges the Akshat and Public folders of the same type without copies. The library default save location is its Akshat folder. The Public location supplies Sample Pictures, Sample Music, and Sample Videos.

Favorites contains Desktop, Downloads, and Recent Places. Recent Places contains the last 10 distinct physical folders after navigation. Homegroup and Network start with 0 remote nodes. They show `No other homegroup computers are currently available.` and `No computers found.` The Recycle Bin is a shell query over deleted roots. It is not a writable folder under `C:\`.

### Data shape

The expanded asset contract supplies `icons`, `images`, and `media`. Only current asset keys and the keys in section 9 enter seed data. Stable IDs prevent rename from invalidation of history, libraries, selection, and shortcuts. Paths derive from parent IDs.

```ts
import { icons, images, media } from '@/assets'
type NodeId = string & { readonly __brand: 'NodeId' }
type IconKey = keyof typeof icons
type ImageKey = keyof typeof images
type MediaKey = keyof typeof media
type Template = 'general' | 'documents' | 'music' | 'pictures' | 'videos'
type Payload =
	| { kind: 'text'; text: string }
	| { kind: 'image'; key: ImageKey }
	| { kind: 'audio'; key: MediaKey }
	| { kind: 'video'; key: MediaKey }
	| { kind: 'shortcut'; target: Location }
type BaseNode = {
	id: NodeId; parentId: NodeId | null; name: string; icon: IconKey
	createdAt: number; modifiedAt: number; protected: boolean; hidden: boolean
}
type FsNode = BaseNode & (
	| { kind: 'folder'; template: Template }
	| { kind: 'file'; bytes: number; payload: Payload }
)
type Library = 'documents' | 'music' | 'pictures' | 'videos'
type Location =
	| { kind: 'folder'; id: NodeId }
	| { kind: 'library'; library: Library }
	| { kind: 'shell'; name: 'desktop' | 'libraries' | 'computer' | 'bin' | 'recent' | 'homegroup' | 'network' }
type TrashEntry = { id: NodeId; originalParentId: NodeId; originalLocation: string; deletedAt: number }
type Snapshot = { version: 1; nodes: Record<NodeId, FsNode>; bin: Record<NodeId, TrashEntry> }
type FsError = 'invalidName' | 'duplicate' | 'cycle' | 'protected' | 'missing' | 'quota' | 'restoreConflict'
type Result<T> = { ok: true; value: T } | { ok: false; error: FsError }
type FsStore = Snapshot & {
	createFolder: (parent: NodeId, name?: string) => Result<NodeId>
	createText: (parent: NodeId, name?: string) => Result<NodeId>
	rename: (id: NodeId, name: string) => Result<void>
	deleteToBin: (ids: NodeId[], now: number) => Result<void>
	deletePermanently: (ids: NodeId[]) => Result<void>
	restore: (ids: NodeId[], conflict?: 'fail' | 'keepBoth') => Result<void>
	emptyBin: () => Result<void>
	move: (ids: NodeId[], parent: NodeId) => Result<void>
	copy: (ids: NodeId[], parent: NodeId) => Result<NodeId[]>
	createShortcut: (id: NodeId, parent: NodeId) => Result<NodeId>
	writeText: (id: NodeId, text: string) => Result<void>
}
type View = 'extraLarge' | 'large' | 'medium' | 'small' | 'list' | 'details' | 'tiles' | 'content'
type ExplorerSession = {
	location: Location; history: Location[]; historyIndex: number
	selection: NodeId[]; anchor: NodeId | null; view: View
	sort: { field: string; descending: boolean }; query: string
}
type ExplorerStore = {
	sessions: Record<string, ExplorerSession>
	navigate: (windowId: string, location: Location) => Result<void>
	back: (windowId: string) => void
	forward: (windowId: string) => void
	up: (windowId: string) => void
	refresh: (windowId: string) => void
}
```

### Store rules

The Zustand file store owns the graph. The Explorer store owns navigation per window. Each Explorer window has an independent history. A new navigation removes forward history. Back and Forward move the index. Refresh preserves history and selection for IDs that still exist.

Backspace opens the parent, as in Windows 7. A library root opens Libraries. A drive root opens Computer.

The store validates names once at the action boundary. It rejects empty names, reserved DOS names, final spaces, and final periods. The invalid characters are `< > : " / \ | ? *` and code points 0 through 31. Name length is 1 through 255 characters. Sibling names compare without case sensitivity. A rename that changes only letter case succeeds.

Duplicate names never overwrite files.

New folder names are `New folder`, `New folder (2)`, then the smallest free integer suffix. Text names start with `New Text Document.txt`. Protected nodes include C:, system folders, Users, Public, Akshat, and their standard folders. Sample files and sample folders remain editable. A move rejects its source folder, its descendants, deleted parents, and protected nodes. Multi item actions commit all items or 0 items.

A delete reduces the selected set to its highest roots. It keeps descendants attached to each root and sets each root parent to null. The bin stores the prior parent ID, prior parent path, and delete time. Normal queries exclude every bin root and its descendants. Restore reconnects each root to its prior parent. If that parent is in the bin, restore its ancestor chain first.

If the prior parent no longer exists, recreate its prior folder chain. A file at any required path stops restore with `restoreConflict`. A duplicate name stops restore with `restoreConflict` in the default `fail` mode. The dialog offers `Keep both files` and `Cancel`. Keep both invokes `restore(ids, 'keepBoth')` and selects the smallest free suffix before the extension. The first suffix is ` (2)`.

Empty Bin and permanent delete remove the complete subtree.

A second empty action succeeds with 0 changes and 0 sound calls.

Libraries, Recent Places, and Desktop derive their results from this graph. They never own another copy of a file. Copy generates new IDs for the complete subtree. Cut preserves IDs. Paste rejects conflicts before mutation. A shortcut stores its target location.

The persist key is `computer.fs.v1`. Zustand `persist` stores `{ version: 1, nodes, bin }` as JSON in `localStorage`. A fresh key creates the seed once. A valid saved tree never restores deleted sample files after reload. The boundary parser checks version, node variants, asset keys, parent references, bin references, and cycles before use.

Invalid JSON or an unsupported version preserves the original value under `computer.fs.recovery.<timestamp>` before a new seed. If recovery cannot save, preserve the original key and use an in memory seed. Never silently overwrite an unreadable tree. Each mutation serializes its candidate before store commit. A storage exception preserves the prior graph and returns `quota`.

Metadata and text use at most 2097152 UTF 8 bytes. Images and music remain static assets, with 0 binary data in storage. Persist desktop cells and folder view preferences under `computer.desktop.v1` and `computer.explorer.v1`. Do not persist open windows or transient selection. The first build supports 1 active browser tab. Cross tab mutation and OS file access remain outside scope, status R.

## 2. Explorer window anatomy

### Frame and navigation bar

The initial outer rectangle is 800 × 520px at x=80px, y=60px. The minimum outer size is 640 × 360px. The 8px frame and 30px title area follow `design.md`, section 5. Explorer shows 0 title text and 0 title icon. The accessibility name and taskbar caption still use the current folder name. Caption buttons retain the 7.css artwork.

All body text uses Segoe UI, weight 400, letter spacing 0px. The default font is 12px with 16px line height. Coordinates below start at the outer frame. Inner width is outer width minus 16px.

| Part | Exact geometry and style |
| --- | --- |
| Navigation band | x=8px, y=30px, width=inner width, height=31px, transparent glass |
| Band grid | Columns `29px 29px 14px minmax(120px,1fr) 200px`, gap 2px, horizontal padding 4px, center alignment |
| Back and Forward | Hit area 29 × 29px, visible circle 27 × 27px, `sprites.explorerNavigation` |
| Navigation states | Sprite cells 0, 1, 2, 3 for Back normal, hover, pressed, disabled. Cells 4, 5, 6, 7 for Forward |
| Recent pages | 14 × 27px, centered 5 × 3px triangle `#34495d`, border 0px at rest |
| Recent hover | Border 1px `#7da2ce`, radius 2px, fill `linear-gradient(180deg,#f3f9ff 0%,#d6ebff 100%)` |
| Address field | Height 23px, fill `#ffffff`, border 1px `#7f9db9`, radius 0px, inset shadow `0 1px 2px rgba(0,0,0,0.12)` |
| Address layout | Icon 16px with left inset 3px, gap 4px, breadcrumb area flexible, refresh slot 24px |
| Breadcrumb segment | Height 21px, horizontal padding 4px, text `#000000`, chevron slot 12px |
| Breadcrumb chevron | `icons.chevronRight` at 8 × 8px, center alignment, child menu width 180px |
| Segment hover | Border 1px `#a9c8e9`, fill `linear-gradient(180deg,#f4f9fe 0%,#e4f0fc 100%)` |
| Overflow | Width 18px, label `»`, removes oldest segments first, keeps current segment visible |
| Refresh | 24 × 21px, glyph `icons.refresh` at 16px, left border 1px `#d7dce1` |
| Search | 200 × 23px, address field border and fill, left inset 5px, right inset 22px |
| Search placeholder | `Search <folder name>`, italic 12px/18px, `#6d6d6d`, glyph `icons.search` at 16px |
| Search focus | Border `#3c7fb1`, text `#000000`, font style normal |

Back and Forward disable at history limits. The recent menu lists up to 12 history entries, newest first, with a check on the current entry. Each segment click opens that ancestor. Each chevron opens its immediate child folders, sorted by name, with the current child in bold. The overflow menu lists hidden ancestors. All breadcrumb menus use section 4 geometry.

A click in unused address space or Alt+D replaces breadcrumbs with a text input and selects the full path. Enter resolves a case insensitive physical path or a shell display name. Escape restores breadcrumbs without navigation. An invalid path preserves the current location and shows `Windows cannot find '<path>'. Check the spelling and try again.`

The path dialog title is `Windows Explorer`. Its button is `OK`. It uses `icons.error` at 32px and `sounds.critical`. Search filters descendants of the current location by name after 200ms. An empty query restores the folder view and its prior selection. The result view shows `No items match your search.` at x=8px, y=8px when the result count is 0.

### Command bar and panes

| Part | Exact geometry and style |
| --- | --- |
| Command bar | x=8px, y=61px, inner width, height 32px, bottom border 1px `#b6c6d6` |
| Command background | `linear-gradient(180deg,#f5f9fd 0%,#e8f1fb 49%,#dce9f8 50%,#d5e5f7 100%)` |
| Command buttons | Height 24px, horizontal padding 8px, gap 4px, text `#1e395b`, arrow 5 × 3px |
| Command hover | Border 1px `#a4b5c8`, radius 2px, fill `linear-gradient(180deg,#ffffff 0%,#dceafa 100%)` |
| Command pressed | Border `#7f9db9`, fill `#c5ddf6`, inset shadow `0 1px 2px rgba(0,0,0,0.18)` |
| Right controls | Views 38px, preview 26px, help 26px, each 24px high, glyphs 16px |
| Navigation pane | x=8px, y=93px, width 182px, height=outer height minus 157px, fill `#ffffff` |
| Pane divider | Last 1px of navigation pane, `#d6e5f5`, resize hit area 4px, width limits 120px and 320px |
| Content | x=190px, y=93px, width=outer width minus 198px, height=outer height minus 157px, fill `#ffffff` |
| Details pane | x=8px, bottom=8px, inner width, height 56px, top border 1px `#c5d7e8` |
| Details background | `linear-gradient(180deg,#f5f9fd 0%,#e4effb 100%)`, text `#1e395b` |

The command bar reserves 94px at its right. At narrow widths, last text commands enter a `»` menu of width 224px. `Organize` remains first. The initial selection contains 0 items.

| Location or selection | Commands after Organize, in order |
| --- | --- |
| Computer | `System properties`, `Uninstall or change a program`, `Map network drive`, `Open Control Panel` |
| General folder, 0 items | `Include in library`, `Share with`, `Burn`, `New folder` |
| Libraries root | `New library` |
| Documents library | `Share with`, `Burn`, `New folder` |
| Pictures or picture selection | `Preview`, `Slide show`, `Share with`, `Burn`, `New folder` |
| Music or audio selection | `Play all`, `Share with`, `Burn`, `New folder` |
| Videos | `Play all`, `Share with`, `Burn`, `New folder` |
| Recycle Bin, 0 selected | `Empty the Recycle Bin`, `Restore all items` |
| Recycle Bin, 1 selected | `Empty the Recycle Bin`, `Restore this item` |
| Recycle Bin, 2 or more selected | `Empty the Recycle Bin`, `Restore the selected items` |

Organize contains `Cut`, `Copy`, `Paste`, separator, `Undo`, `Redo`, separator, `Select all`, separator, `Layout` submenu, `Folder and search options`, separator, `Delete`, `Rename`, separator, `Properties`, separator, `Close`. The Layout submenu contains `Menu bar`, `Details pane`, `Preview pane`, and `Navigation pane`. Check marks reflect current visibility.

Alt reveals a 20px menu bar with `File`, `Edit`, `View`, `Tools`, and `Help`. The bar shifts later bands down 20px. Build Cut, Copy, Paste, Select all, Delete, Rename, Close, pane toggles, and New folder now. Undo, Redo, New library, Include in library, Share with, Burn, and OS control commands remain disabled, status R.

No disabled command opens a placeholder window. A later part can supply its native dialog without a new menu layout. Preview opens the selected picture. Slide show advances pictures every 5000ms. Play all queues the current audio files. The preview pane starts hidden.

Its width is 200px with a 1px `#d6e5f5` left border. It reduces content width.

It shows a fitted picture, text up to 4096 characters, or `No preview available.` It never starts audio or video. The help button opens a local 480 × 320px window titled `Windows Help and Support`, with the keyboard table from section 4.

### Navigation pane

The pane starts with 8px top padding. Rows are 22px high. Root icon x=20px, root text x=42px, child indent 16px. Icons are 16 × 16px. Expand hit areas are 16 × 22px, with 7 × 7px triangles. Label padding is 3px vertically.

All roots start expanded except Homegroup, Computer, and Network. Libraries expands to its 4 libraries.

Favorites contains Desktop, Downloads, and Recent Places. The next roots are Libraries, Homegroup, Computer, and Network. Computer expands to Local Disk (C:) and DVD RW Drive (D:). Empty nodes display 0 expand arrows. The root gap is 8px after the last child. Root text uses weight 400.

Favorites is a group, not a navigable folder.

The pane fades arrows from opacity 0 to 1 in 150ms on pointer entry. Keyboard focus also reveals arrows. Collapsed arrows use `#7a7a7a`. Expanded arrows use `#353535`. Hover arrows use `#1c87d3`. Hover rows use fill `#f0f6fc`, border 1px `#d8eaf9`, and radius 2px.

Active selection uses fill `linear-gradient(180deg,#eaf5fd 0%,#cfe8fc 100%)` and border 1px `#7da2ce`. Inactive selection uses fill `#f0f0f0` and border 1px `#d9d9d9`. Selection covers the visible row width minus 2px. Left collapses a branch or selects its parent. Right expands a branch or selects its first child. Enter navigates to the focused folder.

### Content and views

| View | Image | Item cell or row | Label and metadata |
| --- | --- | --- | --- |
| Extra large icons | 256 × 256px | 274 × 300px | Centered, 2 lines, 12px/16px |
| Large icons | 96 × 96px | 112 × 136px | Centered, 2 lines, 12px/16px |
| Medium icons | 48 × 48px | 74 × 88px | Centered, 2 lines, 12px/16px |
| Small icons | 16 × 16px | 180 × 22px | 1 line, left alignment, gap 4px |
| List | 16 × 16px | 180 × 22px | Vertical fill before next column, 1 line |
| Details | 16 × 16px | Full width × 22px | Columns below, icon inset 4px, text inset 24px |
| Tiles | 48 × 48px | 252 × 62px | Name, type, size, 16px line height, gap 8px |
| Content | 32 × 32px | Full width × 68px | Name, type, date, size, bottom border 1px `#eeeeee` |

Icon layouts use 4px column gaps and 4px row gaps. The content padding is 4px, except Details, which uses 0px. Small icons fill across then down. List fills down then across. Image thumbnails preserve aspect ratio inside the image box. A folder uses `icons.folder`; its image never enlarges above its delivered 256px source.

General folders, Documents, Downloads, and the bin default to Details. Pictures and Sample Pictures default to Large icons. Music and Sample Music default to Details. Videos default to Large icons. Libraries, Computer, and Akshat default to Tiles. The Views icon cycles Details, Large icons, then Tiles.

Its separate arrow opens the full menu.

The menu is 180 × 238px, with 8 labels in the table order and a 20px slider column at the left. The slider track is 2 × 196px at x=12px, y=20px, fill `#a9b3bd`. Its thumb is 11 × 17px, fill `#eaf2fb`. The 8 slider stops are y=24, 51, 78, 105, 132, 159, 186, and 213px. Each stop selects 1 view.

| Details template | Columns and initial widths |
| --- | --- |
| General and Documents | `Name` 240px, `Date modified` 150px, `Type` 150px, `Size` 90px |
| Pictures | `Name` 240px, `Date` 150px, `Tags` 120px, `Size` 90px, `Rating` 100px |
| Music | `Name` 220px, `#` 36px, `Title` 180px, `Contributing artists` 150px, `Album` 150px |
| Videos | `Name` 240px, `Date` 150px, `Type` 150px, `Size` 90px, `Length` 90px |
| Recycle Bin | `Name` 220px, `Original Location` 220px, `Date Deleted` 160px, `Size` 90px, `Item type` 140px, `Date modified` 150px |

Headers are 24px high, with fill `#ffffff`, bottom border 1px `#d5d5d5`, and right border 1px `#eeeeee`. Header hover uses `linear-gradient(180deg,#f2f9fe 0%,#d9efff 100%)`. Text inset is 6px. Resize targets are 4px wide. A header click changes sort direction. The active header has a 7 × 4px arrow, centered 3px below its top edge.

Names sort with folders first and natural numeric order. Size sorts numerically. Dates sort by numeric timestamps. Sizes use 1024 byte units and round up to whole KB in Details. Empty size cells identify folders. Dates use local `M/d/yyyy h:mm tt`.

Seed metadata comes from the delivered files, without invented file sizes or track lengths.

Computer uses `Hard Disk Drives (1)` and `Devices with Removable Storage (1)` group labels in 15px/20px, color `#1e3287`. Each group header is 28px high. A 1px `#d9e4ef` rule starts 8px after its text. Group insets are 12px. The drive tile is 280 × 70px. Its icon is 48px, its text inset is 64px, and its first label is `Local Disk (C:)`.

The capacity bar is 180 × 14px, border 1px `#bcbcbc`, radius 2px, background `#eeeeee`, with 10px below the name. The fixed demo capacity is 107374182400 bytes. Free space is 64424509440 bytes, status R. The label is `60.0 GB free of 100 GB`. Used width is 40%. Its fill is `linear-gradient(180deg,#a4ddfa 0%,#46a9de 48%,#078bc9 49%,#36b6ec 100%)`.

At less than 10% free, the fill is `linear-gradient(180deg,#ffa5a5 0%,#e52626 100%)`. The DVD label is `DVD RW Drive (D:)`. Its capacity bar is absent. Enter shows `Please insert a disc into drive D:.` with `Cancel`.

```css
.win7 .file-item {
	border: 1px solid rgba(255,255,255,0); border-radius: 2px; color: #000000;
}
.win7 .file-item:hover {
	border-color: #b8d6fb; background: linear-gradient(180deg,#f5faff 0%,#e8f3fd 100%);
}
.win7 .file-item[aria-selected="true"] {
	border-color: #7da2ce; background: linear-gradient(180deg,#eaf5fd 0%,#cfe8fc 100%); box-shadow: inset 0 0 0 1px #ffffff;
}
.win7 .file-list[data-focused="false"] .file-item[aria-selected="true"] {
	border-color: #d9d9d9; background: #f0f0f0;
}
.win7 .rubber-band {
	border: 1px solid #3399ff; background: rgba(51,153,255,0.20); pointer-events: none;
}
```

A single click selects 1 item. Ctrl toggles an item. Shift selects a range from the anchor. Ctrl+Shift adds the range. A blank area click clears selection. A blank area drag selects every intersected item rectangle after 4px of movement.

Ctrl with a rectangle toggles the intersected set against the initial selection. Pointer capture ends the rectangle on pointerup or Escape.

The empty folder text is exactly `This folder is empty.` It uses 12px/16px, `#6d6d6d`, horizontally centered, 12px below content top. The details pane uses a 32px icon at x=12px, y=12px. Its text starts at x=56px, y=10px. With 0 selected items, it shows the folder icon and `<N> items`, or `1 item`, on its first line.

With 1 selected item, it shows the name at 13px/18px and the type at 12px/16px, followed by its size. With 2 or more selected items, it shows `<N> items selected` and the sum of file sizes. Folder descendants do not enter this sum.

## 3. Recycle Bin

The desktop uses `icons.recycleEmpty` at count 0 and `icons.recycleFull` at count 1 or more. The count includes deleted roots, not their descendants. The icon changes in the same commit as the graph. The bin uses the Explorer frame, Details view, and the columns in section 2. Its address and taskbar caption are `Recycle Bin`.

Empty and Restore all disable at count 0. Restore this item requires 1 selection. Double click opens item Properties, without file execution. Restore returns the original folder selection to that item if its Explorer window remains open.

| Dialog case | Title | Exact question | Icon |
| --- | --- | --- | --- |
| Recycle 1 file | `Delete File` | `Are you sure you want to move this file to the Recycle Bin?` | File icon, 48px |
| Recycle 1 folder | `Delete Folder` | `Are you sure you want to move this folder to the Recycle Bin?` | `icons.folder`, 48px |
| Recycle N roots | `Delete Multiple Items` | `Are you sure you want to move these <N> items to the Recycle Bin?` | `icons.recycleFull`, 32px |
| Permanent 1 file | `Delete File` | `Are you sure you want to permanently delete this file?` | File icon, 48px |
| Permanent 1 folder | `Delete Folder` | `Are you sure you want to permanently delete this folder?` | `icons.folder`, 48px |
| Permanent N roots or Empty N roots | `Delete Multiple Items` | `Are you sure you want to permanently delete these <N> items?` | `icons.recycleFull`, 32px |

For Empty at count 1, use the single item permanent dialog for that item type. `<N>` is the root count at dialog creation. Single item dialogs show the full name, type, size for a file, and modified date beneath the question. Dialog width is 458px. Height is 206px for 1 item and 154px for multiple items. Clamp to the viewport with an 8px margin.

The dialog uses the 7.css frame with 0 minimize and maximize buttons. Its title font follows `design.md`, section 7. The body is `#ffffff`. The footer is 42px high, fill `#f0f0f0`, with top border 1px `#dfdfdf`. The body padding is 16px. The icon occupies the left column.

The gap between the icon and text is 12px.

Buttons are `Yes` then `No`, each 75 × 23px, with a 7px gap and 11px right inset. Yes has initial focus. Escape and the caption Close button select No. Tab cycles the buttons. Enter activates the focused button. The dialog blocks its owner and desktop file actions.

It never uses the browser confirm dialog.

Revalidate the IDs on Yes. Cancel preserves every node and plays 0 sounds. The entry sound is silent because the contract lacks `Windows Question`. Its exact native assignment needs verification, status C. Confirmed recycle plays `sounds.recycle` once, as the brief requires. Confirmed Empty also plays `sounds.recycle` once.

The delete sound is a replica override, status R. The native event name is Empty Recycle Bin, not Delete File. Permanent delete and restore play 0 sounds. The Properties option `Display delete confirmation dialog` starts checked, status D. The first build retains that option at its default. Shift+Delete always uses the permanent dialog.

## 4. Desktop interactions and context menus

### Menu contents

A `|` in the next table denotes 1 separator. A `>` denotes a submenu. A check denotes a state, not text. The menu order is fixed. Labels below are English Windows 7 labels. Accelerator underlines appear after Alt input.

| Target | Exact order |
| --- | --- |
| Desktop blank | `View >`, `Sort by >`, `Refresh`, `|`, `Paste`, `Paste shortcut`, `|`, `New >`, `|`, `Screen resolution`, `Gadgets`, `Personalize` |
| Desktop View | `Large icons`, `Medium icons`, `Small icons`, `|`, `Auto arrange icons`, `Align icons to grid`, `|`, `Show desktop icons`, `Show desktop gadgets` |
| Sort by | `Name`, `Size`, `Item type`, `Date modified` |
| New | `Folder`, `Shortcut`, `|`, `Text Document` |
| Explorer blank | `View >`, `Sort by >`, `Group by >`, `Refresh`, `|`, `Customize this folder...`, `|`, `Paste`, `Paste shortcut`, `|`, `Share with >`, `New >`, `|`, `Properties` |
| Text file | `Open`, `Print`, `Edit`, `|`, `Open with >`, `Share with >`, `Restore previous versions`, `Send to >`, `|`, `Cut`, `Copy`, `|`, `Create shortcut`, `Delete`, `Rename`, `|`, `Properties` |
| Picture file | `Preview`, `Set as desktop background`, `Edit`, `Print`, `|`, `Rotate clockwise`, `Rotate counterclockwise`, `|`, `Open with >`, `Share with >`, `Restore previous versions`, `Send to >`, `|`, `Cut`, `Copy`, `|`, `Create shortcut`, `Delete`, `Rename`, `|`, `Properties` |
| Audio file | `Play`, `Add to Windows Media Player list`, `|`, `Open with >`, `Share with >`, `Restore previous versions`, `Send to >`, `|`, `Cut`, `Copy`, `|`, `Create shortcut`, `Delete`, `Rename`, `|`, `Properties` |
| Folder | `Open`, `Open in new window`, `|`, `Include in library >`, `Share with >`, `Restore previous versions`, `Send to >`, `|`, `Cut`, `Copy`, `|`, `Create shortcut`, `Delete`, `Rename`, `|`, `Properties` |
| Drive C: | `Open`, `Open in new window`, `|`, `Share with >`, `Restore previous versions`, `|`, `Format...`, `|`, `Copy`, `|`, `Create shortcut`, `|`, `Properties` |
| Computer desktop icon | `Open`, `|`, `Manage`, `|`, `Map network drive...`, `Disconnect network drive...`, `|`, `Create shortcut`, `Delete`, `Rename`, `|`, `Properties` |
| Recycle Bin desktop icon | `Open`, `Empty Recycle Bin`, `|`, `Create shortcut`, `Rename`, `|`, `Properties` |
| Bin item | `Restore`, `|`, `Cut`, `Delete`, `|`, `Properties` |
| Shortcut | `Open`, `Open file location`, `|`, `Cut`, `Copy`, `|`, `Delete`, `Rename`, `|`, `Properties` |

The reference menu set excludes installed shell extensions. Windows edition, file associations, and installed programs can change native entries, status C. Group by contains `Name`, `Date modified`, `Type`, `Size`, separator, and `(None)`. The initial check is `(None)` except Computer. Share with contains `Nobody`, `Homegroup (Read)`, `Homegroup (Read/Write)`, and `Specific people...`.

Send to contains `Compressed (zipped) folder`, `Desktop (create shortcut)`, `Documents`, `Fax recipient`, and `Mail recipient`. Include in library contains `Documents`, `Music`, `Pictures`, `Videos`, separator, and `Create new library...`. Open with contains the associated viewer and `Choose default program...`. These viewer choices use the registry in section 8.

Build Open, navigation, Cut, Copy, Paste, Paste shortcut, file Create shortcut, Delete, Rename, Refresh, selection, and desktop View now. Desktop shortcut creation selects `C:\Users\Akshat\Desktop`. File Create shortcut selects the current writable folder. Disable every other menu action until its real dialog or operation exists, status R. This includes New Shortcut and shell icon rename.

Protected nodes disable Cut, Delete, and Rename. Empty Bin disables at count 0. Paste and Paste shortcut disable without a valid clipboard. New contains only implemented file types, status R. Desktop View starts with Medium icons, Align icons to grid, and Show desktop icons checked. Auto arrange icons starts unchecked.

Show desktop gadgets starts checked but contains 0 gadgets.

### Menu geometry and behavior

Menus use fill `#f0f0f0`, border 1px `#979797`, radius 0px, padding 2px, and shadow `2px 2px 4px rgba(0,0,0,0.35)`. The default width is 208px. File menus use 256px. Width expands in 8px steps if a label needs more space. Each row is 22px high. The icon column is 28px wide.

Its right rule is 1px `#e2e3e3` with a 1px `#ffffff` highlight.

Icons are 16px with a 5px left inset. Text starts at 32px and reserves 20px at the right. Text is 12px/16px, `#000000`. Disabled text is `#6d6d6d`. The submenu arrow is 4 × 7px, right inset 9px, `#000000`. A separator occupies 7px.

Its rule starts at x=30px, uses 1px `#d7d7d7`, and has a 1px `#ffffff` lower highlight.

Hover uses border 1px `#aecff7`, radius 2px, fill `linear-gradient(180deg,#f1f7fd 0%,#dceafc 100%)`. A check uses a 16px `icons.check` image inside a 22px square with fill `#d9e9fb` and border 1px `#aecff7`. A submenu opens after 400ms of hover, status C. Keyboard Right opens it at 0ms. Keyboard Left closes it at 0ms.

Submenus overlap the parent border by 3px. They align their top border with the parent row top minus 3px. Clamp all menus 2px inside the viewport. Flip submenus left if the right space is too small. Scroll long menus within that bound. Right click selects its target before menu entry.

Right click on a selected item preserves the complete selected set.

Outside pointerdown, Escape, or a command closes the menu. Up and Down skip separators and disabled rows. Enter executes the focused row. Shift+F10 and the Menu key open the menu at the selected item. Native browser context menus remain available outside the replica.

### Grid, rename, and keyboard

Desktop cell size, icon size, and labels follow `design.md`, section 2. Only Computer and Recycle Bin occupy its first 2 cells. A drag starts after 4px. The selected set moves with the pointer. The drag image has opacity 0.50 and the original labels stay visible. Align icons to grid rounds the final position to 76px columns and 100px rows.

Reserved cells include the taskbar and current icons.

If the target cell is occupied, use the nearest free cell by squared distance, then column and row order. Auto arrange sorts by the selected field after each change. Manual drag disables Auto arrange. Grid alignment remains unchanged. Desktop Large, Medium, and Small use 96px, 48px, and 32px images. Their cells are 112 × 136px, 76 × 100px, and 60 × 76px.

A folder drop moves files. Ctrl with a drop copies files. A Recycle Bin drop opens the normal delete confirmation. The clipboard belongs to the replica. Cut icons use opacity 0.50 until Paste or Escape. External file import remains outside scope, status R.

F2 opens an inline input, border 1px `#646464`, fill `#ffffff`, text `#000000`, padding 1px, font 12px/15px.

Desktop input width is 74px with 2 lines. Details input fits the Name column minus 24px. It uses 1 line. Select the base name for a file and the full name for a folder. Hidden extensions remain outside the editable span. Enter commits the name.

Escape cancels it. A click outside commits a valid name. An invalid name keeps the input and selects its text.

New folder creates the next free name, selects the folder, scrolls it into view, and enters rename at 0ms. Escape cancels only the name edit. The folder remains with its generated name.

| Key | Action outside a text input |
| --- | --- |
| Delete | Confirm delete to the bin. Inside the bin, confirm permanent delete |
| Shift+Delete | Confirm permanent delete without a bin entry |
| Enter | Open the selected item. Multiple selected files open their associated viewers |
| F2 | Rename exactly 1 writable item |
| Ctrl+A | Select all visible items in the focused pane |
| Arrow keys | Move focus by the current layout. Shift extends selection. Ctrl moves focus without selection |
| Alt+Left, Alt+Right | Move Back or Forward in Explorer history |
| Backspace | Open the parent in Explorer, never browser history |
| F5 | Refresh the focused folder or desktop, without a page reload |
| Ctrl+C, Ctrl+X, Ctrl+V | Copy, Cut, Paste within the replica |
| Ctrl+Shift+N | Create a folder in the current writable folder |
| Alt+Enter | Open item Properties when that dialog exists. Otherwise disable the command |

Text inputs receive native text edits and Delete. A modal dialog owns keys until close. Prevent browser defaults only for a handled key.

## 5. Simple viewers

Viewers use the current frame and font rules. Their menus use section 4. Their controls use 7.css inside `.win7`. The app registry opens `.txt` in Notepad, `.jpg` and `.png` in Windows Photo Viewer, and `.mp3` in Windows Media Player. Wildlife remains visible as a sample video. Video playback remains outside this audio scope, status R.

Its Play command stays disabled.

| App | Outer size and minimum | Body, toolbar, and menus | Build now | Cut |
| --- | --- | --- | --- | --- |
| Notepad | 660 × 430px, minimum 320 × 200px | Menu 20px, `#f0f0f0`; text canvas `#ffffff`; text `#000000`; Lucida Console 13px/16px; padding 2px | Read and edit text, New, Open from the VFS, Save, Save As, Select All, Word Wrap | Print, Page Setup, font dialog, Replace, Go To |
| Windows Photo Viewer | 820 × 600px, minimum 480 × 320px | Menu 28px, `#f0f0f0`; image stage `#eef3fa`; bottom controls 52px, gradient `#f6f9fc` at 0% to `#d9e5f3` at 100% | Fit, actual size, zoom, previous, next, slide show, rotate in memory, delete through the bin dialog | Print, E mail, Burn, Open with another app, permanent image edits |
| Windows Media Player | 360 × 300px, minimum 300 × 220px | Now Playing view; title `Windows Media Player`; stage `#000000`; controls 46px, gradient `#edf3f9` at 0% to `#b6cce2` at 100% | 3 track queue, Play, Pause, Previous, Next, seek, elapsed time, volume, mute | Library mode, CD tools, media network, codecs, visualizations, video |

Notepad title is `<filename> - Notepad`. An untitled document uses `Untitled - Notepad`. Windows 7 adds 0 unsaved asterisk characters. Its menus are `File`, `Edit`, `Format`, `View`, and `Help`. Word Wrap starts unchecked. The status bar starts hidden.

File contains `New`, `Open...`, `Save`, `Save As...`, separator, `Page Setup...`, `Print...`, separator, `Exit`.

Edit contains `Undo`, separator, `Cut`, `Copy`, `Paste`, `Delete`, separator, `Find...`, `Find Next`, `Replace...`, `Go To...`, separator, `Select All`, `Time/Date`. Format contains `Word Wrap` and `Font...`. View contains `Status Bar`. Help contains `View Help`, separator, `About Notepad`. Unimplemented commands disable. Native textarea undo supplies Undo.

Find and Time/Date remain disabled in this build, status R.

Save writes the current text through the file store. Save As and Open use a VFS dialog, 560 × 390px, without host file access. An unsaved close asks `Do you want to save changes to <filename>?` with `Save`, `Don't Save`, and `Cancel`. Its dialog uses 458 × 154px. Save preserves the window if storage fails. Cancel preserves the window and text.

Photo Viewer title is `<base name> - Windows Photo Viewer`. Its menu order is `File`, `Print`, `E-mail`, `Burn`, `Open`. Its lower controls are Zoom, Actual size or Fit, Previous, Play slide show, Next, Rotate counterclockwise, Rotate clockwise, and Delete. The centered group uses 28px buttons with 4px gaps. The Play button is 44 × 44px. The zoom slider is 100 × 20px.

Zoom ranges from 10% to 400% in 10% steps. Fit never crops the picture. A double click toggles Fit and 100%. The viewer traverses pictures in the source folder sort order. At each end, Next and Previous wrap. Slide show interval is 5000ms.

Media Player starts paused on the selected file. Its center shows `media.albumKalimba`, `media.albumMaid`, or `media.albumSleepAway` at 128px. The title and artist appear below the image in Segoe UI 12px/16px, `#ffffff`. A missing cover uses `icons.audioFile` at 128px. The seek track is 4px high, inset 12px, 8px above the control group. The play button is 36px, previous and next are 24px.

The volume slider is 60 × 16px. Initial volume is 0.50. A repeat click preserves the paused or active track position. A right click menu contains `Show list`, `Full screen`, `Visualizations`, `Enhancements`, `Lyrics, captions, and subtitles`, `Help`, and `Exit`. Only Show list and Exit act now. Alt reveals `File`, `View`, `Play`, `Tools`, and `Help`; unsupported entries disable, status R.

Use 1 HTMLAudioElement. Derive duration from its metadata. Stop audio on window close. Minimize preserves playback. Sound scheme gain remains 1. Media volume never changes the sound scheme gain.

## 6. Aero animations and effects

Use CSS transitions and the Web Animations API only. Keep pointer drag geometry outside Zustand until pointerup. The window rectangles and task button rectangles use viewport coordinates. Every animation cancels its prior animation before a new transition. Use `fill: 'both'` during a transition. Commit final geometry, remove the transform, then cancel the completed animation.

Let R be the current rectangle and T be the destination. Use transform origin `0px 0px` for rectangle transitions. The rectangle transform is `translate(T.x-R.x,T.y-R.y) scale(T.width/R.width,T.height/R.height)`. Opacity and transform interpolate together. The next table replaces a prior duration only where this file states a replacement.

| Event | Delay | Duration | Easing | Exact endpoints |
| --- | --- | --- | --- | --- |
| Open | 0ms | 150ms | `cubic-bezier(0.2,0,0.2,1)` | Center origin, opacity 0 to 1, scale 0.95 to 1 |
| Close | 0ms | 150ms | `cubic-bezier(0.2,0,0.2,1)` | Center origin, opacity 1 to 0, scale 1 to 0.95 |
| Minimize | 0ms | 200ms | `cubic-bezier(0.2,0,0.2,1)` | R to task button T, opacity 1 to 0 |
| Taskbar restore | 0ms | 200ms | `cubic-bezier(0.2,0,0.2,1)` | Task button transform to identity at saved R, opacity 0 to 1 |
| Maximize | 0ms | 200ms | `cubic-bezier(0.2,0,0.2,1)` | R to work area T, opacity 1 throughout |
| Restore down | 0ms | 200ms | `cubic-bezier(0.2,0,0.2,1)` | Maximized R to saved normal T, opacity 1 throughout |
| Snap preview entry | 0ms | 150ms | `cubic-bezier(0.2,0,0.2,1)` | Preview opacity 0 to 1, scale 0.96 to 1 about destination center |
| Snap commit | 0ms | 200ms | `cubic-bezier(0.2,0,0.2,1)` | Drag rectangle to snap destination |
| Peek entry and exit | See below | 150ms | `linear` | Window body opacity 1 to 0 or 0 to 1, frame preserved |
| Start open | 0ms | 120ms | `cubic-bezier(0,0,0.2,1)` | Opacity 0 to 1, translation 0px, scale 1 |
| Start close | 0ms | 100ms | `linear` | Opacity 1 to 0, translation 0px, scale 1 |
| Context menu entry | 0ms | 150ms | `linear` | Opacity 0 to 1, translation 0px, scale 1 |
| Context menu exit | 0ms | 0ms | `linear` | Remove popup |
| Tooltip entry and exit | 500ms initial | 100ms | `linear` | Opacity 0 to 1 or 1 to 0 |

For maximize and restore, lay out the final rectangle first and animate the inverse transform to identity. This preserves the final hit area. A hidden minimized window retains its component. A closed window releases timers, media, and subscriptions after its exit animation. If a task button lacks a rectangle, minimize targets a 60 × 40px rectangle at the app button position from `design.md`, section 3.

Aero Snap activates within 1px of the left, right, or top work area edge during title drag. Pointerup commits the current preview. Left uses `(0,0,floor(W/2),H-40)`. Right uses `(floor(W/2),0,W-floor(W/2),H-40)`. Top uses the full work area. The preview has a 1px `#ffffff` inner border, 1px `#6ba3cf` outer border, radius 5px, fill `rgba(110,180,235,0.25)`.

Its shadow is `0 0 8px rgba(170,220,255,0.70)`. It remains above windows and below menus, with pointer events disabled. If the pointer leaves the edge, the preview disappears in 100ms. Drag from a snapped title restores the saved normal size under the pointer. Double click the top or bottom resize border expands height to 728px at the reference viewport. Width and x remain unchanged.

A second border double click restores the prior height and y. Title double click follows the normal maximize rule.

Aero Shake counts horizontal direction reversals during title drag. Each segment requires 20px of travel within a total 500ms interval. The third reversal minimizes all other visible windows in 200ms. A later shake of the same window restores exactly that set. Shake stores 0 windows that were already minimized. Shake detection has a 1000ms cooldown.

These thresholds have status C.

Show desktop hover starts Peek after 1000ms. It preserves glass frames and removes body content and frame titles over 150ms. The glass outline uses fill `rgba(160,205,235,0.10)`, border 1px `rgba(235,248,255,0.75)`, and the normal frame shadow. Pointer leave restores every prior state. Show desktop click follows `design.md`, section 3, independent of Peek.

The 1000ms desktop delay has status C. Published Windows 7 reports disagree between 500ms and 1000ms.

The taskbar glow follows pointer x and y within its button at 0ms delay. It replaces the fixed hover center in `design.md`. Use `radial-gradient(ellipse 40px 28px at var(--x) var(--y),var(--glow) 0%,rgba(255,255,255,0.20) 65%,rgba(255,255,255,0) 100%)`. The glow alpha is 0.80. Resolve its RGB once from the mean icon color with alpha weights. Pixels with alpha below 0.50 contribute 0 weight.

If the mean saturation is below 0.15, use RGB `(112,213,255)`. Fade glow opacity in 150ms and out 200ms, with `linear` easing. Taskbar thumbnails appear after 400ms, status C. The thumbnail shell is 216 × 164px with 8px glass padding and a 24px header. The preview region is 200 × 124px. Fit a live scaled app view with the complete image visible.

Its surface uses the current app content.

Do not capture screenshots or add a DOM image library. Reuse a read only view renderer with disabled controls and no duplicate IDs. Center the popup over the button, 8px above the taskbar, then clamp it 8px within the viewport. Entry fade is 150ms. Its header uses a 16px icon, 12px/16px caption, and an 18px Close button. Close executes the normal window close action.

Thumbnail hover starts window Peek after 500ms, status C. The target stays opaque. All other windows become glass outlines. A thumbnail click focuses its window. If the pointer leaves both button and popup, the popup closes after 300ms. Peek ends over 150ms.

Open Start, context menu, title drag, or modal entry cancels both thumbnail timers and Peek.

Tooltips use the documented initial 500ms, reshow 100ms, and maximum visible 5000ms delays, status D. Tooltip fill is `linear-gradient(180deg,#ffffff 0%,#e4e5f0 100%)`, border 1px `#767676`, radius 2px, shadow `1px 2px 3px rgba(0,0,0,0.25)`. Tooltip font is 12px/16px, color `#000000`, padding 3px vertically and 5px horizontally, maximum width 260px.

Place its top left 12px right and 20px below the pointer, then clamp 2px within the viewport. Tooltips contain 0 focusable controls. App launch uses `cursors.busy` only before the lazy module loads or the initial file decodes. The cursor starts after 100ms. Return to `cursors.arrow` at ready or failure. There is 0 artificial minimum busy duration and 0 fixed fake load delay, status R.

Under `prefers-reduced-motion: reduce`, all transition durations become 0ms. Keep hover delays, Snap thresholds, and tooltip delays unchanged. Reduced motion removes preview scale and all rectangle interpolation. Final states, focus, and accessible names remain identical.

## 7. Sound map

The sound player and input unlock follow `design.md`, section 6. Keys below already exist in `src/assets.ts`. Each committed user operation requests at most 1 sound, even with multiple files. Failed actions never request a success sound.

| Event | Key or silence | Trigger |
| --- | --- | --- |
| Explorer navigation | `sounds.navigation` | Successful breadcrumb, pane, folder, Back, Forward, or parent destination change |
| Search, Refresh, and view change | Silent | 0 sound calls |
| Delete to the bin | `sounds.recycle` | Confirmed graph commit, explicit replica override from the brief |
| Empty Bin | `sounds.recycle` | Confirmed commit with at least 1 bin root |
| Delete dialog entry | Silent | Missing Question sound key, native assignment unverified |
| Permanent delete, Restore | Silent | 0 sound calls |
| Invalid path dialog | `sounds.critical` | Dialog entry, once |
| Invalid name or prohibited key action | `sounds.ding` | Rejected action, once, without a second dialog sound |
| Storage failure | `sounds.critical` | Error dialog entry, once |
| Rename, New folder, Move, Copy, Paste | Silent | Successful graph commit, 0 sound calls |
| Context menu and submenu | Silent | `sounds.menu` remains unused |
| Open, Close, Minimize, Maximize, Restore down | Silent | `sounds.minimize` and `sounds.restore` remain unused |
| Snap, Shake, Peek, glow, thumbnails, tooltip | Silent | 0 sound calls |
| Notepad edits, Save, unsaved prompt | Silent | 0 sound calls |
| Photo zoom, rotate, next, slide show | Silent | 0 sound calls |
| Media playback | Selected `media` key | User Play only, never a Windows sound |
| Media controls | Silent | 0 extra sound calls |

Navigation to the current location produces 0 sounds. A file viewer launch produces 0 navigation sounds. A storage failure dialog says `There is not enough space to save your changes.` Its title is `Windows Explorer` and its button is `OK`. The text is a browser storage limit message, status R. Its geometry follows the 458 × 154px dialog from section 3.

## 8. Components and state

All listed files are implementation targets, not files created by this documentation change. New files use the current React and Zustand dependencies. The ryOS reference supplies the separation of catalog data, file actions, and per window navigation. Its macOS UI and storage services do not transfer.

| File | Responsibility |
| --- | --- |
| `src/fs/types.ts` | Graph, location, payload, bin, and action result types |
| `src/fs/seed.ts` | Stable IDs, physical tree, libraries, and sample metadata from asset keys |
| `src/fs/paths.ts` | Path resolution, name rules, ancestor queries, and cycle rejection |
| `src/fs/operations.ts` | Pure atomic mutation candidates for create, rename, move, copy, delete, and restore |
| `src/fs/storage.ts` | JSON boundary parser, size limit, recovery, and localStorage adapter |
| `src/stores/filesStore.ts` | New Zustand graph store and durable mutation boundary |
| `src/stores/explorerStore.ts` | New per window history, selection, view, sort, and query store |
| `src/stores/shellStore.ts` | Change desktop cells and clipboard. Derive bin count from filesStore instead of a second counter |
| `src/stores/windowStore.ts` | Change multi instance support, snap mode, saved rectangles, and Shake restore IDs |
| `src/apps/explorer/index.tsx` | Lazy app entry, file actions, and keyboard ownership |
| `src/apps/explorer/NavigationBar.tsx` | Back, Forward, history menu, breadcrumb menus, path edit, and search |
| `src/apps/explorer/CommandBar.tsx` | Location commands, Organize, Views slider, preview toggle, and Help |
| `src/apps/explorer/NavigationPane.tsx` | Shell roots, expandable folders, and pane selection |
| `src/apps/explorer/FileList.tsx` | View layouts, column sort, item selection, and drag rectangle |
| `src/apps/explorer/FileItem.tsx` | Key based icon, label, rename input, and file activation |
| `src/apps/explorer/DetailsPane.tsx` | Selection metadata, counts, and preview content |
| `src/apps/explorer/RecycleBin.tsx` | Bin query, restore commands, and original location columns |
| `src/apps/explorer/FileDialog.tsx` | VFS Open and Save As dialogs for Notepad |
| `src/apps/explorer/explorer.css` | Navigation, command bar, panes, views, and selection tokens |
| `src/apps/notepad/index.tsx` | Lazy text editor, menus, VFS save, and unsaved close dialog |
| `src/apps/notepad/notepad.css` | Notepad menu, text canvas, and status bar styles |
| `src/apps/photos/index.tsx` | Lazy Photo Viewer, zoom, rotation, folder traversal, and slide show |
| `src/apps/photos/photos.css` | Image stage, menu, and lower control strip |
| `src/apps/media/index.tsx` | Lazy audio player, 3 track queue, seek, and volume |
| `src/apps/media/media.css` | Now Playing canvas, title, album image, and control strip |
| `src/shell/ContextMenu.tsx` | New shared menu, submenu timers, viewport clamp, and keyboard focus |
| `src/shell/DeleteDialog.tsx` | New recycle and permanent confirmation dialog |
| `src/shell/AeroPreview.tsx` | New Snap rectangle and Peek outlines |
| `src/shell/TaskbarPreview.tsx` | New app thumbnail, Close, and hover Peek |
| `src/shell/aero.ts` | New Web Animations API transitions, cancellation, and reduced motion |
| `src/shell/Desktop.tsx` | Change physical desktop query, context menu, file drops, and selection |
| `src/shell/DesktopIcon.tsx` | Change grid drag, inline rename, and derived bin icon |
| `src/shell/WindowFrame.tsx` | Change Explorer title suppression, Snap, Shake, and transition lifecycle |
| `src/shell/Taskbar.tsx` | Change pointer glow, thumbnail entry, and per app window group |
| `src/shell/NotificationArea.tsx` | Change Show desktop Peek to glass outlines |
| `src/shell/StartMenu.tsx` | Change destination resolution to file locations and remove game entries |
| `src/shell/shell.css` | Change glow, outlines, popup layers, and reduced motion overrides |
| `src/lib/apps.ts` | Change lazy registry, file associations, app rectangles, and instance policy |

Explorer supports multiple windows. Notepad and Photo Viewer support 1 window per open file ID. Media Player uses 1 window and 1 queue. Add `launchContext` to window records as a union of Explorer location, file ID, audio queue, or no context. Add mode values `snappedLeft`, `snappedRight`, and `vertical` beside normal and maximized. Preserve a separate normal rectangle.

Shell transient state owns clipboard IDs, active menu, drag IDs, and Peek target. It never duplicates file names or bin metadata. The thumbnail renderer reads current data through props. It never registers a second app instance or audio element. Context menus use layer 1300. Tooltips use 1400.

Dialogs use 1500. Snap previews use 1050, below Start at 1100.

The shell hides its local menus before a modal dialog opens. After close, focus returns to the owner if that owner still exists.

## 9. New assets

Current keys are `icons.computer`, `icons.documents`, `icons.recycleEmpty`, `icons.recycleFull`, and the `sounds` and `cursors` keys above. The asset lane adds these keys to `src/assets.ts`. This spec does not change that file. Icon sizes list delivered variants in pixels. Each icon uses distinct 16px and 32px artwork where the source contains it.

The extraction lane must identify actual resource IDs from the Windows 7 SP1 files. A stock icon ID is not a DLL icon index. `Unverified` means the DLL resource index is unknown. No guessed resource index is a source claim.

| Key | Path under public/ | Original source and resource index | Pixel size |
| --- | --- | --- | --- |
| `icons.folder` | `icons/explorer/folder.webp` | `imageres.dll`, folder, index unverified, stock `SIID_FOLDER=3` | 16, 32, 48, 256 |
| `icons.folderOpen` | `icons/explorer/folder-open.webp` | `imageres.dll`, index unverified, stock `SIID_FOLDEROPEN=4` | 16, 32, 48, 256 |
| `icons.favorites` | `icons/explorer/favorites.webp` | `imageres.dll`, Favorites star, index unverified | 16, 32 |
| `icons.desktop` | `icons/explorer/desktop.webp` | `imageres.dll`, Desktop, index unverified | 16, 32, 48 |
| `icons.downloads` | `icons/explorer/downloads.webp` | `imageres.dll`, Downloads, index unverified | 16, 32, 48, 256 |
| `icons.recentPlaces` | `icons/explorer/recent-places.webp` | `imageres.dll`, Recent Places, index unverified | 16, 32 |
| `icons.libraries` | `icons/explorer/libraries.webp` | `imageres.dll`, Libraries root, index unverified | 16, 32, 48, 256 |
| `icons.libraryDocuments` | `icons/explorer/library-documents.webp` | `imageres.dll`, Documents library, index unverified | 16, 32, 48, 256 |
| `icons.libraryMusic` | `icons/explorer/library-music.webp` | `imageres.dll`, Music library, index unverified | 16, 32, 48, 256 |
| `icons.libraryPictures` | `icons/explorer/library-pictures.webp` | `imageres.dll`, Pictures library, index unverified | 16, 32, 48, 256 |
| `icons.libraryVideos` | `icons/explorer/library-videos.webp` | `imageres.dll`, Videos library, index unverified | 16, 32, 48, 256 |
| `icons.homegroup` | `icons/explorer/homegroup.webp` | `imageres.dll`, Homegroup, index unverified | 16, 32, 48 |
| `icons.network` | `icons/explorer/network.webp` | `imageres.dll`, Network, index unverified, stock `SIID_WORLD=13` | 16, 32, 48 |
| `icons.userFolder` | `icons/explorer/user-folder.webp` | `imageres.dll`, user folder, index unverified | 16, 32, 48, 256 |
| `icons.driveLocal` | `icons/explorer/drive-local.webp` | `imageres.dll`, Windows system drive, index unverified | 16, 32, 48 |
| `icons.driveDvd` | `icons/explorer/drive-dvd.webp` | `imageres.dll`, DVD RW drive, index unverified | 16, 32, 48 |
| `icons.textFile` | `icons/explorer/text-file.webp` | `imageres.dll`, text document, index unverified | 16, 32, 48, 256 |
| `icons.imageFile` | `icons/explorer/image-file.webp` | `imageres.dll`, image document, index unverified | 16, 32, 48, 256 |
| `icons.audioFile` | `icons/explorer/audio-file.webp` | `wmploc.dll`, audio document, index unverified | 16, 32, 48, 128, 256 |
| `icons.videoFile` | `icons/explorer/video-file.webp` | `wmploc.dll`, video document, index unverified | 16, 32, 48, 256 |
| `icons.shortcutOverlay` | `icons/explorer/shortcut-overlay.webp` | `imageres.dll`, shortcut arrow, index unverified | 16, 32 |
| `icons.notepad` | `icons/apps/notepad.webp` | `notepad.exe`, app icon, index unverified | 16, 32, 48 |
| `icons.photoViewer` | `icons/apps/photo-viewer.webp` | `PhotoViewer.dll`, app icon, index unverified | 16, 32, 48 |
| `icons.mediaPlayer` | `icons/apps/media-player.webp` | `wmplayer.exe`, app icon, index unverified | 16, 32, 48 |
| `icons.error` | `icons/explorer/error.webp` | `imageres.dll`, error, index unverified, stock `SIID_ERROR=80` | 16, 32, 48 |
| `icons.refresh` | `icons/explorer/refresh.webp` | `aero.msstyles`, Explorer refresh glyph, resource unverified | 16 × 16 |
| `icons.search` | `icons/explorer/search.webp` | `aero.msstyles`, search glyph, resource unverified | 16 × 16 |
| `icons.chevronRight` | `icons/explorer/chevron-right.webp` | `aero.msstyles`, breadcrumb chevron, resource unverified | 8 × 8 |
| `icons.check` | `icons/explorer/check.webp` | `aero.msstyles`, menu check, resource unverified | 16 × 16 |
| `icons.views` | `icons/explorer/views.webp` | `shell32.dll`, view command, index unverified | 16 × 16 |
| `icons.previewPane` | `icons/explorer/preview-pane.webp` | `shell32.dll`, preview pane command, index unverified | 16 × 16 |
| `icons.help` | `icons/explorer/help.webp` | `shell32.dll`, Help, index unverified | 16 × 16 |
| `sprites.explorerNavigation` | `images/explorer/navigation.webp` | `ExplorerFrame.dll`, Back and Forward states, resource unverified | 232 × 29, 8 horizontal cells |
| `sprites.explorerViews` | `images/explorer/views.webp` | `shell32.dll`, 8 view glyphs, indices unverified | 128 × 16, 8 horizontal cells |
| `sprites.photoControls` | `images/apps/photo-controls.webp` | `PhotoViewer.dll`, controls, resource unverified | 224 × 84, 8 columns × 3 states |
| `sprites.mediaControls` | `images/apps/media-controls.webp` | `wmploc.dll`, controls, resource unverified | 180 × 108, 5 columns × 3 states |
| `fonts.lucidaConsole` | `fonts/lucida-console.woff2` | `lucon.ttf`, Lucida Console Regular | Vector font, 13px display |
| `images.sampleChrysanthemum` | `images/samples/Chrysanthemum.jpg` | `C:\Users\Public\Pictures\Sample Pictures\Chrysanthemum.jpg` | 1024 × 768 |
| `images.sampleDesert` | `images/samples/Desert.jpg` | `C:\Users\Public\Pictures\Sample Pictures\Desert.jpg` | 1024 × 768 |
| `images.sampleHydrangeas` | `images/samples/Hydrangeas.jpg` | `C:\Users\Public\Pictures\Sample Pictures\Hydrangeas.jpg` | 1024 × 768 |
| `images.sampleJellyfish` | `images/samples/Jellyfish.jpg` | `C:\Users\Public\Pictures\Sample Pictures\Jellyfish.jpg` | 1024 × 768 |
| `images.sampleKoala` | `images/samples/Koala.jpg` | `C:\Users\Public\Pictures\Sample Pictures\Koala.jpg` | 1024 × 768 |
| `images.sampleLighthouse` | `images/samples/Lighthouse.jpg` | `C:\Users\Public\Pictures\Sample Pictures\Lighthouse.jpg` | 1024 × 768 |
| `images.samplePenguins` | `images/samples/Penguins.jpg` | `C:\Users\Public\Pictures\Sample Pictures\Penguins.jpg` | 1024 × 768 |
| `images.sampleTulips` | `images/samples/Tulips.jpg` | `C:\Users\Public\Pictures\Sample Pictures\Tulips.jpg` | 1024 × 768 |
| `media.kalimba` | `media/samples/Kalimba.mp3` | `C:\Users\Public\Music\Sample Music\Kalimba.mp3` | Audio, 0px |
| `media.maid` | `media/samples/Maid with the Flaxen Hair.mp3` | `C:\Users\Public\Music\Sample Music\Maid with the Flaxen Hair.mp3` | Audio, 0px |
| `media.sleepAway` | `media/samples/Sleep Away.mp3` | `C:\Users\Public\Music\Sample Music\Sleep Away.mp3` | Audio, 0px |
| `media.wildlife` | `media/samples/Wildlife.wmv` | `C:\Users\Public\Videos\Sample Videos\Wildlife.wmv` | 1280 × 720, decoder outside scope |
| `media.albumKalimba` | `media/samples/album-kalimba.webp` | Embedded MP3 cover or associated `AlbumArt` file, source size unverified | 200 × 200 target |
| `media.albumMaid` | `media/samples/album-maid.webp` | Embedded MP3 cover or associated `AlbumArt` file, source size unverified | 200 × 200 target |
| `media.albumSleepAway` | `media/samples/album-sleep-away.webp` | Embedded MP3 cover or associated `AlbumArt` file, source size unverified | 200 × 200 target |

The icon key resolves to the 256px source when present. The contract can expose size variants through a typed helper without component path literals. The sprites are normalized extraction sheets, status C. Their cell order follows section 2 and the control order in section 5. View glyph cells follow the 8 view rows. Photo glyphs use 28px cells, with normal, hover, and pressed rows.

The 44px photo Play button places its 28px glyph at center. Its circular frame uses the lower toolbar gradient and a 1px `#7b9dbd` border. Media glyph cells are 36px, with Previous, Play, Pause, Next, and Mute columns. Rows are normal, hover, and pressed. Non sprite command glyphs use opacity 0.40 when disabled. CSS supplies triangles, separators, and slider tracks with 0 extra image assets.

Sample file names match their asset keys by the row order. The audio seed reads title, artist, album, cover, and duration from source metadata.

## 10. Build order and evidence

| Part | Work | Usable result |
| --- | --- | --- |
| 1 | Asset contract, seed, durable graph, Explorer navigation, Details and Large views, desktop grid, rename, create, delete, restore, Empty Bin | A user can browse samples and preserve folder edits after reload |
| 2 | Remaining views, menus, clipboard, preview pane, Notepad, Photo Viewer, and audio player | A user can open files, edit text, view pictures, and play the 3 sample tracks |
| 3 | Snap, Shake, Peek, taskbar glow, thumbnails, tooltips, and final asset calibration | A user can manage multiple windows with Aero behavior and reduced motion |

Each part retains the prior usable result. No part adds a game, dependency, push, or host OS operation. The implementation check is `corepack pnpm@11.5.0 build`. This documentation task does not execute app checks. The documentation review checks the 700 line limit, asset key closure, section coverage, numeric values, and the owned file diff.

### Sources and calibration limits

The [Microsoft animation guide](https://learn.microsoft.com/en-us/windows/win32/uxguide/vis-animations) confirms pointer based taskbar color and brief transitions. It does not publish the DWM duration or CSS curve. The transition table therefore defines replica values, status C. The [Microsoft toolbar guide](https://learn.microsoft.com/en-us/windows/win32/uxguide/cmd-toolbars) supplies Explorer command and navigation examples.

The [Microsoft menu guide](https://learn.microsoft.com/en-us/windows/win32/uxguide/cmd-menus) supplies menu behavior and command conventions. The [tooltip API](https://learn.microsoft.com/en-us/windows/win32/controls/ttm-setdelaytime) documents 500ms initial, 100ms reshow, and 5000ms visible defaults. The [stock icon API](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/ne-shellapi-shstockiconid) identifies stock IDs, not extraction indices.

The [Windows 7 sample music answer](https://learn.microsoft.com/en-us/answers/questions/2572679/music-pre-installed-on-windows-media-player) confirms the 3 MP3 file names. The [Windows 7 delete answer](https://learn.microsoft.com/en-us/answers/questions/2588278/confirm-deleting) confirms the single file recycle question. The [Microsoft sound guide](https://learn.microsoft.com/en-us/windows/win32/uxguide/vis-sound) describes event use without a complete Windows Default registry map.

| Status | Values that need an original Windows 7 SP1 comparison |
| --- | --- |
| C, Explorer | Every band, pane, row, cell, column, slider, border, gradient, color, inset, default view, and selection value in section 2 |
| C, dialogs | 458px width, 206px and 154px heights, 48px and 32px icons, 75 × 23px buttons, 42px footer, multiple item text, and Question sound assignment |
| C, menus and desktop | Menu membership, 208px and 256px widths, 22px rows, 28px icon column, 400ms submenu delay, 4px drag threshold, and size dependent grid cells |
| C, viewers | All initial sizes, toolbar sizes, colors, fonts, control geometry, zoom steps, and 5000ms slide interval in section 5 |
| C, Aero | All durations, curves, scales, Snap edge threshold, preview colors, Shake thresholds, glow algorithm, thumbnail geometry, 400ms thumbnail delay, 500ms thumbnail Peek, and 1000ms desktop Peek |
| C, assets | All unverified resource indices, sprite dimensions, source variants, album cover dimensions, and delivered sample metadata |
| D, tooltip | 500ms, 100ms, and 5000ms are API defaults at a 500ms double click interval. Shell infotips can use separate delays |
| R, differences | Delete recycle sound, disabled native commands, trimmed New menu, fixed drive capacity, inert system tree, single tab persistence, audio scope, and browser busy cursor |

These C values require a reference VM or original screenshots before an exact Windows 7 fidelity claim.

# computer

A Windows 7 desktop in the browser. It copies the computer I used as a child, from the boot screen to the desktop.

Live at [computer.akshatgoel.com](https://computer.akshatgoel.com). It is a subdomain of [akshatgoel.com](https://akshatgoel.com).

## What it has

- The Windows 7 boot screen, the welcome screen and the desktop.
- The Start button and the Start menu.
- The taskbar.
- Windows that you can open, move, minimize, maximize and close.
- The original Segoe UI font, the Aero colors and the default sound scheme.
- A Road Rash game on the desktop.

## Run it

You need Node 24 and pnpm 11.

```sh
pnpm install
pnpm dev
```

Open the URL that Vite prints.

To make a production build:

```sh
pnpm build
pnpm preview
```

## How it works

The app is a Vite, React and TypeScript single-page app. It has no server.

- `7.css` gives the Aero styles for windows, buttons and menus. The app loads the scoped build, so the styles apply only inside `.win7`.
- `src/assets.ts` lists every font, sound, image, icon and cursor path. Code reads asset paths only from this file.
- `src/lib/sound.ts` plays sounds through the Web Audio API. It decodes each file one time and keeps it in a cache.
- `src/stores/` holds the window state in Zustand.
- `src/apps/roadrash/` holds the game. The desktop loads it only when you open it.

## Folders

| Path | Contents |
| --- | --- |
| `src/boot/` | Boot screen and welcome screen |
| `src/shell/` | Desktop, taskbar, Start menu and window frame |
| `src/apps/` | Apps that open in a window |
| `src/lib/` | Sound player and small helpers |
| `src/stores/` | Zustand stores |
| `public/fonts/` | Segoe UI as woff2 |
| `public/sounds/` | Windows 7 sounds as mp3 |
| `public/images/` | Boot, logon, wallpaper and Start button images |
| `public/icons/` | Desktop and Start menu icons |
| `docs/` | Design spec and asset sources |

## Credits

- [ryOS](https://github.com/ryokun6/ryos) by Ryo Lu. This project uses ryOS as a reference for the theme, font and sound setup.
- [7.css](https://github.com/khang-nd/7.css) by Khang Nguyen.

Windows, Segoe UI and the Windows 7 sounds and images belong to Microsoft. Road Rash belongs to Electronic Arts. This is a fan project with no commercial use.

## License

AGPL-3.0. See `LICENSE`.

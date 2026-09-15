<p align="center">
  <img src="src/app/icon.svg" width="72" height="72" alt="Shree's Playlist" />
</p>

<h1 align="center">Shree's Playlist</h1>

<p align="center">
  <strong>A personal music room in the browser.</strong><br />
  Sign in. Set the mood. Drop a YouTube link. Play.
</p>

<p align="center">
  <a href="https://shree-s-my-playlist.vercel.app"><img alt="Live site" src="https://img.shields.io/badge/Live-shree--s--my--playlist.vercel.app-black?style=for-the-badge" /></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
</p>

---

## The idea

Most playlist apps live on someone else's server. This one lives in **your room**.

After login you get a full-screen space: pick a color, photo, or looping `.mp4` for the wall, then drag a glass **Player** and **Edit** window wherever you want. Add songs with a YouTube link. Build playlists. Loop one track or shuffle the lot.

No cloud account. No tracking. Your room follows your login on any computer.

**Live:** [shree-s-my-playlist.vercel.app](https://shree-s-my-playlist.vercel.app)

---

## Features

| | |
| --- | --- |
| **Desktop only** | Windows, Mac, or another computer with a large screen — not phones |
| **Unique username** | One username for the whole site, any browser |
| **Your room** | Solid color, image upload, image URL, or a silent looping `.mp4` |
| **Floating player** | Drag, resize, minimize, maximize — album art, seek, volume |
| **YouTube songs** | Paste a link; title and artist are optional |
| **Playlists** | Liked Songs, Discover Mix, plus any lists you create |
| **Loop & shuffle** | Off / all / one, plus shuffle, from the `···` menu |
| **Light on dark** | Header text flips black on a light room, white on a dark one |
| **Private room data** | Songs, playlists, photo, and background follow your username |

---

## Quick start

```bash
git clone https://github.com/Shreesoni520/MyPlaylist.git
cd MyPlaylist
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create a username, and walk into the room.

| Script | What it does |
| --- | --- |
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |

---

## How it works

```
Sign up  →  your room  →  Player + Edit panels
                │
                ├─ Room: color / photo / .mp4
                ├─ Add music: YouTube URL
                └─ Playlists, volume, loop, shuffle
```

- **Auth** is username + password. Accounts are stored on the server, so a username can only be taken once — Chrome, Firefox, another PC, it is the same list.
- **Room, playlists, library, and background** are saved with that account, so incognito or another computer can load the same room after you sign in.
- **Desktop only.** Open it on a Windows PC, a Mac, or another large computer screen. Phones and tablets get a message instead of the room.
- **Developer clean:** bump `ACCOUNT_CLEAN_VERSION` to wipe local rooms and delete every username from the account store. There is no reset button in the UI.
- **Room videos** are saved with your account too, so a looping `.mp4` wall follows you across browsers. Keep it under 50MB. A percent shows while it uploads or downloads; the first copy to another browser can take a minute.
- **Track lookup** goes through `/api/find-track` so a pasted YouTube link can resolve to the full song.

---

## Stack

- [Next.js 16](https://nextjs.org) App Router + Turbopack
- [React 19](https://react.dev) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Base UI](https://base-ui.com) for dialogs, menus, tabs
- [Lucide](https://lucide.dev) icons

---

## Author

**Krishna Soni**

---

## License

Private music room. Built by **Krishna Soni**.

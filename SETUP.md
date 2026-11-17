# Spark Youth Club website: setup

The site is plain HTML, CSS and JavaScript, so GitHub Pages can host it as it is. Content (events, sessions, posters, gallery photos) and registrations live in your Firebase project `spark-web-site`.

## Current state: open mode

Right now the admin panel works without Firebase sign-in: the username and password are checked in the browser, and changes are written straight to the database. This works because the database rules currently allow anyone to read and write.

That is fine while you are building, but before you share the site widely, do the two steps below. Until then anyone who finds the database address can read the registrations (names and mobile numbers) and change or delete the site content.

## Securing it later (about 5 minutes)

### 1. Turn on admin sign-in

1. Open <https://console.firebase.google.com> → project **spark-web-site** → **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Email/Password** → enable → Save.
3. Straight away, open `admin.html` on your site and log in with your username and password. The first successful login creates the admin account (`admin@sparkyouthcbe.in`) and copies the starter content into the database.

Do step 3 right after step 2, so that nobody else can claim the admin account first.

### 2. Set the database rules

**Build → Realtime Database → Rules**, replace everything with this, then **Publish**:

```json
{
  "rules": {
    "site": {
      ".read": true,
      ".write": "auth != null && auth.token.email === 'admin@sparkyouthcbe.in'"
    },
    "media": {
      ".read": true,
      ".write": "auth != null && auth.token.email === 'admin@sparkyouthcbe.in'"
    },
    "registrations": {
      ".read": "auth != null && auth.token.email === 'admin@sparkyouthcbe.in'",
      "$id": {
        ".write": "(!data.exists() && newData.exists()) || (auth != null && auth.token.email === 'admin@sparkyouthcbe.in')",
        ".validate": "newData.hasChildren(['name', 'mobile']) && newData.child('name').isString() && newData.child('name').val().length < 100 && newData.child('mobile').val().length < 20"
      }
    }
  }
}
```

What this does:

- Everyone can read the site content and images. Only the signed-in admin can change them.
- Anyone can add a registration, but only the admin can read, edit or delete registrations. Visitors' names and phone numbers are not publicly readable.

After publishing the rules, log out and in again on `admin.html`. The demo-mode banner should be gone.

### Changing the admin password

The current password is short and easy to guess, so consider a stronger one. To change it: Firebase console → Authentication → Users → delete the `admin@sparkyouthcbe.in` row → **Add user** → email `admin@sparkyouthcbe.in` and your new password. The username on the admin page stays `admin`; the page signs in with whatever password that Firebase account has.

## How content works

- **Events** are the categories visitors see on the home page (TGIS, Enthu, Siksha, DYS). Create one in the admin panel and it appears on the home page automatically.
- **Sessions** belong to an event: poster, date, time, venue, description. They show on the event page, in the popup, and on the program calendar.
- **Photos** belong to a session. Pick the event, then the session, then upload. They show in the gallery, and the session popup gets a "See photos" button.

Uploaded images are shrunk in the browser (about 100 to 250 KB each) and stored in the Realtime Database. The free plan gives 1 GB of storage, which is roughly 4,000 to 8,000 photos.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The public site (home, events, calendar, gallery) |
| `admin.html` | The admin panel (linked at the very bottom of the footer) |
| `assets/js/seed.js` | Starter content, made from your posters. Descriptions are placeholders |
| `assets/posters/` | Web-sized copies of the posters in `events/` |
| `assets/img/` | Placeholder stock photos (Pexels). Replace files with the same names to swap them. Sources are in `CREDITS.md` |
| `index_underway.html` | Your old waiting page, untouched |

`events/` (the original 4 MB PNG posters) and `skills/` are not used by the site. `skills/` is listed in `.gitignore`; you may want to keep `events/` out of the repository too, since it is about 75 MB.

## Opening the site on your computer

Double-clicking `index.html` or `admin.html` works. When a page is opened straight from a folder, it loads a pre-built copy of the scripts from `assets/js/dist/` (browsers refuse to load the normal script files that way). On GitHub Pages the normal files in `assets/js/` are used.

If you ever edit the JavaScript, rebuild those copies so the double-click version matches (needs Node.js), from this folder:

```
npx esbuild assets/js/app.js --bundle --format=iife --target=es2020 --minify --outfile=assets/js/dist/app.bundle.js
npx esbuild assets/js/admin.js --bundle --format=iife --target=es2020 --minify --outfile=assets/js/dist/admin.bundle.js
```

The live site does not depend on this step.

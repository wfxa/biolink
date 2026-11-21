# dose

A biolink platform. People sign up, claim `yoursite/name`, and design their page in a dashboard with a live preview. You run it all from an owner panel.

No packages to install. It runs on Node 22 with its built-in database.

## What's in it

**Site:** a pharmacy-themed home page (prescription hero, "shake the bottle" live demo, a Page Facts label, staff-picked pages on the shelf, dosage plans, ask-the-pharmacist FAQ) with a live "try it" builder that needs no account, sign up and sign in (username or Discord), leaderboard, public pages at `/name`, extra pages at `/name/page`, the dashboard and the owner panel.

**Profile**
- Display name, text above the name, handle line, bio (400 characters), taglines that type themselves out
- Details: location, live local time, occupation, languages, GitHub
- The line under the name, as plain text or pills: handle, Discord status, location, time, joined date, views
- Badges, with a page showing how to earn the ones you don't have

**Media**
- Picture (upload or link): shape, size, border, 5 decorations, your Discord avatar decoration, or hidden
- Banner
- Background: auto (your blurred picture, or album art while you listen), colour, image, video (Premium) or animated (gradient, mesh, waves, grid), with blur, darken, vignette, slow zoom or pan, and filters
- Playlist (3 songs free, 15 Premium), shuffle, volume and a player

**Style**
- Card: glass, solid, outline or none; one card or separate cards; darkness, blur, roundness, border colour; glow, animated border (Premium), lift on hover, text shadow
- Colours: accent, text, name, bio, small text, icons, brand-coloured icons, icon and link backgrounds, cards, name glow, icon glow, or take the theme from your picture
- 20 fonts, with a separate font for the name
- Name: size, weight, letter spacing, uppercase, gradient, and 16 effects (shine, glow, neon, colour shift, glitch, wave, typewriter, scramble, flicker, float, blur in, split, focus, sparkle, outline)
- Buttons: glass, filled or outline; rounded, pill or square
- Layout: centred, picture beside the name, or minimal; spacing; width; entrance animation

**Effects**
- In the air: particles, night sky, comets, snow, 8-bit snow, rain, storm, blossom, fireflies, matrix, plus northern lights and fog (Premium)
- Textures: grain, scanlines, dots, grid, VHS, CRT
- View counter: under the name, pill, corner, or counting up
- Cursor: sparkle, snow, ribbon, pixels, moth, bubbles, or your own image
- Click effects: burst, ripple, hearts, confetti, stars
- Click sounds: click, bubble, chime or your own
- Bio effects; 3D tilt, spotlight and glint
- Enter screens: fade, curtain, aperture, slice, shutter, glitch, boot up, zoom, with an optional content warning

**Links:** social icons (26 platforms), link buttons, projects with tags and icons, Spotify, YouTube and SoundCloud embeds, extra pages, a Discord server card with live member count, a text block, and a countdown.

**Sections:** reorder, hide and add headings to every section, and put any of them on page 2 to 5. Those pages become screens visitors scroll into, with page dots and a scroll hint.

**Live (Discord, through Lanyard):** online status, Spotify with a progress bar, synced lyrics (from lrclib.net), games, and your custom status as a fallback bio. The labels are editable.

**Sharing & privacy:** hide your page, count your own views, likes and dislikes, comments (you can delete any comment on your page), a Discord link-card preview, colour bar, search-engine title and description, hide from search engines, tab title, animated title, an "away" tab title, tab icon, a share button, and custom CSS (Premium).

**Dashboard:** live phone or desktop preview, undo and redo, Ctrl+K to find any setting, an Essentials/Everything switch, Ctrl+S to save, drag-and-drop uploads, a member card and QR code to download, export and import of your page as a file, and reset style.

**Stats:** views, visitors, link clicks and click rate for today, 7, 30 or 90 days, each compared with the period before; top links, sources, countries and devices.

**Formulas:** eight ready-made looks (Night shift, Vitamin C, Mint, Lavender, Clinic, Static, Blossom, Storm), applied in one tap from the dashboard.

**Spare names:** extra names that redirect to your page (1 free, 3 with Premium). Link buttons can be highlighted so they pulse, and the editor shows how many taps each link got in the last 30 days.

**Owner panel ("pharmacy counter")**
- **Counter:** patients, new today, active today, premium, visits, open reports, a 14-day chart, the busiest pages and top sources.
- **Patients:** search and filter. Click anyone for a side panel showing join date, last seen, visits, reports, Discord and spare names. From there you can:
  - give premium for good, 7 days, 30 days or a year (it switches off by itself when it ends)
  - change their role, hand out badges, or leave a private team note
  - rename, reset the page, ban with a reason, or delete
- **CSV export** of every patient.
- **Reports:** visitors can report any page from its footer. Reports queue up here, and you can dismiss one, mark it dealt with, or ban the page in one click.
- **Badges:** 13 built in; make your own with a name, how-to-earn text, icon and colour.
- **Invites:** turn on invite-only sign-ups and make codes with a set number of uses each. Copy a ready-made sign-up link.
- **Activity log:** every change the team makes, with who made it and when.
- **Settings:**
  - site colour: pick Mint, Lilac, Sky, Amber, Rose, Chalk, Lime, Peach or any colour, and the home page, dashboards and owner panel all follow it
  - open or close sign-ups, or make them invite-only
  - maintenance mode, which closes the site with your own message while staff can still get in
  - a home-page banner, and a notice shown in everyone's dashboard
  - pages featured "On the shelf" on the home page
  - blocked words for usernames

**Automatic badges:** Owner, Staff, Premium, Early member (the first 100 members) and Milestone (1,000 views). Ten more ship ready to hand out, such as Verified, Developer and Bug hunter.

## Becoming the owner
**The first account that signs up becomes the owner.** Sign up as soon as the site is live, before anyone else can. Deploy, then sign up straight away.
After that, you can make other people staff or owners from the owner panel.

## Deploy on Railway
1. Upload this folder to a new GitHub repo. The repo's front page should show `server.js`, `package.json`, `src/` and `public/`, not a single `dose` folder.
2. In Railway, choose **New Project → Deploy from GitHub repo** and pick the repo.
3. **Add a Volume. This is required.** Right-click the canvas (or use **+ Create**), choose **Volume**, attach it to the service, and set the mount path to `/data`.
   Without it, every account, upload and view is wiped each time you redeploy.
4. Go to **Settings → Networking → Generate Domain** to get your link.
5. Open it, click **Sign in → Create account**, and claim your name. You're the owner.

### Discord login
The "Continue with Discord" button only appears once you've done this. Until then, username and password sign-in still works.

1. Go to https://discord.com/developers/applications and click **New Application**. Name it after your site.
2. Open **OAuth2** in the left menu.
   - Copy the **Client ID**.
   - Click **Reset Secret** and copy the **Client Secret**. Keep it private.
   - Under **Redirects**, click **Add Redirect** and paste your site's address plus `/auth/discord/callback`, for example
     `https://dose-production.up.railway.app/auth/discord/callback`. Click **Save Changes**.
3. In Railway, open your service, go to **Variables**, and add:
   - `DISCORD_CLIENT_ID` = your Client ID
   - `DISCORD_CLIENT_SECRET` = your Client Secret
4. Railway redeploys. The button now shows on the sign-in page.

When you add a custom domain later, add a second redirect in Discord for the new address too, like `https://yourdomain.com/auth/discord/callback`.
If sign-in ever says it failed, the redirect in Discord almost always doesn't match your site address exactly. Check for `https` and no trailing slash.

How it works for people:
- **New people** click Continue with Discord and pick a page name. Their Discord picture becomes their avatar, and live Discord status is switched on.
- **Existing accounts** can link Discord from **Dashboard → Account**, then sign in either way.
- Discord-only accounts can set a password later from **Account**.

### Renaming the site
Set `SITE_NAME` in Railway → **Variables**, for example `SITE_NAME=dose`, and it redeploys.

### Your own domain
In Railway, go to **Settings → Networking → Custom Domain** and add the CNAME record it shows at your domain provider.
To get the **Countries** analytics, put the domain behind Cloudflare with the orange cloud (proxied) on. Cloudflare adds the visitor's country to each request.

## Premium
There are no payments built in. You give premium from the owner panel (**Users → Give premium**), so you can sell it however you like, for example through Ko-fi or crypto.
To change what's premium-only, see `PREMIUM_EFFECTS` in `src/profile.js` and the `premium` checks in the same file.

## Run it on your computer
Install Node 22 or newer, then run:
```
npm start
```
and open http://localhost:3000. Data is saved in `./data`.

## Files
```
server.js            web server, all API routes
src/config.js        site name, upload limits, reserved names
src/db.js            database tables
src/profile.js       profile settings and what's allowed
public/              pages (index, auth, dashboard, admin, leaderboard, profile)
public/assets/       styles and scripts
```

## Updating from an older version
Replace the files in your GitHub repo with the new ones. Railway redeploys and your existing accounts, pages and stats carry over. Pages made with the first version are converted to the new settings automatically.

## Backups
Everything lives on the volume: `dose.db` (accounts, views, badges) and `uploads/`. To back up, use Railway's volume backups, or download the folder.

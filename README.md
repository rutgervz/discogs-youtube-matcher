# Discogs Youtube Matcher

A browser extension for record collectors, working in two directions.

**On Discogs**, every release, master or marketplace item gets a panel with the full tracklist, playable straight from the page via YouTube. The matcher reads mix names and uses track durations to pick the right version, falls back to alternative uploads when a video refuses to embed, and searches YouTube itself for tracks the Discogs community never linked.

**On YouTube**, every track shows whether it was pressed on vinyl and whether copies are for sale on Discogs, with the number of listings and the lowest price.

Website and download: see the `docs/` folder, served via GitHub Pages.

## Install from source

1. Clone this repository or download it as zip
2. Open `chrome://extensions` and enable developer mode
3. Choose "Load unpacked" and select the `extension/` folder
4. Open any release on Discogs

Two optional finishing touches: allow third-party cookies for `[*.]discogs.com` in `chrome://settings/cookies` so the embedded player uses your signed-in YouTube account (with Premium: no ads), and create a free personal token at [discogs.com/settings/developers](https://www.discogs.com/settings/developers) to enable vinyl search from YouTube.

## Development

Plain Manifest V3, no build step. `extension/content.js` runs on Discogs (tracklist panel, matcher, player), `extension/yt-content.js` runs on YouTube (vinyl search panel), `extension/background.js` talks to the Discogs API and performs YouTube searches.

Made on Schiermonnikoog, built in conversation with AI, tested on disco, techno and Madonna. Not an official Discogs or YouTube application; all trademarks belong to their respective owners.

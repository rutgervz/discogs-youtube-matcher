# Discogs YouTube Matcher

Browser extension that automatically shows a panel with the full tracklist on Discogs release, master and shop pages, playable in the panel itself through an embedded YouTube player.

## How it works

The extension reads the release ID from the URL (or fishes it out of the page on shop items) and requests the release from the Discogs API. Along with the tracklist, that returns the YouTube videos the community has linked to the release.

Click a track and it plays right in the panel, with the rest of the record following by itself. The "Whole record" button starts at track one. Tracks without a linked video get a search link that opens YouTube with artist and title.

## YouTube Premium and ads

The embedded player uses your regular YouTube login, provided Chrome allows third-party cookies for YouTube. Check or arrange it like this:

1. Open chrome://settings/cookies
2. Choose "Allow third-party cookies", or keep blocking on and add under "Sites allowed to use third-party cookies": [*.]youtube.com
3. Reload the Discogs page

If you see your profile picture in the top right of the embed when you check the YouTube logo, you are signed in and it is ad-free with Premium. In incognito windows you are signed out and ads do appear.

## Install (Chrome, Brave, Edge, Arc)

1. Extract the zip to a permanent folder (the browser reads the files from that location)
2. Open chrome://extensions
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and choose the folder
5. Open a release or shop item on Discogs, the panel appears in the bottom right

Updating from an earlier version: replace the files in the same folder, click the refresh arrow next to the extension on chrome://extensions, and reload open Discogs tabs.

## On YouTube, Spotify and Beatport: is this for sale on vinyl?

On every YouTube watch page, VinylTube shows a panel that parses the video title into artist and track and searches Discogs for vinyl releases with that track, including how many copies are for sale and from what price. The same panel appears on the Spotify web player and on Beatport, following whatever is playing in the player bar. Click a release to open it on Discogs.

This needs a free personal Discogs token, once: create it at https://www.discogs.com/settings/developers ("Generate new token") and paste it into the panel. The token stays stored locally in your browser.

## Good to know

The Discogs API allows 25 requests per minute without authentication; fetched releases are cached per session. The panel collapses to just the disc icon via the button in the top right of the header, and hides while a video plays fullscreen.

# Discogs Youtube Matcher

Browser extension (Manifest V3, no build step) connecting Discogs and YouTube in both directions. Live at https://rutgervz.github.io/discogs-youtube-matcher/

## Structure

`extension/content.js` runs on discogs.com: tracklist panel, the matcher, and the player (one embed iframe, its own queue, advancing tracks via YouTube's postMessage channel). `extension/vinyl-panel.js` is the shared vinyl search panel (Discogs token, results, collapse/fullscreen behavior), exposed as `window.VinylPanel`; the per-site sniffers `yt-content.js`, `spotify-content.js` and `beatport-content.js` detect what is playing and call `VinylPanel.lookup(artist, track, q)`. `extension/background.js` talks to the Discogs API (release/master/search/marketplace stats) and performs YouTube searches for tracks without a linked video. `docs/` is the website (GitHub Pages) including the extension's download zip.

## The matcher (heart of the project)

Matches Discogs tracks to YouTube videos at word level, with a mix-name conflict penalty (a Long Version must never become a Radio Edit), duration as tiebreaker, and a lower bound of 0.7: better honestly no match than confidently a wrong one. Every change to the matcher MUST pass `npm test`: four real records from the owner's collection, including the deliberate non-matches. If a record breaks in the wild, add it as a new test case before fixing.

## Playback layer: lessons learned

NEVER use the playlist parameter of YouTube embeds; it silently skips non-embeddable videos. The current approach (one video at a time, advancing ourselves on playerState 0) is the solution to that. Non-embeddable videos (onError 101/150 or silent refusal) automatically get that track's next candidate.

## Conventions

Everything in English: UI copy, code comments, tests, and docs. Bump the version number in manifest.json on every release, regenerate the zip in docs/ (from the repo root: `rm docs/discogs-youtube-matcher.zip && zip -r docs/discogs-youtube-matcher.zip extension`), and publish a GitHub release with the zip as asset: `gh release create v<version> docs/discogs-youtube-matcher.zip --title "v<version>" --notes "<short notes>"`. The download button on the website points at releases/latest/download so GitHub counts downloads per version (`gh api repos/rutgervz/discogs-youtube-matcher/releases --jq '.[] | {tag: .tag_name, downloads: .assets[0].download_count}'`). GitHub Pages refreshes by itself after a push. Commit messages short and descriptive.

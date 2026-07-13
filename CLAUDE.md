# Discogs Youtube Matcher

Browserextensie (Manifest V3, geen buildstap) die Discogs en YouTube in twee richtingen verbindt. Live op https://rutgervz.github.io/discogs-youtube-matcher/

## Structuur

`extension/content.js` draait op discogs.com: tracklistpaneel, de matcher, en de speler (één embed-iframe, eigen wachtrij, doorspelen via het postMessage-kanaal van YouTube). `extension/yt-content.js` draait op youtube.com: vinyl-zoekpaneel met Discogs-token. `extension/background.js` praat met de Discogs API (release/master/search/marketplace-stats) en doet YouTube-zoekopdrachten voor tracks zonder gekoppelde video. `docs/` is de website (GitHub Pages) inclusief de download-zip van de extensie.

## De matcher (hart van het project)

Koppelt Discogs-tracks aan YouTube-video's op woordniveau, met mixnaam-conflictstraf (Long Version mag nooit een Radio Edit worden), tijdsduur als scheidsrechter, en een ondergrens van 0,7: liever eerlijk geen match dan zeker een verkeerde. Elke wijziging aan de matcher MOET langs `npm test`: vier echte platen uit de verzameling van de eigenaar, inclusief het bewust niet-matchen. Gaat er in het echt een plaat stuk, voeg die dan toe als nieuwe testcase voordat je fixt.

## Afspeellaag: geleerde lessen

Gebruik NOOIT de playlist-parameter van YouTube-embeds; die slaat niet-inbedbare video's stil over. De huidige aanpak (één video tegelijk, zelf doorschakelen bij playerState 0) is daar de oplossing voor. Niet-inbedbare video's (onError 101/150 of stille weigering) krijgen automatisch de volgende kandidaat van die track.

## Conventies

UI-teksten in het Nederlands, website in het Engels. Versienummer in manifest.json ophogen bij elke release en de zip in docs/ opnieuw genereren: `cd .. && zip -r docs/discogs-youtube-matcher.zip extension`. Na push vernieuwt GitHub Pages vanzelf. Commit-berichten kort en beschrijvend.

# Discogs YouTube Matcher

Browserextensie die op Discogs release-, master- en shoppagina's automatisch een paneel toont met de volledige tracklist, afspeelbaar in het paneel zelf via een ingebedde YouTube-speler.

## Hoe het werkt

De extensie leest het release-ID uit de URL (of vist het bij shopitems uit de pagina) en vraagt de release op bij de Discogs API. Die geeft naast de tracklist ook de YouTube-video's terug die de community aan de release heeft gekoppeld.

Klik je een track, dan speelt die direct in het paneel, en loopt de rest van de plaat vanzelf door. De knop "Hele plaat" start bij track één. Tracks zonder gekoppelde video krijgen een zoeklink die YouTube opent met artiest en titel.

## YouTube Premium en reclame

De ingebedde speler gebruikt je gewone YouTube-login, mits Chrome cookies van derden toestaat voor YouTube. Zo controleer of regel je dat:

1. Open chrome://settings/cookies
2. Kies "Cookies van derden toestaan", of houd blokkeren aan en voeg bij "Sites die cookies van derden mogen gebruiken" toe: [*.]youtube.com
3. Herlaad de Discogs-pagina

Zie je in de embed rechtsboven je profielfoto als je op het YouTube-logo let, dan ben je ingelogd en is het reclamevrij met Premium. In incognitovensters ben je uitgelogd en verschijnt er wel reclame.

## Installeren (Chrome, Brave, Edge, Arc)

1. Pak de zip uit naar een vaste map (de browser leest de bestanden vanaf die plek)
2. Open chrome://extensions
3. Zet rechtsboven "Ontwikkelaarsmodus" aan
4. Klik op "Uitgepakte extensie laden" en kies de map
5. Open een release of shopitem op Discogs, het paneel verschijnt rechtsonder

Update je van een eerdere versie: vervang de bestanden in dezelfde map, klik op het vernieuwpijltje bij de extensie op chrome://extensions, en ververs open Discogs-tabbladen.

## Op YouTube: is dit op vinyl te koop?

Op elke YouTube-watchpagina toont VinylTube een paneel dat de videotitel ontleedt naar artiest en nummer en bij Discogs zoekt naar vinylreleases met die track, inclusief hoeveel exemplaren te koop staan en vanaf welke prijs. Klik op een release om hem op Discogs te openen.

Hiervoor is eenmalig een gratis persoonlijke Discogs-token nodig: maak hem aan op https://www.discogs.com/settings/developers ("Generate new token") en plak hem in het paneel op YouTube. De token blijft lokaal in je browser opgeslagen.

## Goed om te weten

De Discogs API staat zonder authenticatie 25 verzoeken per minuut toe; opgehaalde releases worden per sessie gecachet. Het paneel is inklapbaar via de knop rechtsboven in de kop.

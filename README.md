# direction-assistant (Smerový asistent)
An accessible walking assistant for blind and visually impaired people. It helps you walk in a straight line, navigate routes you recorded yourself, find out where you are, explore places nearby and plan walking routes along streets. It uses the compass, GPS, spatial audio, voice and vibration, and it works with VoiceOver (iPhone) and TalkBack (Android) alone. Slovak and English.

## Links
- **Web app (iPhone and any phone), current version 45:** https://matusbob.github.io/direction-assistant/
  - Open it in Safari over this HTTPS link and allow motion/orientation and location when asked.
  - Install it: Share → Add to Home Screen. The home-screen icon always loads the newest version.
  - The version number is at the bottom of the screen, next to the language button.
- **Android app (APK), version 1.0, for Android 10 and newer (made for a Pixel 7 with TalkBack):** https://matusbob.github.io/direction-assistant/downloads/smerovy-asistent.apk
  - 68,528 bytes, SHA-256 `79d2afd43788efac24d8da11c204bf0c8657c6d6ea22c169e581cfed9d858355`.
  - How to install it: see [Installing the APK](#installing-the-apk).
- **Source code:** https://github.com/matusbob/direction-assistant

## Stručne po slovensky
**Webová aplikácia** (verzia 45, https://matusbob.github.io/direction-assistant/) vie:

- **Rovný smer.** Štart → po chvíli sa zapamätá smer, ktorým telefón mieri. Pri vybočení pípa zo strany, kam uhýbaš, vibruje (doprava jedno súvislé zabzučanie, doľava prerušované) a povie „Vybočenie vpravo, 20 stupňov“. Keď ideš dobre, tichý tik každých pár sekúnd.
  - Citlivosť v stupňoch alebo v metroch podľa GPS.
  - „Ideš dobre“ každých X metrov a štatistika po zastavení.
  - Voliteľný režim medzi prekážkami: krátke obchádzanie áut nevadí.
- **Vlastné trasy.** Nahráš trasu chôdzou. Odbočky sa zistia samy a môžeš pridávať vlastné body s poznámkou (vchod, nástupište, schody...).
  - Potom ťa trasa vedie: odpočítavanie „23 m, odbočte vpravo“ (každých X metrov, alebo nové: každých 5–30 sekúnd), potvrdenie odbočky (dá sa vypnúť), cieľ.
  - Pri každom bode povie aj vzdialenosť k ďalšiemu („Vchod do parku. Teraz odbočte vľavo, potom 81 m.“) a v Pokynoch trasy je pri každom bode vzdialenosť (nové vo verzii 45).
  - **Keď odídeš z trasy**, povie to, kde je ďalší bod a ako ďaleko, a nové: ktorým smerom ideš a ktorým máš ísť („Idete na juhozápad, bod je smerom na severovýchod.“), a keď si prešiel okolo bodu, povie „Pravdepodobne ste prešli okolo bodu: …“. Kedy sa to povie, si nastavíš (automaticky alebo po 5–30 m).
  - Nové tlačidlo **Prepočítať trasu** počas navigácie: plánovanú trasu naplánuje znova od miesta, kde si; pri nahranej trase pokračuje k najbližšiemu bodu, ktorý si ešte neprešiel.
  - Navigácia aj späť, úprava bodov a vopred pripravené poznámky.
  - Úseky „drž rovno X metrov“, aj bez GPS (koniec potvrdíš sám, alebo odhad podľa krokov).
  - Import a export GPX.
- **Rýchle akcie na hlavnej obrazovke:**
  - **Moja poloha** (ulica, číslo, mesto, najbližšia križovatka a zoznam križovatiek okolo)
  - **Kompas** (otáčaš telefónom a povie sever, severovýchod...)
  - **Uložiť toto miesto**
  - **Okolie z mapy**
  - **Hľadať miesto**
  - **Zopakovať posledné hlásenie**
  - **História hlásení**
  - **Zdieľať moju polohu**
  - **Body trasy** (počas navigácie)
- **Okolie z mapy.** Okruh 200 m až 30 km a kategórie:
  - moje body, ulice, križovatky, všetko
  - jedlo, potraviny, obchody, zastávky MHD
  - priechody pre chodcov
  - zdravotníctvo, lekárne
  - školy, banky, pošta a úrady, toalety, ubytovanie
  - kultúra, parky a šport
  - schody a prekážky
  
  Výsledky idú od najbližšieho, každý s menom, druhom, vzdialenosťou a smerom.
- **Miesta bez názvu** (nové vo verzii 43, treba zapnúť v Nastaveniach, len Slovensko). Z vlastných mapových dát aplikácie do 2 km:
  - priechody pre chodcov (so semaforom alebo bez), priechody cez koľaje
  - schody, stĺpiky
  - zastávky, lekárne a obchody bez názvu, lavičky, ihriská a ďalšie
- **Čo sa dá s každým miestom:**
  - navigovať priamo (smer a vzdialenosť)
  - naplánovať pešiu trasu po uliciach (skúšobné): vždy sa ukáže všetkých šesť druhov - po pomenovaných uliciach, po chodníkoch, najkratšia a nové vo verzii 45: bez schodov, najmenej semaforov, najmenej odbočiek. Keď sú dve rovnaké, povie to. Každá povie dĺžku, počet pokynov, priechodov a semaforov. Pokyny majú názvy ulíc, priechody (aj či majú semafor), stĺpiky a brány na ceste
  - plánovanú trasu **uložiť medzi moje trasy** (nové vo verzii 44): potom je v Uložených trasách, ku každému bodu sa dá pridať vlastná poznámka (povie sa pri príchode k bodu), body sa dajú zmazať a trasa sa dá navigovať znova aj späť
  - sledovať miesto (priebežne hovorí, ako je ďaleko a kde)
  - uložiť ho
  - otvoriť spojenie MHD v Google Mapách
- **Čo je blízko? (napr. na stanici).** Označ si body ako „Nástupište 3“, „Schody západ“, „Vchod do haly“. Keď stlačíš Čo je blízko?, povie, pri ktorom bode si („Ste pri: Nástupište 3, 3 m.“) a kde sú tvoje najbližšie schody, vchod, východ, výťah a nástupište, so vzdialenosťou a smerom (nové vo verzii 45, dá sa vypnúť). Funguje vonku, kde je GPS.
- **Po spustení navigácie trasy** sa kurzor čítačky presunie na aktuálny bod v Pokynoch trasy a ostáva na aktuálnom bode, keď sa posúva (nové vo verzii 44, dá sa vypnúť v Nastaveniach).
- **Na každej obrazovke** je tlačidlo Späť, na hlbších aj Hlavná obrazovka.
- **Bez dotyku:**
  - odkaz s `?go=1` (napr. v Skratkách) spustí rovný smer hneď
  - voliteľne aj automatický štart po otvorení
  - voliteľne vypnutie pri odchode z aplikácie a zapnutie po návrate

**Aplikácia pre Android** (verzia 1.0) je zatiaľ len rovný smer, ale funguje aj so zamknutou obrazovkou a telefónom vo vrecku:

- veľké tlačidlo **Štart / Stop**, **Nastaviť smer** a **Nastavenia**
- v nastaveniach: povolená odchýlka, zvuky, vibrácie, hlas, „Ideš dobre“ a jazyk (podľa telefónu, slovenčina, angličtina)
- Stop a Nastaviť smer sú aj v upozornení na zamknutej obrazovke

**Čo ešte nie je overené na skutočnom telefóne:** pozri [Testing status](#testing-status).

## Web app
### Getting started
- Open https://matusbob.github.io/direction-assistant/ in Safari (iPhone) or Chrome (Android). The compass and motion sensors need HTTPS, so use this link.
- When asked, allow motion and orientation (for the compass) and location (for GPS).
- Add it to the home screen (Safari: Share → Add to Home Screen) and use that icon as your main way in. See [Updates, offline use and storage](#updates-offline-use-and-storage).
- New to the sounds? Use **Try at home (no walking needed)** to learn the beeps, vibrations and voice messages without walking outside.
- Main screen order:
  1. Start / Set Direction.
  2. Route instructions, shown during route navigation.
  3. Quick actions.
  4. Saved routes, What's nearby?, Try at home.
  5. Settings.
  6. Back to the top of the screen.

### Straight-line walking
- **Start:** the app takes the direction the phone points to and guides you along it. **Set Direction** takes a new direction at any time.
- **Drift warnings**, by audio, vibration and voice, either in degrees or in real meters measured by GPS:
  - Sound comes from the side you're drifting to.
  - Vibration says which way by feel: drifting right is one continuous buzz, drifting left is an on-off pulse. Both get longer or faster the more you drift.
  - The voice says, for example, "Drift right, 20 degrees".
- **On track:** a distinct, quiet confirmation tick plays every couple of seconds, so silence never has to mean "did this stop working?". A separate quiet warning tick plays once you're within 70 % of your limit, before you actually cross it.
- **Optional:** "Doing good" every X meters, and statistics when you stop.
- **Weak GPS:** fixes with poor accuracy (over 20 m, common in parking lots, under cover or near large metal objects) are rejected. If that lasts 15 seconds or more while meters mode or route navigation needs GPS distance, the app says so out loud, in an accessible announcement and on screen, instead of sitting silently.
- **Compass check:** if the heading readings jump erratically, the app suggests recalibrating with a figure-8 motion.
- **Obstacle mode** (optional, off by default): for places where you have to weave around things, such as a parking lot full of cars or a crowd.
  - Short sidesteps no longer set off drift alerts. The app warns only once your direction has stayed off for longer than a duration you choose (2–10 s, default 5 s).
  - That catches the real risk in those places: slowly losing your bearing after many detours. Zigzagging that evens out to straight stays silent.
  - It uses the median of recent headings, so one sharp, brief sidestep can't push it over the threshold. Facing backwards always counts as a hard drift.
  - It works wherever drift correction runs. The cane still does the obstacle-avoiding; this only keeps you heading the right way overall.

### Your own routes
- **Record a route** by just walking.
  - Turns are detected from your GPS track. Optional live voice feedback while you walk: "Straight, 15 m... 30 m... You turned right...".
  - At any point you can also mark a named point: entrance, platform, stairs, obstacle, or a custom note. It is merged into the route in the right place. "Custom name..." is the first option, so writing your own note takes one swipe.
- **Navigate a route** with turn-by-turn guidance:
  - A distance countdown to the next point at your chosen interval ("23 m, turn right" ... "now turn right"): every so many meters (the "Meters distance" slider), or every 5, 10, 15, 20 or 30 seconds (setting), which keeps telling you even while you stand still.
  - At each point it also says how far the next one is ("Park entrance. Now turn left, then 81 m."; setting, on by default), and the Route instructions list shows that distance at every point.
  - A spoken confirmation once you've actually turned ("Great, you turned left"; setting, on by default), and a chime and vibration on arrival.
  - **Leaving the route:** a spoken warning with its own descending tone and vibration, and "Back on the route" with its own ascending tone when you recover. Straying off the route is never silent, even with speech and vibration both off.
  - The distance to the next point follows your real distance in either direction, so doubling back still reads sensibly.
  - The fine heading beeps from straight-line mode are off by default during route navigation, so they don't talk over the instructions. A setting turns them on.
- **Straight-hold segments:** while recording, mark a stretch as "hold a straight line for X meters". During navigation the app locks onto your heading there, corrects drift for exactly that distance, then hands back to point-to-point navigation. There are two GPS-free variants, meant for indoor station halls, corridors and other places without GPS:
  - **"Straight, I'll confirm the end myself":** the app holds your heading from the compass alone, and you press **Done with this stretch** at the end. This is the dependable choice.
  - **"Straight, estimate by steps"** (experimental): the app counts your footsteps and multiplies by a step length you set. It is less certain, because errors add up, and it is labelled experimental everywhere it appears.
- **Navigate back** follows a saved route in reverse. Record home → restaurant once and use the same route to get back.
- **Pause / Resume** during navigation, and an optional total distance to the destination.
- **Edit a route:** rename or delete individual points without recording the route again.
- **Prepared notes:**
  - Write your instructions in advance in any notes app and paste them into "Prepare a list of notes", one per line.
  - While recording, **Next note** attaches the next one to your position. The button says which note comes next and how many are left.
  - Or record hands-free, and afterwards press **From list** at each point in Edit route.
- **Notes only** (optional): skip the automatic distance countdown and rely on your own point notes. Off-route warnings, turn confirmations and the arrival note still work.
- **Save a point here:** save your current position with a label in one step. Every saved point remembers its **address**.
- **What's nearby?** lists your saved points within about 150 m, closest first, each with its direction. Press one to navigate to it.
  - **At a station** (setting, on by default): it first says which of your points you are at ("You are at: Platform 3, 3 m"), then where your nearest stairs, entrance, exit, lift and platform are ("Nearest stairs: West stairs, 20 m, to the west."). Kinds are recognised by a word in the point's name (Slovak or English: schody/stairs, vchod/entrance, východ/exit, výťah/lift, nástupište/platform). Mark each platform, its stairs and entrances once; GPS works outside on the platforms, not inside the hall.
- **Import and export routes as GPX**, for other GPS apps or as a backup.

### Quick actions
Shown on the main screen; a setting hides them. "Where am I?" and "Repeat" are on the recording screen too.

- **My location**:
  - **The button's label is the live line**, for example "My location: street, number, city. Intersection X and Y, 30 m.", plus "Saved point: Entrance, 12 m" when one of your points is within 50 m.
    - It fills in from the GPS the app is already using while you walk, navigate or record. It looks up again after you've moved 25 m, at most every 15 s, and it never announces itself.
  - **Pressing it opens the My location screen**, which reads out:
    - the address
    - the nearest intersection and where it is from you
    - which way you're facing, the GPS accuracy and the nearest saved point
  - **The screen also has:**
    - **Read the nearest address**, to hear it again
    - a list of **intersections nearby**, up to 8 within 200 m, each with distance and direction (press one to navigate to it, track it or save it)
    - **Share my location** and **Save this place**
  - **Timing:**
    - The address comes first, usually within 2 seconds.
    - Intersections come from the routing service's street data, usually within a second. If they arrive later, they are said as a follow-up.
    - While waiting, the app says what it is waiting for, for example "Still waiting for the position - if the phone is asking whether to allow location, allow it".
    - If precise GPS takes more than 4 seconds, a rougher network position is used and its accuracy is read out.
- **Compass:** a toggle. Turn the phone and it says North, North-east, East... It speaks only once you've stopped on a direction, and it doesn't flip-flop on the edge between two directions.
- **Save this place:** saves where you're standing as one of your points, at any time, including while walking or navigating.
- **Places nearby (map):** see [Places nearby](#places-nearby).
- **Search for a place:** see [Search](#search).
- **Repeat last announcement** and **Announcement history.**
  - The last 100 announcements are kept, newest first, each as its own heading, so the VoiceOver rotor set to Headings steps through them.
- **Share my location:** opens the share sheet with a map link and the address.
  - If the position has to be looked up first, iOS doesn't allow the share sheet that late after the tap. The app then says "Location found - press again", and the second press shares at once.
  - Without a share sheet, the link is copied to the clipboard.
- **Route points** (only during route navigation): every point of the route with its distance from you, which one is the current target and which are passed. You can pick a different point as the target, for example if GPS skipped one.
- **Recalculate the route** (only during route navigation), for when you got lost or the guidance goes round in circles: a planned route is planned again from where you are, of the same kind (your notes on a saved route stay in Saved routes); a recorded route goes on to its nearest point you haven't passed yet ("Going on to the nearest point of the route: Bench, 16 m, ahead to the left").
- **Stop tracking:** appears while you track a place.

### Places nearby
- **Choose how far to look:** 200 m, 500 m, 1, 2, 5, 10 or 30 km. The choice is remembered.
- **Categories:**
  - My saved points
  - **Streets and roads:** every named street around you, with the distance and direction to its nearest point
  - **Intersections:** every place where differently named streets meet
  - **Everything nearby:** places of every kind together with the streets and intersections, with the counts read out
  - Food and drink, Groceries, Shops
  - Public transport stops and stations
  - Pedestrian crossings
  - Health care, Pharmacies
  - Schools and universities, Banks and cash machines, Post office and authorities, Toilets, Accommodation
  - Culture and sights
  - **Steps and obstacles** (only with the own map data on)
  - Parks and sport
- **How results are listed:** nearest first, as "name, kind, distance, direction".
  - They come 60 at a time, with a **Show more** button at the end, so nothing is cut off silently.
  - Stops include their platform letter.
  - Crossings say whether they have traffic lights, a sound signal, tactile paving or a refuge island, when the map knows.
  - If nothing is in range, the app looks further out by itself (up to 30 km) and says how far it had to look.
- **Where the data comes from:**
  - Named places come from Photon: fast and dependable, the 50 nearest of each kind within the radius. "Everything nearby" asks in four groups, so up to about 200.
  - Streets and intersections come from the routing service (Valhalla), up to 1 km (500 m inside Everything nearby). Named service roads and pedestrian streets are added from Photon, with an approximate position.
  - Pedestrian crossings and toilets, and extra details of a place you open (opening hours, platform, lines), come from the detailed Overpass servers.
    - Four servers are used, starting with the one that answered last. If one hasn't answered within 3.5 s, the next is asked as well.
    - If none answers, the app says so and offers Refresh.
  - These limits are said out loud whenever they apply.
- **Places without a name, from the app's own map data** (setting, off by default; Slovakia only):
  - **Why:** most things around you are on the map without a name, and the map services list only named places. Around Lesná 6 in Nové Zámky only 11 of the 80 mapped objects within 500 m have a name.
  - **What it adds**, from the app's own copy of OpenStreetMap:
    - pedestrian crossings, with traffic lights, sound signal and tactile paving when mapped
    - crossings over tracks, level crossings, traffic lights
    - steps (number of steps, handrail), bollards and barriers on paths
    - bus and tram stops
    - unnamed shops, pharmacies, cafés and other places
    - benches, recycling containers, playgrounds, wayside crosses and shrines, defibrillators
    - named places the services miss: sports clubs, speech therapists, an observatory...
  - **Range:** up to 2 km. The app says so when the radius is bigger. Places already in the list are not repeated.
  - **With the setting off:** Pedestrian crossings and Toilets still use this data when the Overpass servers don't answer, instead of only reporting a failure.
  - **Data:** taken from OpenStreetMap on 15 November 2026 and not updated by itself.
- **What you can do with any place** (from Places nearby, Search, My location or an intersection):
  - see its details: kind, address, platform, lines, opening hours as written on the map, distance and direction
  - **Navigate straight to it**, by direction and distance, like one of your own points
  - **Plan a walking route along streets** (experimental, see below)
  - **Track this place**
  - **Save to my points**
  - **Open public transport directions in Google Maps**
- **Track this place:** the app keeps telling you how far the place is and which way as you move.
  - Updates come every 10 m within 100 m, every 25 m within 500 m, and less often further away. Within 15 m it says "You are at ...".
  - It runs alongside walking or navigating.
- **How directions to places are said** (setting):
  - left / right / ahead / behind (the default)
  - clock face ("at 2 o'clock")
  - compass directions ("to the north-east")
  
  Left/right and clock need the compass. If the phone doesn't allow it, compass directions are used.

### Search
- Type a name or an address, such as "Hlavná stanica" or "Obchodná 10 Bratislava". Results favour your surroundings and are listed nearest first.
- If the first search service (Nominatim) fails or finds nothing, a second one (Photon) is tried. It is more forgiving with spelling.
- A general word such as "zastávka", "lekáreň", "bankomat", "wc" or "priechod" lists the nearest ones of that kind instead.
- It works without a location too, just without distances.

### Walking routes along streets (experimental)
- **Planning:** from any place, **Plan a walking route along streets** asks the Valhalla routing service (OpenStreetMap data) for a pedestrian route from where you are.
- **All six kinds of route are always listed**, each with its length, time, number of instructions, pedestrian crossings and traffic lights. When two kinds turn out to be the same path, the later one says so ("Shortest route: same route as Along footpaths, 425 m...") and opens the same route. A kind that couldn't be loaded says so.
  1. **Along named streets.** This comes first, because street names give far more to orient by: "turn left onto Lesná, then right onto S. H. Vajanského".
  2. **Along footpaths**, the map's default (the router is also asked for up to two alternative routes).
  3. **The shortest.**
  4. **Without steps:** steps are avoided wherever possible; the summary says "no steps", or how many flights remain.
  5. **Fewest traffic lights:** of all routes found (no more than 1.6 times as long as the shortest), the one with the fewest traffic lights. If the map doesn't say where the lights are, it says it can't tell.
  6. **Fewest turns:** of the same routes, the one with the fewest instructions.
- **Before you start**, opening a variant shows every instruction with its distance, with **Start navigation** and **Save to my routes**.
- **Save to my routes** keeps the route in Saved routes (named "Route to ..., along named streets - date"). It waits until the street names are filled in. There, **Edit** lists its points (the silent way points that only carry the route's shape are left out):
  - each instruction point has a **Note** button: your own note is said right after the instruction when you reach that point, and is shown in the instructions list; an empty note removes it
  - the destination can be renamed, and points can be deleted
  - **From list** puts your next prepared note on a point as its note
  - **Navigate back** works too: the instructions of the way there would be wrong backwards, so on the way back the turns are worked out again ("Turn right 1"...), crossings are kept, and so are your notes
- **How the instructions read:**
  - Unnamed sidewalks get the street they run along: "turn left onto the walkway, along G. Bethlena".
  - Sharp bends inside a long stretch are announced ("The route bends left"); gentle ones are followed silently.
  - Stretches shorter than 15 m are joined into one instruction ("... Then turn left ...").
  - **Pedestrian crossings** the route uses become part of the instructions, for example "over a pedestrian crossing across S. H. Vajanského", and "with traffic lights" when the router reports lights there. Each variant says how many crossings and traffic lights it has. Only crossings drawn in the map are known.
  - **Bollards and gates** on the path are said ("..., careful, a bollard", or on their own "Careful, a bollard on the path.", "Go through the gate.").
  - At the start the app says which way the first instruction is from where the phone points ("That is behind you"), and which side the destination is on ("At the end: your destination is on the left").
- **Navigation** uses the same engine as your own routes: "50 m, turn right onto Laurinská" ... "Turn right onto Laurinská", including what the map knows about crossings, steps and escalators.
- **Limits:** the route comes from the map. The map doesn't know about obstacles, road works or which crossings are safe, and GPS can be several meters off. It doesn't replace a cane, a guide dog or your own judgement.

### During any route navigation
- **Route instructions** on the main screen list all points of the route, with the current target marked and passed ones labelled. Pressing one makes it the target. The list is redrawn only when the target changes, so a screen reader's place in it isn't disturbed. A setting turns it off.
- **The screen reader is moved to the current point** when route navigation starts (setting, on by default): VoiceOver lands on "1. ..., current target" in Route instructions instead of staying where you were. While it is on the current point, it moves on with it when the next point becomes current. If you are elsewhere on the screen, it is left alone.
- **Leaving the route says more** (setting, on by default): besides "You are off the route", the app adds that you're moving away from the next point, probably the wrong way, and where that point is ("It is behind you, 40 m").
- **Which way you walk, and a point you walked past** (setting, on by default): the off-route message also says which way you have been walking (from your last 8 m or more of GPS) and which way the point is ("You are walking south-west; the point is to the north-east."). If you came within 25 m of the next point without reaching it and are now moving away, it says "You have probably walked past the point: Turn left onto Lesná. It is behind you to the left, 26 m." When the warning comes is set with "Warn that I'm leaving the route once I've walked away from the next point by" (automatically, or 5–30 m).

### Hands-free start and stop
- **`?go=1`:** https://matusbob.github.io/direction-assistant/?go=1 starts the straight-line assistant at once, for example from a Siri Shortcut or Back Tap. The first-run permission prompts still apply once per device.
- **Auto-start** (setting, off by default): the same, but it also works with the home-screen icon. If the phone refuses the compass without a tap (iOS can do this), the app says "Press Start once" instead of waiting silently.
- **Stop when I leave, start when I come back** (setting, off by default):
  - Going to the home screen or another app, or locking the phone, stops the straight-line assistant.
  - Coming back starts it again, facing the direction you're pointing at that moment. If you stopped it yourself, it stays stopped.
  - Route navigation and recording are never stopped by this.
- A screen wake lock is requested while walking, navigating or recording, so the screen doesn't lock by itself.
- A web app's sensors stop completely when it's in the background or the phone is locked, so keep it in front while you use it. The Android app doesn't have this limit.

### Accessibility
- Every announcement also goes through an accessible live region. That covers drift alerts, back on track, doing good, turn-by-turn, off-route, total distance, the compass warning and recording feedback. VoiceOver reads it even with the app's own voice turned off, so you don't need both. Each event is read once, without an echo.
- The sliders adjust by swiping, like native sliders, and announce the value with its unit. Each also has a **Menu** button with a list of values.
- Decorative labels are hidden from the screen reader.
- **Back** is at the top of every screen (before the title) and at the bottom. Screens two or more steps deep also have **Main screen**.
- Language: Slovak or English, with the button at the bottom of the screen.

### Settings
All settings are remembered. New features are usually off by default, so nothing changes unless you turn them on. The exceptions were asked for as the normal behaviour and can each be turned off: moving the screen reader to the current point (44), and in version 45 the distance at each point, the walking direction / missed point when off the route, and which of your points you're at in What's nearby.

| Setting (Slovak name in the app) | Default |
|---|---|
| Units: degrees or meters | degrees |
| Citlivosť (stupne) - sensitivity in degrees, 5–40 | 15 |
| Citlivosť (metre) - sensitivity in meters, 0.5–15 | 5 m |
| Režim medzi prekážkami - obstacle mode, and how long a drift must last (2–10 s) | off, 5 s |
| Režim hlasového výstupu - voice: off / only when drifting / always | only when drifting |
| Pípanie pri vybočení - spatial audio beeps | on |
| Vibrácie pri vybočení - vibrations | on |
| Oznámiť štatistiku po zastavení - statistics on stop | on |
| Ideš dobre každých X metrov - "Doing good" every X meters (1–50) | off, 10 m |
| Jemná korekcia smeru počas navigácie trasy - fine correction during route navigation | off |
| Vynechať automatické odpočítavanie - rely on my own point notes only | off |
| Rýchlejšie aktualizácie polohy - GPS every second instead of every 3 s | off |
| Keď odídem z trasy, povedať aj... - say where the next point is when off the route | on |
| Upozorniť, že sa vzďaľujem od trasy - off-route distance: automatic / 5–30 m | automatic |
| Keď odídem z trasy, povedať aj, ktorým smerom idem... - walking direction and a missed point when off the route | on |
| Počas navigácie trasy hlásiť vzdialenosť k ďalšiemu bodu - every N meters / every 5–30 seconds | every N meters |
| Pri každom bode trasy povedať aj, ako ďaleko je ďalší - distance to the next point at each point | on |
| Potvrdiť, keď som odbočil správne - turn confirmation | on |
| V „Čo je blízko?“ povedať, pri ktorom mojom bode som... - which point I'm at, nearest stairs / entrance / platform | on |
| Hlasová spätná väzba počas automatického nahrávania - voice while recording | on |
| Oznámiť celkovú vzdialenosť do cieľa - total distance to destination | on |
| Po otvorení aplikácie hneď spustiť asistenta - auto-start | off |
| Vypnúť asistenta, keď odídem z aplikácie... - stop when I leave, start when I come back | off |
| Zobraziť všetky body trasy - route instructions on the main screen | on |
| Po spustení navigácie trasy presunúť kurzor čítačky na aktuálny bod - move the screen reader to the current point | on |
| Zobraziť rýchle tlačidlá - quick actions | on |
| Ako hovoriť, kde sa miesto nachádza - directions: sides / clock face / compass | sides |
| Priebežne aktualizovať „Moja poloha“ - keep My location updated all the time | off |
| V Okolí ukazovať aj miesta bez názvu - places without a name from own map data | off |
| Dĺžka kroku - step length for the step estimate (0.4–1.2 m) | 0.7 m |

### Updates, offline use and storage
- **Installable and offline:** the app installs as a home-screen app (PWA) and opens offline. The map features need the internet.
- **Updates arrive reliably:**
  - When online, the page is always loaded fresh. The saved copy is used offline, or if the network takes more than 5 seconds.
  - The app checks for a new version every time it's opened or brought to the front. An update can't store a stale copy from the browser's cache.
  - Phones stuck on a version before 38 are reloaded once automatically.
  - A Wi-Fi login page is never saved in place of the app.
- **iPhone note:**
  - Safari and the home-screen icon keep separate saved routes and settings.
  - Safari may clear a website's data if it isn't opened for about a week; the home-screen icon doesn't.
  - Use the icon as your main way in, and export routes as GPX now and then as a backup.
  - Right after an update, the first launch can still show the previous version. Close the app and open it again.

### Map data and services
- Addresses, intersections, places, search and planned routes use OpenStreetMap data (© OpenStreetMap contributors, credited in the app footer).
- They come through the public Nominatim, Photon, Overpass and Valhalla services, plus the app's own copy of OpenStreetMap in `data/poi1/`.
- These services need an internet connection. They are called only when you ask for something, or, for the My location line, after you've moved.
- Map data can be incomplete or out of date. It doesn't know about obstacles or road works.

## Android app (experimental)
A separate, deliberately simple native app for the core feature: holding a straight line. It keeps working with the screen locked and the phone in a pocket, which the web app can't do.

**Download (version 1.0):** https://matusbob.github.io/direction-assistant/downloads/smerovy-asistent.apk

### Installing the APK
1. On the phone, open the link above in Chrome and download the file.
2. Open the downloaded file (from the download notification, or Files → Downloads).
3. If Android asks, allow **Install unknown apps** for Chrome, then go back and choose **Install**.
4. Google Play Protect may warn that the app is from an unknown developer, because it isn't from the Play Store. Choose **Install anyway**.
5. On the first Start, allow notifications. If you turn on "Doing good", also allow location.

A newer APK installs over the old one and keeps your settings.

### What it does
- **One screen:** a large **Start / Stop** button, **Set direction** and **Settings**. While it runs, the notification has Set direction and Stop too, including on the lock screen.
- **The same straight-line behaviour as the web app:**
  - The direction is taken 1.2 s after Start.
  - Within the allowed deviation: a quiet tick every 2.5 s, and one warning tick at 70 % of it.
  - Beyond it:
    - beeps from the side you drift to, faster and higher the further off
    - vibration: drifting right is one continuous buzz, left is pulses, both stronger when you're far off
    - a spoken message at most every 3 s ("Drift right, 20 degrees", "Back on track.")
  - A summary on Stop ("You drifted 2 times.").
- **"Ideš dobre" / Doing good** every 10, 20, 50 or 100 m from GPS. It is off by default and asks for location only when you turn it on. It includes a weak-GPS warning.
- **Compass calibration warning** when readings jump or the sensor reports low accuracy.
- **However you carry the phone:**
  - Lying flat, it follows the top edge.
  - Held or carried upright, for example in a front pocket either way up, it follows the back of the phone.
  - The way that is closer to level when you set the direction is kept for the whole walk. If you change how you hold the phone, press Set direction again.
- **Settings:**
  - Povolená odchýlka - allowed deviation, 5–40 degrees (default 15)
  - Zvuky - sounds
  - Vibrácie - vibrations
  - Hlas - voice: off / only when drifting / always
  - Ideš dobre - Doing good
  - Jazyk - language: phone / Slovak / English
  
  With the app's own voice off, messages go to TalkBack while the app is open, so nothing is read twice.
- **Languages:** Slovak and English throughout, including the voice. This needs the phone's text-to-speech voice for that language.
- **Background:** it runs as a foreground service while guiding; nothing runs after Stop.

Source, build and test instructions: [`android/`](android/README.md).

## Testing status
- **Web app.** Every version is tested before it is published:
  - automated browser tests of every feature, with recorded map answers
  - comparison against the previous version, so nothing changes by accident
  - checks against the real map services around Lesná 6, Nové Zámky
  - real use on an iPhone with VoiceOver by the author: saved points, and being told when you reach one, were reported to work dependably
  - **Places without a name (43), saving planned routes and the moved VoiceOver cursor (44), and in version 45 the new kinds of route, the walking-direction and missed-point messages, Recalculate the route and the station points still need checking on the iPhone and outside.** GPS jumps of a few meters can make "walked past the point" or the walking direction wrong now and then.
- **Android app.** Tested on a simulated Android (Robolectric) and with unit tests, **not yet on a real phone**. Still to check on the device, at home first and then outside with someone sighted nearby:
  - how the compass behaves in a pocket
  - how it works with the screen off
  - vibration strength

## Files
- `index.html`: the current web app, the same as `smerasistentv3.html`. It is kept in sync, so the link above always shows the latest version.
- `smerasistentv3.html`: the latest version and the source of truth for `index.html`.
- `sw.js`: the service worker, which handles updates and offline use. `manifest.json` and the icons are for installing the app.
- `v2.html`: an earlier version, kept for reference.
- `data/poi1/`: the app's own map data.
  - Points of interest in Slovakia as small tiles (0.02° × 0.03°, about 2 × 2 km), with `meta.json` (date, tile list).
  - Derived from OpenStreetMap (© OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/)), made with `tools/poi/` (see [its README](tools/poi/README.md)).
- `android/`: the Android app's source. `downloads/smerovy-asistent.apk` is its latest build.
- `tests/`: automated tests of the web app with recorded map answers (see [its README](tests/README.md)).

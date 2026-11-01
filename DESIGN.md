# Glass Houses

Six glass houses around a cul-de-sac. Everyone throws stones. Last house with glass wins.

## The pitch and the goal

**Pitch:** "Everyone on the street lives in a glass house, and everyone throws stones."

**The goal in one look:** you stand on your lawn with a stone in your hand. Across the green stand your neighbours' glass
houses, each with its pane count on the wall as a big house number. Panes shatter, the numbers tick down, a house goes dark.
Last house with glass wins.

**In two words, once, as round 1 starts:** "Break their glass." The first time your own glass breaks: "Keep yours."

## The world in one paragraph

Palm Court, a 1960s desert-modern cul-de-sac at golden hour. Six two-storey glass boxes with white steel frames, flat
cantilevered roofs, flagstone side walls and breeze-block screens stand around a round green. In the middle, an old oak grows
out of a round concrete fountain. Each house has a turquoise pool, a palm or two, an owner colour (door, flag, mailbox wall,
the player's sleeve) and a symbol. The hardware store on the corner, where the cul-de-sac meets the road, has a neon OPEN sign.
The sun sinks while you play.

## Controls

| Action | Keyboard and mouse | Phone or tablet |
|---|---|---|
| Aim | Mouse (pointer lock after a click in the world) | Drag anywhere on the right half of the screen |
| Throw | Hold left click (or Space) to wind up, let go to throw | Hold the big **Throw** button, let go to throw |
| Move on your lawn | W A S D | The platform's stick (`stick: 'wasd'`) |
| Repair | Hold R | Hold the **Repair** button |
| Free the mouse | Esc (opens the game's small card: Resume) | (no lock on touch) |

- Two buttons on phones: `ow.controls.set({ stick: 'wasd', buttons: [{ id: 'throw', label: 'Throw', key: ' ' }, { id: 'repair',
  label: 'Repair', key: 'r' }] })`. Aim-drag keeps working with a second finger while Throw is held. The aim zone is the right
  55% of the screen minus `ow.ui.reserved`; drag sensitivity scales with the screen width (a full-width drag turns 150°).
- Pitch is clamped to -35°..+70°; yaw is free (turn round to look at your own house).
- A ghost (a player whose house is out) uses the same keys: move drifts the ghost over the green, Throw throws a pebble.
- Hold to wind up: power rises from 0 to 1 over 0.9 s (ease-out), then stays at 1. Releasing at any power throws. Right click
  (or sliding the aim finger off the screen) does nothing special: there is no cancel to learn.
- `controls` in onceworlds.json: Mouse "Aim"; Hold Click/Space "Wind up, let go to throw"; W A S D "Move on your lawn"; Hold R
  "Repair your glass"; Esc "Free the mouse".

## The first 60 seconds

| Time | Screen | Words |
|---|---|---|
| 0 s | **Title.** The cul-de-sac alive: a slow crane shot round the green while six bot neighbours play a real round. Panes burst into glittering shards, house numbers tick down. "Glass Houses" in big mounted letters top-left of centre, one big **Play** door bottom-centre. | none |
| ~2 s | Play (tap, click, Space or Enter) starts the AudioContext. The camera glides down to **the lobby**: a high view of the street, every lawn with a real-estate sign (avatar and name, or the bot neighbour who lives there). Your house's porch light and sign are marked with an arrow and your colour. | none |
| ~4 s | Alone: the platform's Ready strip is at the bottom; the Street plate shows Palm Court. One tap on Ready. With others: everyone readies (public), or the host starts (private). | the platform's "Ready" |
| ~5 s | **Our own 3-2-1** (`ownCountdown: true`): big house numerals drop onto your mailbox one by one while the camera flies down into first person on your lawn. | "3", "2", "1" |
| 8 s | **Round 1.** First person, a stone in your hand, the green ahead, five houses across with "20" on each wall. | "Break their glass" (2 s) |
| 10 s | Hold: the dotted arc grows from your hand and lands on what you aim at. | "Hold to wind up" until the first hold; then "Let go to throw" while holding, once |
| 11 s | First throw: whoosh, the stone arcs, a pane bursts, the house number flips 20 to 19. | none |
| ~16 s | A stone whooshes past your head (bots hold off your house for the first 6 s of a first-ever round). | none |
| ~20 s | Behind you: a crash. A shard flash on the bottom edge of the screen, your plate drops 20 to 19, an arrow at the screen edge points at who threw it, their plate blinks. | "Keep yours" (1.5 s) |
| ~30 s | Your third pane gone. | "Hold R to repair" (touch: "Hold Repair"), once |
| ~35 s | A brick thuds onto the lawn line between you and a neighbour. | "Grab it!" over the brick, once |
| 40-60 s | A gnome screams across the green, someone gets bonked, the first house falls into a cascade of shards and goes dark. | "Brick: breaks 3" the first time you hold one |

The first round of a match is gentler: wind at 30% of the street's range. In a player's first-ever round (`firstRound` in
`ow.save`) no bot throws at their house for the first 6 s, and at most one bot at a time until 0:30.

## The rules

### Houses and panes

- Every house has **20 panes** on the front facade facing the green: 10 columns by 2 storeys, each 1.2 m wide and 2.0 m tall,
  in white steel mullions (0.1 m). The facade is 13.1 m wide and 4.4 m tall, on a 0.5 m plinth.
- A pane is **glass**, **cracked** or **broken**. A stone breaks the pane it hits. A ghost's pebble cracks a glass pane; anything
  that hits a cracked pane breaks it.
- The **house number** on each house's breeze-block mailbox wall is its panes with glass (cracked ones count). It is huge,
  facing the green, readable from across the street.
- A stone that hits a broken pane's empty frame flies into the house (a lamp topples, a vase breaks: no effect on the count).
  So the last few panes are the hardest to hit, which keeps a house alive longer near the end and rewards accuracy.
- A stone that hits a mullion, a wall, the roof, the oak, the fountain or the ground stops (a clunk and a little bounce).
- Your own stones never break your own glass (they clunk off).
- **A house with no glass is out.** Its lights go off, its number reads 0, and its owner becomes a ghost. Out is final for
  the round: a house at 0 can't be repaired.

### Throwing

- Hold to wind up (0.9 s to full power), let go to throw. Speed: 14 m/s at zero power to 30 m/s at full. Gravity 9.8 m/s².
- The **dotted arc** shows the path with no wind, from your hand to where it lands (a ring on the ground, a small cross on a
  wall). Dots fade towards the far end. Wind is not in the arc: it is read from the windsock on the oak, the flags on the lawns
  and leaves drifting across the green, plus a small wind arrow under the clock.
- **Ammo:** the stone pile by your feet holds 5. One stone comes back every 0.8 s. The pile is drawn as five stones at the
  bottom of the screen.
- Stones are 0.12 m in radius. They fly in real arcs with the wind as a sideways acceleration.

### Moving, bonks and body blocks

- You move only on your own lawn: a box 9 m wide and 4 m deep in front of your house. Strafe speed 4.0 m/s (acceleration
  30 m/s², 8 m/s² on Snow Day).
- A stone that hits a player **bonks** them: the view wobbles, little stars circle the top of the screen, and they can't throw,
  move or repair for 1.0 s. After a bonk, 0.5 s of immunity. The stone stops: standing in front of your glass blocks it.
- Bonking a repairing player resets the pane they were glazing.

### Repair and the hardware store

- **Hold Repair** anywhere on your lawn, standing still, not throwing: the broken (or cracked) pane nearest the middle of the
  facade is re-glazed in 1.5 s, then the next one. Moving, throwing or a bonk stops it. A glazier's squeak while it works, a
  ting when a pane is done; your plate counts up.
- **At 2:00 the hardware store closes**: its neon flips from OPEN to CLOSED with a shop bell, repairs end for everyone, and the
  wind picks up (x1.6).
- The round ends at **3:00** at the latest. Then the house with the most glass wins (cracked counts as glass).

### Intercepts

- A stone that touches another stone in the air knocks both down with a clack and a spark (combined touch radius 0.45 m, more
  generous than the stones look). A ghost's pebbles don't touch stones.
- Stones aimed at your house or at you get a faint red tint on their trail and a rising whistle, so a defender sees what is
  coming.

### Specials

- The first special lands at 0:25, then one every 25-35 s (Mesa Drive: every 18-25 s), never after 2:30. It drops onto the
  line between two neighbouring lawns, so either neighbour can grab it by walking over it. It sits there for 15 s, then
  vanishes. One special in hand at a time; your next throw throws it.
- **Brick:** breaks the pane it hits and both panes beside it in that row (3). Heavy: 12-22 m/s, so far houses need a high arc.
- **Garden gnome:** breaks the pane it hits, then ricochets along the facade into the next pane in the direction it was flying
  (2 in a row). It screams on the way ("wheee", a gliding whistle). It also skips once off the ground instead of stopping.
- Specials alternate brick, gnome, brick... from the round's seed.

### Ghosts

- When your house is out you become a **ghost**: a translucent figure in your colour floating 3.5 m above the green, drifting
  where you steer (5 m/s, inside 13 m of the oak).
- Ghosts throw **pebbles** at half power (7-15 m/s; 3 in hand, one back every 2.5 s). A pebble cracks a glass pane; two
  pebbles break one. Pebbles pass through stones and players.
- A living player's stone that hits a ghost **poofs** it back to the fountain (2 s before it can throw again).
- Latecomers who watch a round float as ghosts too, without pebbles, with the label "Watching".

### Winning a round, and a match

- The round ends when only one house has glass (or none: a simultaneous last break ties), or at 3:00.
- Places: last house standing first, then the others in reverse order of falling. At 3:00, houses still standing rank by panes
  with glass; ties share a place.
- **Points per round: 3 for first, 2 for second, 1 for third.** A match is 1, 3 or 5 rounds (the host picks; default 3). Most
  points wins the match; a tie on points goes to more round wins, then to more panes broken.

## The core loop and where mastery comes from

Every two seconds a decision: who to throw at, how hard, how high, whether to move, whether to repair.

| | A beginner | An expert |
|---|---|---|
| Aim | Holds to full power and lets go when the arc touches the nearest house | Line drives (fast, flat: less wind drift, hard to intercept) for close houses, high lobs over the oak for the far side |
| Wind | Ignores it, sees stones drift | Reads the windsock and the leaves, aims upwind by the right amount; knows lobs drift three times more than line drives |
| Targets | Throws at whatever is in front | Picks the leader, finishes a house on 2 panes before someone else gets the places, takes revenge on whoever is hitting them |
| The last panes | Throws at the house and hits empty frames | Aims at the remaining panes one by one; saves a brick for a cluster of three |
| Defence | Repairs when nearly dead and gets bonked doing it | Repairs in quiet moments, before 2:00, at the edge of the lawn where fewer lines reach; strafes when a stone is coming |
| Intercepts | Never | Knocks down stones aimed at their house, especially slow lobs and bricks |
| Bonks | Never aims at people | Bonks repairers, leads strafing players, poofs a ghost that's cracking their glass |
| Movement | Stands still | Strafes to find angles around the oak and fountain, races neighbours to specials |

Fewer panes are harder to hit, an out player keeps throwing as a ghost, and the store's closing forces the end: a player behind
on glass is never out of it until the last pane.

## Streets (the setting, and the solo ladder)

Every layout puts the houses' facades facing one centre point, so every lawn can reach every house. A street is a small set of
numbers: house angles, radius and heights, the centre props, the time of day, the wind range, the lawn friction and the bot
neighbours who live there.

| # | Street | Layout | Wind (m/s²) | Light | Neighbours' skill |
|---|---|---|---|---|---|
| 1 | Palm Court | Ring, facades 22 m from the oak, 60° apart | 0-1.0 | Golden hour | 0.20-0.40 |
| 2 | Sunset Loop | Ring of 24 m; a parked convertible and palms in the centre instead of the oak | 0-1.5 | Low red sunset | 0.30-0.50 |
| 3 | Narrow Lane | Two curved rows of three facing each other across a 15 m lane (angles ±25° around 0° and 180°): across is close, next door is edge-on | 0-1.0 | Bright late afternoon | 0.35-0.55 |
| 4 | Cliff Top | Horseshoe on 240° of arc, the open side a cliff over the sea; gusts | 0.5-3.0 | Hazy gold | 0.40-0.60 |
| 5 | Hillside | Amphitheatre: the far houses terraced up to 6 m higher; height helps | 0-1.5 | Golden hour | 0.50-0.70 |
| 6 | Porch Lights | Ring of 22 m at night: lit interiors, porch lights, glowing stone trails | 0-1.5 | Night | 0.55-0.75 |
| 7 | Snow Day | Ring of 20 m, snow falling, icy lawns (you slide), a frozen fountain | 0.5-2.0 | Overcast white | 0.60-0.80 |
| 8 | Mesa Drive | Ring of 26 m on a mesa top, specials more often | 0.5-3.0 | Dusk | 0.75-0.95 |

The wind blows from a direction that turns slowly (a full turn over 3-5 minutes) with gusts: smooth noise from the round's
seed on the match clock, the same on every page.

## Solo

A player alone is the host of their own server: they pick the street, ready up, and play a full match against **five bot
neighbours** of that street. Nothing is separate: it is the same lobby, the same match.

- **The Street Ladder.** Alone in the lobby, the Street plate becomes the ladder: eight green street-name blades in a row, the
  locked ones padlocked. Each street has three stars for **your best round win there**: 1 star for a win, 2 for a win with 8 or
  more panes left, 3 for a win with 15 or more. One star on a street unlocks the next.
- After a solo match, the lobby comes back with the next unlocked street already picked: one tap on Ready is the next go.
- How long it lasts: a round is 2-3 minutes; eight streets with harder neighbours and new conditions take 1-2 hours to clear
  and much longer to three-star (24 stars). Stars won on any street count, in a public server too.
- Esc frees the mouse and shows a small card (Resume). The platform only lets a private server's host pause a match, so in a
  private server the card also has Pause (`room.pauseMatch()`); a solo round in a public server keeps running (it is 3
  minutes at most).

## Multiplayer

- **A public game**, up to 6 per street: `ow.rooms.join({ maxPlayers: 6, minPlayers: 1, lobby: 'bar', ownCountdown: true,
  settings: [{ id: 'street', label: 'Street', options: 1-8 with names, default: 1 }, { id: 'rounds', label: 'Rounds', options:
  [1, 3, 5], default: 3 }] })`. Friends get private servers and invites from the platform.
- **Lobby:** drawn by the game (the street from above, signs on the lawns), with the platform's Ready strip. Public: everyone
  readies and the room starts the countdown. Private: the host's Start. Joining never starts anything. The host picks the
  street (from the streets the host has unlocked) and the rounds on our plates (`room.setSetting`); a change clears the ready
  flags (`room.clearReady()`).
- **Bots in empty seats** (`createBots(match, { host, fill: 6 })`), named and dressed from the street's lineup. They play like
  people (below).
- **Match:** `createMatch(room, { rounds: 'rounds', roundSeconds: 180, introSeconds: 3, roundEndSeconds: 6, resultsSeconds: 20,
  points: [3, 2, 1], admit: 'round' })`.
- **Latecomers** watch as a ghost without pebbles ("Watching") and take a bot's house at the next round (`admit: 'round'`). With
  six people, they watch until the next match.
- **Leavers** keep their seat and their points. A house whose owner is away or gone stands defenceless (its owner's figure is
  replaced by a "Back soon" sign) and the host decides its glass. A reload is back within 15 s and carries on from presence.
- **Host change:** the match record, the houses the host decides, the bots and the special are all in host state, so the next
  host carries on (`resume`).
- **Room closes:** 'kicked' "You were removed" and Play, 'disconnected' Rejoin, 'replaced' "Playing in another tab" and Play
  here; each button calls `rooms.join` again with the same options.

### Netcode

The idea: **every page runs the same deterministic stone simulation; each house's glass is decided by one page.**

- **Throws are messages:** `room.send({ k: 'throw', id, by, kind, o: [x, y, z], v: [x, y, z], t })`, where `t` is the match time
  of the release (`room.matchNow()`, the same clock everywhere) and `kind` is stone, brick, gnome or pebble. Bots' throws come
  from the host with `by: 'bot:N'`. About 1-2 messages a second per player.
- **Every page simulates every stone** on the match clock in fixed steps of 1/120 s from its release tick, with the wind as a
  function of the round seed and the tick. A throw that arrives late is fast-forwarded from its release tick, including its
  collisions with other stones. Stone-on-stone intercepts depend only on the throws, so every page agrees on them.
- **Who decides what:**
  - Your own glass and your own body: **your page** (you see your own position exactly, and what you saw happen to your house
    is what happened). Your page publishes your panes in your presence.
  - Bots' houses and bodies, and the houses of players who are away or gone: **the host**, in host state.
  - A ghost's poof: the ghost's own page (the host for bots' ghosts: out bots haunt the street too).
  - The round, places, points, specials and the bots: **the host** (`createMatch`, `host:` keys).
- **Late intercepts:** the page that decides a house keeps the last 400 ms of pane hits with the stone that made each; if a
  throw that arrives late knocks that stone down before its hit, the pane comes back.
- **Other pages predict:** a stone that hits a pane on any page bursts at once (juice within 100 ms); the deciding page's mask
  arrives about 100 ms later, and a predicted break it doesn't confirm within 600 ms is put back with a glint (rare).
- **Presence** (20 Hz, under 200 bytes): `{ x, z, yaw, pitch, pw (wind-up), st (stunned until, match ms), rp (repair progress),
  h (special in hand), g (glass mask, 20 bits), c (cracked mask), gv (mask version), gh (ghost: 0 alive, 1 ghost), gx, gz }`.
  Remote players are drawn with `room.presenceAt(id, { angles: ['yaw'] })`.
- **Host state:** `host:ow.match` (the createMatch record: round data `{ street, seed, out: { [seatId]: matchMs } }`),
  `host:houses` (`{ [seatId]: { g, c, v } }` for the houses the host decides), `host:bots` (bots' bodies and aim at 10 Hz, the
  same fields as presence), `host:special` (`{ id, kind, x, z, at, holder }`). Grabbing a special is a `host.claim('grab')`,
  settled by the room's clock when two neighbours reach it together.
- **Handover:** when a player goes away, the host takes their house from their last presence mask. When they come back, their
  page takes whichever mask has the higher version.
- **Eliminations:** the host reads every mask each tick; a house at 0 glass is out at that match time (`data.out`), final. The
  host ends the round with the ranking when at most one house has glass; `roundSeconds` ends it at 3:00.
- **Every page checks every throw:** the thrower is a seat in the match (bots only from the host), the kind is allowed (a
  special only from its holder, a pebble only from a ghost), the speed is inside that kind's range (+5%), the origin is inside
  the thrower's lawn (or the ghost zone) at hand height, `t` is within 1.5 s before now, and a token bucket per thrower (6, one
  per 0.75 s) holds. Anything else is dropped. Presence and host state are checked for shape and ranges; names are drawn as
  text only.
- **Cheating:** a player could make their own house unbreakable on their own page. Rewards are badges and leaderboards for fun;
  that is the trade the platform asks games to make, and it buys the defender a fair-feeling house.

## Bots

Bots run on the host's page with a brain from a pure module (`bots.js`), the same for the title's attract mode and the
trailer's autoplay. A bot sees what a player sees: houses' masks, stones in the air, the windsock.

- **Reaction:** 0.6 s (skill 0) to 0.25 s (skill 1) before reacting to anything new.
- **Aim:** solves the arc to a chosen pane with glass (a line drive or, when the oak is in the way or the target is far, a lob),
  then adds wind compensation x skill, aim error (yaw and pitch spread (1 - skill) x 2.5°) and power error ((1 - skill) x 6%).
  Wind-up takes 0.4-0.9 s like a person's.
- **Targets** by personality (below). No bot aims at a house that's out; every bot has a 20% chance per throw of picking
  another target, so piles-on break up.
- **Repair:** when its glass is below its personality's threshold, no stone is coming, and the store is open.
- **Intercepts:** above skill 0.5, a bot that sees a stone aimed at its house tries to knock it down, with a chance of
  (skill - 0.3).
- **Moves:** wanders its lawn, sidesteps stones aimed at its body (above skill 0.4), grabs a special that lands next to it.
- **Never perfect:** even at skill 0.95 the aim error and the wind misread keep a long lob's hit rate under 60%.

| Neighbour | Looks | Plays |
|---|---|---|
| Walt | Retiree, cardigan, flat cap, moustache | Slow, steady lobs. Holds a grudge: throws at whoever broke his glass last. Repairs early (below 17). |
| The Twins | Two kids in striped tees on one lawn | Quick low-power throws at the nearest house, two at a time. Repair late (below 8). Dodge a lot. |
| Chad | Tank top, headband | Full-power line drives, wild spread (-0.2 accuracy). Throws at the leader. Never repairs. |
| Mrs. Lindqvist | Sun hat, cat-eye glasses, a telescope on her lawn | Slow and precise (+0.15 accuracy), reads the wind, picks off single panes, intercepts. |
| Rosa | Gardener: straw hat, apron | Defensive. Repairs below 18, intercepts, throws back at whoever is hitting her. |
| Sunny | Teen on roller skates, visor | Never stops moving. Bonks repairers. Grabs every special. |
| Ray | BBQ apron, a smoking grill on his lawn | Easy-going pace. Throws at the weakest house to finish it. |
| Bev | Curlers, pink robe, coffee mug | Bursts of three throws, then a sip. Revenge first, then the leader. |

Each street has a lineup of five (Palm Court: Walt, Ray, Rosa, Bev, the Twins; Mesa Drive: Lindqvist, Chad, Sunny, Rosa, Bev).

## Progression and reasons to come back

- **Stars** on the ladder (24), saved in `ow.save` (`profile`: `{ stars: [8], panes, roundsWon, matchesWon, intercepts,
  firstRound, hints }`), written on events (a round's end, a badge), never per frame.
- **Personal bests** on the title (stars x/24, rounds won) and on the results (your panes broken this match against your best).
- **Leaderboards:** `rounds-won` (total round wins), `panes` (total panes broken), `stars` (ladder stars).
- **Badges** (10):

| id | Name | Earned |
|---|---|---|
| `first-stone` | First Stone | Break your first pane |
| `shattered` | Shattered | Break 50 panes |
| `last-house-standing` | Last House Standing | Win a round |
| `glass-half-full` | Glass Half Full | Win a round with 10 or more panes left |
| `not-a-scratch` | Not a Scratch | Win a round without losing a pane |
| `interception` | Interception | Knock a stone out of the air |
| `gnome-run` | Gnome Run | Break 2 panes with one gnome |
| `fore` | Fore! | Bonk a neighbour |
| `house-proud` | House Proud | Win a match |
| `the-whole-street` | The Whole Street | Win a round on all eight streets |

## Balance and timing

| Number | Value |
|---|---|
| Facade distance from centre (Palm Court) | 22 m; lawn box 9 x 4 m, its middle 18 m from centre |
| Distances to other houses | next door ~20 m, across ~35 m, opposite ~40 m (behind the oak) |
| Oak | trunk 0.7 m radius; canopy 4.5 m radius centred at 6.5 m high; fountain basin 3.5 m radius, 0.7 m high |
| Throw speed | 14-30 m/s over 0.9 s wind-up; brick 12-22; pebble 7-15 |
| Release point | 1.6 m eye height, hand 0.35 m right and 0.15 m below the eye |
| Gravity / wind | 9.8 m/s² / 0-3 m/s² by street, x0.3 in round 1, x1.6 after 2:00 |
| Stone radius / intercept radius | 0.12 m / 0.45 m combined |
| Panes | 20 per house, 1.2 x 2.0 m |
| Ammo | 5 in the pile, one back every 0.8 s |
| Repair | 1.5 s per pane; store closes at 2:00 |
| Bonk | 1.0 s stun, then 0.5 s immune; player hitbox a 0.35 m capsule, 1.8 m tall |
| Strafe | 4.0 m/s |
| Specials | first at 0:25, then every 25-35 s, none after 2:30, 15 s to grab |
| Ghost pebbles | 3 in hand, one back every 2.5 s; 2 pebbles break a pane |
| Round | 3:00 at most; 6 s result; 3 s intro before rounds 2+ |
| Match | 1 / 3 / 5 rounds, 3-2-1 points; results 20 s (the host can skip) |

**Targets the simulations must hit** (node tests, 6 bots, mixed personalities, 300 seeds per street; numbers above are tuned
until they hold, and this table is updated with the final values):
- Median round 2:00-2:30 on Palm Court; at most 25% of rounds reach 3:00; every round ends by 3:00.
- First house out: median after 0:45; never before 0:20.
- Winner's glass at the end: median 4-10 panes (close finishes).
- No seat wins more than 1.25x its share on the ring streets; on Narrow Lane, Cliff Top and Hillside no seat more than 1.5x.
- Ghost pebbles cause at most 15% of all breaks.
- A skill 0.3 bot beats skill 0.9 bots sometimes (at least 5% of rounds), and skill-0.9 bots beat skill-0.3 bots most of
  the time (the ladder ramps).
- A scripted beginner (one stone every 2 s, 50% of throws on the facade, no wind reading, repairs below 8) wins at least 15%
  of rounds on Palm Court against its lineup.
- A full match plays to the end for 200 seeds on every street: no NaN, no exceptions, no stone outside the world.

## Every screen

All big words and numbers are **house numerals**: cream or ink letters on enamel plates in the owner's colour, with a hard
offset shadow as if mounted on a wall in a low sun. No dark boxes behind HUD items, no glassy panels.

1. **Title.** The 3D attract round fills the screen (a crane shot that orbits the green, cutting to a close shot when a house
   falls). "Glass Houses" in two lines of big mounted letters, left of centre. Below the centre, one tall **Play** door in
   tangerine with a brass knob and "Play" on it (Space or Enter on desktop). A small brass plate under it: your stars ("12 / 24")
   once you have any. The platform's menu stays in its corner.
2. **Lobby.** The street from above at golden hour. On each lawn, a real-estate sign: avatar headshot and name for a player
   (sign reads SOLD), a drawn portrait and name for a bot neighbour. Your lawn has a big arrow and your colour. A player who is
   ready has their porch light on and a check on the sign. Top centre: the **Street plate** (a green street-name blade:
   "Palm Court", with arrows for the host, and its stars) and the **Rounds plates** (1, 3, 5). Alone, the blade becomes the
   ladder: eight blades in a row, padlocks on the locked ones. One "Invite" plate on the first bot's sign
   (`ow.ui.showInvite()`). After a match, the standings board stays at the right until the next match starts. The bottom
   88 px (the platform's Ready strip) stays clear.
3. **Countdown and round intro.** Big numerals 3, 2, 1 drop onto your mailbox wall with a clack each; before rounds 2+, a
   "Round 2" plate and the street's name on a blade.
4. **Play HUD** (first person):
   - Top centre: the five other houses as plates in the order they stand around you (left to right), each in its colour with
     its symbol and its number. The leader's plate wears a small gold sunburst. An out house's plate turns ink with a 0.
   - Above the strip, centred: the **sunburst clock**, a mid-century starburst with the time left ("2:14") in its face and a
     tick at the 2:00 store-closing mark. A wind arrow (turned to your view, 0-3 chevrons) sits under it.
   - Bottom centre: **your plate**, the biggest number on screen, your symbol beside it, and your five stones in a row under it
     (the special in hand replaces the first stone). Repair progress fills your plate from the bottom.
   - Centre: a small dot reticle; while winding up, the dotted arc and its landing ring/cross.
   - Hints: 2-5 words in mounted letters, low centre, then gone.
   - The edge arrow pointing at whoever just broke your glass, for 1.5 s.
   - Esc key hint, small, top right, while the mouse is locked; "Click" when a lock was refused.
   - On phones, everything moves around `ow.ui.reserved` (stick, buttons, menu): the strip and clock go below the menu's row
     in portrait, your plate sits above the buttons' row.
5. **Out.** The camera lifts from your lawn as your house goes dark, then you're a ghost over the green. "Your house is out",
   then "Pebbles crack glass". Your plate becomes a ghost outline.
6. **Round end** (6 s). Cut to a third-person shot pushing in on the last house standing, glass glittering, its owner cheering
   on the lawn, shards still settling everywhere else. A plate: "Walt's house stands". The round's points fly from the houses
   to the standings plates (+3, +2, +1).
7. **Results** (20 s; the host can skip). The winner's lawn: the top three on concrete planter podiums, glitter of glass
   falling. Left: the standings as house plates (place numeral, avatar, name, points, panes broken). Alone: the street's stars
   stamped in, "New best" where earned, the next street's blade lighting up. Then the lobby.
8. **Watching** (latecomer): ghost view over the green, "Watching" by the platform at the top centre; our label low centre:
   "Next round" (or "Next match").
9. **Esc card:** Resume (and, for a private server's host, Pause). Solid plate in the street's colours, one column of large
   buttons.
10. **Room closed:** one message and one button (above).

## Art direction

**The world:** a mid-century desert-modern cul-de-sac at golden hour, made of white steel frames, tinted glass, flagstone,
breeze block, poured concrete, lawn, gravel, palms and pool water, under a low gold sun with long shadows. Clean low-poly
geometry with good lighting, never toy-like.

**Palette:**

| Role | Colour | Hex |
|---|---|---|
| Ground / lawn | Olive lawn | `#6F8F3A` |
| Light / text | Stucco cream | `#F3E9D8` |
| Ink / shadows / outlines | Dusk ink | `#2A2238` |
| Accent / sun | Sun gold | `#FFB547` |
| Good / glass / repair | Pool turquoise | `#2BB7B3` |
| Bad / out / incoming | Terracotta | `#C8553D` |
| Haze / sky low | Desert peach | `#F4C89A` |

Owner colours with symbols (shape for colour-blind players): tangerine `#F08A24` starburst, mustard `#E5B83B` boomerang,
turquoise `#2BB7B3` ring, coral `#E8645A` diamond, cobalt `#3563B8` triangle, plum `#8A4F9E` square.

**Fonts:** Josefin Sans 700 (display: the title, the house numerals, plates) and Jost 500/700 (labels, names). Self-hosted with
`@fontsource`, latin subset, only those weights. Sentence case; no letter-spaced capitals except the hardware store's neon.

**The signature: the house numbers.** Every house's pane count is its house number, in big mid-century numerals on its
breeze-block mailbox wall. The same numerals, on the same enamel plates with the same low-sun shadow, are every number in the
game: the HUD strip, your plate, the clock, the countdown, the places on the results.

**Glass that reads as glass:** `MeshStandardMaterial` panes (one InstancedMesh for all 120) with a slight aqua tint, near-zero
roughness and an environment map baked once per street (PMREM of a procedural sky with the sun), so whole panes flash gold
when the sun hits them. A broken pane is an empty frame with jagged teeth left in it (a second InstancedMesh). A cracked pane
gets a star-crack decal. At 40 m, whole and broken read apart by shape and by glint.

**Shattering is the star:** each break throws 25-40 triangular shards (one InstancedMesh, cap 600 on high, 300 medium, 150 low)
with simple physics: gravity, spin, a bounce off the floor or plinth, then they settle and stay, glinting, until the round
ends (oldest recycled). By the end of a round every house sits in a glittering pile. A burst of glints on the hit, a puff of
dust on the plinth.

**Light and camera:** a low warm sun (`#FFC07A`, 12° high) with soft shadows (a tight shadow camera over the street; map size
by `ow.settings.quality`: none, 1024, 2048), a hemisphere light (peach sky, olive bounce), sRGB output, ACES tone mapping,
peach distance fog, the sun sinking a few degrees over the round. First person at 1.6 m, FOV 70° vertical (wider in portrait so
the horizontal view stays above 65°). Camera shake from a trauma value (`shake = trauma²`, smooth noise) on bonks, nearby
shatters and your house falling; none with reduced motion. Bloom only on high quality for sun glints and porch lights, if it
earns its cost.

**Players and bots:** stylised low-poly people (rounded, not blobby) in their house colour, with the symbol on the shirt, a
name label above them (white with a dark outline). Players' faces are their avatar headshots on the lobby signs and the results;
bots are the eight neighbours above, each with a prop. Your first-person arm has a sleeve in your colour and holds the stone,
brick or gnome; it pulls back as you wind up and snaps forward on release.

**HUD in the world's language:** enamel house-number plates, a starburst clock, real stones for ammo, street-name blades for
streets, real-estate signs in the lobby, the hardware store's neon for the 2:00 mark.

**Not this:** glassy cards (the glass is in the world, never the UI), gradients and glows, pill chips, emoji, "BOT" or "YOU"
pills, a dimmed title card, purple and teal neon.

## Sound

All synthesized with Web Audio; distance attenuates and low-passes far sounds.

| Action | Sound |
|---|---|
| Wind-up | A soft rising creak (filtered noise) that tightens with power |
| Throw | A "fwip" whoosh, pitched by power |
| Stone passing near you | A doppler whoosh by your head; stones aimed at you add a rising whistle |
| Pane breaks | A noise burst (band-passed high) + 3-5 resonant pings + a tinkle tail as shards land; a big pane, a far pane and your own (louder, with a low thud) differ |
| Pebble crack | A sharp tick with a short glassy ring |
| Clunk | A dull knock off steel, stone or wood |
| Intercept | Two hard wood-block clacks and a spark crackle |
| Bonk | A cartoon "bonk" (pitch drop 600 to 200 Hz) and a faint ring in the ears |
| Repair | A glazier's squeegee squeak while working, a bright ting per pane |
| Grab a special | Brick: a heavy thunk. Gnome: a squeak |
| Gnome in flight | A gliding "wheee" whistle |
| Store closes | Shop bell, door shut, neon buzz off; the wind rises |
| A house falls | A cascade of shatters and a descending vibraphone motif |
| Round win / match win | Vibraphone and muted brass stabs; a longer fanfare for the match |
| UI | Plate clicks; the porch-light switch for Ready |
| Ambience | Wind (by strength), the fountain, golden-hour birds (crickets at night, muffled hush in snow) |

**Music:** a cool lounge-jazz loop from a small sequencer: walking upright bass (a plucked triangle), brushed snare and ride
(filtered noise), vibraphone chords with tremolo, a ii-V-I in D minor at 112 BPM. Quieter in menus (bass and vibes only). It
gets frantic as houses fall: 3 houses left adds bongos and fills, 2 left raises the tempo to 128, and after the store closes
the vibes play a tense two-chord vamp.

## Store art and the trailer

- **Cover** (`cover`, thumb-1): first person on your lawn at golden hour, arm back with a stone, the dotted arc across the green
  to a house that's bursting into shards mid-frame, house numbers readable, "Glass Houses" once, big.
- **Action** (`action`, thumb-2): a pane mid-shatter in close-up, the stone just through, shards fanning out against the sun.
  No text.
- **Win** (`win`, thumb-3): the last house standing, every pane gold in the sunset, the other houses dark among glittering
  piles, its owner cheering on the lawn.
- **Multi** (`multi`, thumb-4): high over the cul-de-sac, stones in the air from four lawns, a gnome mid-flight, a ghost over
  the green.
- **Icon**: one pane with a stone punching through it in a star of cracks, on a gold sunset disc. No text.
- **Badges**: a bold symbol for each on a coloured disc (a stone, shards, a house, half a glass, a clean pane, two clacking
  stones, a gnome, a bonk star, a key, a street blade).
- **Trailer** (25-30 s, real play with `?autoplay=1&debug`, only when `ow.mode` isn't production): 0-3 s a first-person throw,
  the arc, a house bursting and its number ticking (the goal); 3-8 s quick cuts of shatters around the street, numbers falling;
  8-12 s an intercept clack in mid-air; 12-17 s a brick takes three, a gnome ricochets; 17-20 s a bonk, then the store's neon
  flips to CLOSED; 20-27 s the final duel, the last pane breaks, the winner's house glitters; last 2 s "Glass Houses" over the
  attract shot.

## Originality check

It resembles artillery games (arcs and wind, as in Worms or Gunbound), snowball-fight games and dodgeball. What a player
notices in the first minute that's different: your health is a real house of glass behind you, every hit is a pane you watch
burst, and every house's health is its house number, readable across the street. You choose between throwing and re-glazing
while the hardware store's clock runs down, you can knock stones out of the air, and a knocked-out neighbour keeps haunting the
street with pebbles. It is first person, in a sunlit mid-century street, not a 2D side view.

## Where this changes the spec, and why

- **Repair anywhere on your lawn**, not at the door: in first person the door is behind you, and turning your back to the green
  to repair would hide everything. Standing still and not throwing is the cost.
- **A match is 1, 3 or 5 rounds with 3-2-1 points**, not "best of": with six players, "best of 3" has no clear end.
- **Ghost pebbles crack** (two make a break) instead of an unclear "half power", and stones can poof a ghost, so ghosts matter
  without deciding the final duel.
- **Specials land between two lawns**, so neighbours race for them, instead of near one house (a gift by luck).
- **Brick and gnome rules** made exact: the brick breaks 3 in a row, the gnome breaks 2 by ricocheting along the facade.
- **The arc shows the path without wind**: aiming is easy, the wind is the skill.
- **Streets as layouts that all face one centre**, so every lawn can reach every house; Narrow Lane is two curved rows.
- **Ladder stars** are for your best round win on a street (1, 8+ or 15+ panes left), and one star unlocks the next street.

## Risks and how they're handled

| Risk | Handling |
|---|---|
| First-person aiming at 35-40 m is too hard for a newcomer | The full no-wind arc, a big facade (13 x 4 m), calm wind in round 1, bots holding off a first-timer's house; sims check a beginner script wins its share |
| Three players gang up and someone is out in 30 s | Bots spread targets (20% switch, no piling on a first-timer), the last panes are hard to hit, repair; sims check the first-out time |
| Late messages make pages disagree | Deterministic stones on the match clock, one page decides each house, a 400 ms correction window, predicted breaks put back if not confirmed |
| A host reload or change mid-round | Everything the host decides is in host state; bots, specials and away houses resume from it; tested through a fake room |
| Phone performance (glass, shards, shadows) | Instanced panes, shards and stones; static geometry merged per material (under 120 draw calls); env map baked once; no transmission; shadows and shard caps by quality; pause on hidden |
| iOS Safari | WebGL2 with a WebGL1-safe material set, audio started by the Play tap, every optional API guarded, no per-frame allocations |
| Glass not reading as glass from far away | Glints from the baked sky, frames and broken teeth that differ in shape, the house number as the truth |
| Pointer lock refusals | The guide's rules: lock from a click in the world, Esc card with Resume, "Click" hint on a refusal, drag to look when locks keep failing |
| Too many rules | Every rule above shows itself in play (a cracked pane looks cracked, a closed store says CLOSED, a brick breaks three); hints teach only throw, repair and specials |

## How it's built

Vite + three.js (+ GSAP for UI tweens, `@fontsource/josefin-sans`, `@fontsource/jost`), `"dir": "dist"`, `base: './'`.

- Pure modules (no page, no three.js at import; tested in node): `config.js` (every number), `rng.js`, `streets.js` (the eight
  layouts), `physics.js` (stone paths, wind, intercepts, facade and body hits), `rules.js` (panes, specials, repair, store,
  eliminations, ranking), `bots.js` (brains), `sim.js` (a headless round: the attract mode, autoplay and balance tests),
  `net.js` (throw validation, authority, masks), `progress.js` (stars, unlocks, badges).
- Page modules: `main.js` (join first, poster mode, the frame loop), `world.js` (the street), `glass.js` (panes, cracks,
  shards), `people.js` (figures, the first-person arm), `hud.js`, `screens.js` (title, lobby, results), `input.js`,
  `audio.js`, `music.js`, `poster.js`.
- Tests: `test/*.test.mjs` with `node --test`: rules and scoring, physics, bots (legal, beatable, not useless), balance
  simulations, 200-seed full matches per street, throw validation and the room flow through a fake room (host reload, a
  leaver, a latecomer).

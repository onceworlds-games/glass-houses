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
- Pointer lock is asked for only from a click in the game. When it is refused (or on a browser without it), dragging with the
  mouse aims instead, and a small "Click" plate sits top right until a lock holds.
- `controls` in onceworlds.json (9 lines): Mouse "Aim"; Hold click or Space "Wind up, let go to throw"; W A S D "Move on your
  lawn"; Hold R "Repair your glass"; Esc "Free the mouse"; and the touch versions: Drag "Aim", Hold Throw, Stick "Move", Hold
  Repair.

## The first minute

What it resembles: an artillery game (arcs and wind) played in first person, from your own lawn. What is its own: your health is
the glass house behind you, every house's health is its house number, and you choose between throwing and re-glazing.

| Time | Screen | Words |
|---|---|---|
| 0 s | **Title.** The street alive: a slow crane shot round the green while six bot neighbours play a real round; when a house falls the camera cuts to it. "Glass Houses" in two lines of big mounted letters top left, one tangerine **Play** door with a brass knob bottom centre. The platform's Ready strip is hidden here (`room.hideLobby(true)`). | none |
| ~2 s | Play (click, tap, Space or Enter) starts the sound. **The lobby:** the camera sits behind and above your house, looking over your lawn at the green. Every lawn has a real-estate sign with a name (yours with a big arrow and your colour). At the top: the street plate (alone: the ladder of eight street blades, padlocks on the locked ones) and the Rounds plates (1, 3, 5). | none |
| ~4 s | The platform's Ready bar at the bottom. One tap. With others: everyone readies (public), or the host starts (private). If a match starts while you're still on the title, the game leaves the title by itself. | the platform's "Ready" |
| ~5 s | **Our own 3-2-1** (`ownCountdown: true`): big numerals drop with a clack each while the camera comes down from above onto your lawn. | "3", "2", "1" |
| 8 s | **Round 1.** First person, a stone in your hand, the green ahead, a number plate over every house. | "Break their glass" (your first 3 rounds) |
| 10 s | Hold: the dotted arc grows from your hand and lands on what you aim at (a cross on a wall, a ring on the ground). | "Hold to wind up" (touch: "Hold Throw") until the first hold; then "Let go to throw", once |
| 11 s | First throw: whoosh, the stone arcs, a pane bursts, the number over that house flips 20 to 19. | none |
| ~16 s | A stone whooshes past your head (alone on the first two streets until you have a star there, bots leave your house alone for the first 6 s). | none |
| ~20 s | A crash behind you: a white flash at the screen's edge, your plate drops 20 to 19, an arrow at the edge points at who threw it. | "Keep yours" (once) |
| ~30 s | Your glass at 17 while the store is open. | "Hold R to repair" (touch: "Hold Repair"), once |
| ~25-35 s | A brick or a gnome drops onto the line between two lawns. | "Grab it!" (once); "Brick: breaks 3" / "Gnome: breaks 2" when you pick one up |
| 40-60 s | Panes burst all round the green; the first house falls into a cascade of shards and goes dark. | none |

Gentle on purpose: round 1 of every match has the wind at 30%. Alone on Palm Court or Sunset Loop without a star there, no bot
throws at your house for the first 6 s, then at most one bot at a time until 0:30, then 40% as much as at anyone else.

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
  facade is re-glazed in 2.5 s, then the next one. Moving, throwing or a bonk stops it. A glazier's squeak while it works, a
  ting when a pane is done; your plate counts up.
- **At 1:30 the hardware store closes**: its neon flips from OPEN to CLOSED with a shop bell, repairs end for everyone, and the
  wind picks up (x1.6). The second half of every round is a straight fight.
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
- When the round ends the ghosts go home, so nothing floats between the camera and the winner's house.

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
| Defence | Repairs when nearly dead and gets bonked doing it | Repairs in quiet moments, before 1:30, at the edge of the lawn where fewer lines reach; strafes when a stone is coming |
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
| 3 | Little Loop | A tight ring of 16 m with a planter in the middle: every house is close, nothing to hide behind | 0-1.0 | Bright afternoon | 0.35-0.55 |
| 4 | Cliff Top | Horseshoe on 240° of arc, the open side a cliff over the sea; gusts | 0.5-3.0 | Hazy gold | 0.40-0.60 |
| 5 | Hillside | A ring on a slope: the houses stand 0, 1.5, 3.5, 4.5, 3.5 and 1.5 m up; height helps | 0-1.5 | Golden hour | 0.50-0.70 |
| 6 | Porch Lights | Ring of 22 m at night: lit interiors, porch lights, glowing stone trails | 0-1.5 | Night | 0.55-0.75 |
| 7 | Snow Day | Ring of 22 m, snow falling, icy lawns (you slide), a frozen fountain | 0.5-2.0 | Overcast white | 0.60-0.80 |
| 8 | Mesa Drive | Ring of 26 m on a mesa top, specials more often | 0.5-3.0 | Dusk | 0.75-0.95 |

The wind blows from a direction that turns slowly (a full turn over 3-5 minutes) with gusts: smooth noise from the round's
seed on the match clock, the same on every page.

**Everyone moves one house along each round** of a match, so nobody keeps the best spot (on Hillside, the top terrace).

## Solo

A player alone is the host of their own server: they pick the street, ready up, and play a full match against **five bot
neighbours** of that street. Nothing is separate: it is the same lobby, the same match.

- **The Street Ladder.** Alone in the lobby, the Street plate becomes the ladder: eight green street-name blades in a row, the
  locked ones padlocked. Each street has three stars for **your best round win there**: 1 star for a win, 2 for a win with 8 or
  more panes left, 3 for a win with 15 or more. One star on a street unlocks the next.
- After a solo match, the lobby comes back with the next unlocked street already picked: one tap on Ready is the next go.
- How long it lasts: a round is 2-3 minutes; eight streets with harder neighbours and new conditions take 1-2 hours to clear
  and much longer to three-star (24 stars). Stars won on any street count, in a public server too.
- Esc frees the mouse and shows a small card (Resume). The platform lets a private server's host or a solo server pause a
  match, so there the card also has Pause (`room.pauseMatch()`), and hiding the tab pauses the round when nobody else is
  playing; a round in a public server keeps running (it is 3 minutes at most).

## Multiplayer

- **A public game**, up to 6 per street: `ow.rooms.join({ maxPlayers: 6, minPlayers: 1, lobby: 'bar', ownCountdown: true,
  settings: [{ id: 'street', label: 'Street', options: 1-8 with names, default: 1 }, { id: 'rounds', label: 'Rounds', options:
  [1, 3, 5], default: 3 }] })`. Friends get private servers and invites from the platform.
- **Lobby:** drawn by the game (the street from above your house, signs on the lawns), with the platform's Ready bar
  (`lobby: 'bar'`). Public: everyone
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
  marked "back soon" on its plate) and the host decides its glass. A reload is back within 15 s and carries on from presence.
- **Host change:** the match record, the houses the host decides, the bots and the special are all in host state, so the next
  host carries on (`resume`).
- **Room closes:** 'kicked' "You were removed" and Play, 'disconnected' Rejoin, 'replaced' "Playing in another tab" and Play
  here; each button calls `rooms.join` again with the same options.

### Netcode

The idea: **every page runs the same deterministic stone simulation; each house's glass is decided by one page.**

- **Throws are messages:** `room.send({ k: 'throw', id, by, kind, r, o, v, tk })`: the round, the release point in mm, the
  velocity in mm/s and the round tick it left the hand. Bots' throws come from the host. About 1-2 messages a second per player.
- **Every page simulates every stone** in fixed steps of 1/120 s on the match clock, with the wind as a function of the round's
  seed and the time. A throw that arrives late (up to 1.5 s) is replayed from its tick, and checked against the stones that
  were in the air in the last 0.5 s: if it knocked one down, what that stone did afterwards is undone.
- **Who decides what** (`net.js` `decider`, `sync.js`):
  - Your own glass and your own body: **your page**, published in your presence (20 times a second).
  - Bots' houses and bodies, and the houses of players who are away or gone: **the host**, in host state (houses by seat id
    under the round's key; bodies 10 times a second).
  - The round's end, places and points, the specials, the tie-break tally: **the host** (`createMatch`, host state). Grabbing a
    special is a claim the room's clock settles when two neighbours reach it together.
- **Other pages predict:** a stone that hits a pane bursts it at once everywhere; the deciding page's mask (versioned) is the
  truth, and a predicted break it doesn't have is put back.
- **Handover:** when a player goes away the host takes their house from their last mask; when they come back their page keeps
  whichever word has the higher version.
- **Every page checks everything it reads** (`net.js`): a throw's thrower is a seat in the match (bots only from the host, a
  player only for themselves), the kind is allowed (a special only from its holder, pebbles only from a ghost), the speed is in
  range, the origin is on the thrower's lawn (or in the ghost zone), the tick is at most 1.5 s old and 0.4 s ahead, and a token
  bucket per thrower (7, one more every 0.7 s) holds. Presence and host state are checked for shape and range; names are
  drawn as text only.
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
| Gravity / wind | 9.8 m/s² / 0-3 m/s² by street, x0.3 in round 1, x1.6 after 1:30 |
| Stone radius / intercept radius | 0.12 m / 0.45 m combined |
| Panes | 20 per house, 1.2 x 2.0 m |
| Ammo | 5 in the pile, one back every 0.8 s |
| Repair | 2.5 s per pane; store closes at 1:30 |
| Bonk | 1.0 s stun, then 0.5 s immune; player hitbox a 0.35 m capsule, 1.8 m tall |
| Strafe | 4.0 m/s |
| Specials | first at 0:25, then every 25-35 s, none after 2:30, 15 s to grab |
| Ghost pebbles | 3 in hand, one back every 2.5 s; 2 pebbles break a pane |
| Round | 3:00 at most; 6 s result; 3 s intro before rounds 2+ |
| Match | 1 / 3 / 5 rounds, 3-2-1 points; results 20 s (the host can skip) |

**What the simulations check** (`test/balance.test.mjs` and `test/bots.test.mjs`, six bots of the street's lineup and skill,
24-40 seeds per check; the numbers above were tuned until these held):
- Median round between 1:40 and 2:45 on every street; at most 25% of rounds reach 3:00; every round ends by 3:00.
- First house out: median 0:40 or later, never before 0:20.
- No runaway seat: over 24 rounds (houses rotating as in a match) no neighbour wins more than 11 and no house more than 9
  (Hillside's top terrace: 12).
- Ghost pebbles cause at most 15% of all breaks.
- One skill-0.3 neighbour against five at 0.9 wins sometimes (at least 1 in 40) but under a sixth of rounds.
- A scripted beginner (slow throws, half of them on the facade, no wind reading, late repairs), new to Palm Court, wins at
  least 15% of rounds against its lineup.
- A three-round match plays through on every street, and 40 more seeds over all streets end cleanly: no NaN, nobody
  outside the world.

## Every screen

All big words and numbers are **house numerals**: cream or ink letters on enamel plates in the owner's colour, with a hard
offset shadow as if mounted on a wall in a low sun. No dark boxes behind HUD items, no glassy panels.

1. **Title.** The 3D attract round fills the screen (a crane shot that orbits the green, cutting to a close shot when a house
   falls). "Glass Houses" in two lines of big mounted letters, top left. Bottom centre, one tall **Play** door in tangerine
   with a brass knob (Space or Enter on desktop). A small brass plate under it: your stars ("12 / 24") once you have any. The
   platform's Ready strip is hidden on the title.
2. **Lobby.** Behind and above your house, looking across the green (higher and further back in portrait). On each lawn, a
   real-estate sign on a post: the owner's symbol and name (a person or a bot neighbour), a key for the host, a check when
   ready; yours has a big arrow in your colour. Top centre: the **street** (alone: the ladder, eight green street-name blades
   with stars and padlocks; with others: the host picks from their unlocked streets) and the **Rounds** plates (1, 3, 5).
   After a match, the standings board sits at the right until the next match starts. The bottom stays clear for the
   platform's Ready bar.
3. **Countdown and round intro.** Big numerals 3, 2, 1 drop in with a clack each while the camera comes down to your lawn;
   before every round, a "Round 2" plate and the street's name on a blade.
4. **Play HUD** (first person):
   - **A number plate over every house**, in its owner's colour with its symbol, its number and the owner's name, pinned above
     the roof. A house off screen keeps its plate pinned to the nearest side edge (stacked), so every number is always
     readable, on a phone too. The leader's plate (only when one house leads alone) wears a gold sunburst; a hit makes a plate
     thump; an out house's plate turns ink with a 0.
   - Top centre: the **sunburst clock**, a mid-century starburst with the time left ("2:14") in its face, the round's progress
     round the rim and a terracotta tick at the 1:30 store-closing mark. The **wind arrow** (turned to your view, longer when
     stronger) sits under it.
   - Bottom centre: **your plate**, the biggest number on screen, your symbol beside it, your five stones in a row under it (the
     special in hand replaces the first stone; a ghost's three pebbles instead). Repair progress fills your plate from the
     bottom.
   - Centre: a small dot reticle; while winding up, the dotted arc and its landing ring or cross.
   - Hints: 2-5 words in mounted letters, low centre, once each.
   - The edge arrow pointing at whoever just broke your glass, for 1.5 s, and a white flash at the edges.
   - Esc key hint, small, top right, while the mouse is locked; "Click" when it isn't.
   - On phones everything moves around `ow.ui.reserved` (the platform's menu, stick and buttons).
5. **Out.** Your house goes dark, "Your house is out", then you're a ghost over the green; "Pebbles crack glass" once. Your
   plate becomes a ghost outline with pebbles.
6. **Round end** (6 s). A third-person shot pushing in on the last house standing, shards settling everywhere else. A plate:
   "Your house stands", "Walt's house stands" or "A tie".
7. **Results** (20 s). The winner's house; "You win" or "Rosa wins"; the standings board (place, symbol, name, panes broken,
   points). Alone: the stars you won are kept, and the next street is picked for you in the lobby.
8. **Watching** (latecomer): a ghost's view over the green; "Next round" (or "Next match" when every house has a person).
9. **Esc card:** Resume (and Pause for a private server's host or a player alone). Solid plate in the street's colours, one
   column of large buttons.
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

**Glass that reads as glass:** the 120 panes are one InstancedMesh with a drawn pane texture: a cool tint darker at the foot,
two bright diagonal streaks and a lit top and left edge, more opaque where it shines. On top, a reflective standard material
and an environment map baked once per street (PMREM of the sky with its sun), so panes also flash gold at the right angle.
The blending adds what the glass reflects and dims what is behind it, so the lit room behind reads through. It reads on low
quality too: the streaks are in the texture, not in the lighting. A broken pane is an empty frame with jagged teeth left in
it (three tooth shapes, instanced); a cracked pane gets a star-crack decal.

**Shattering is the star:** each break throws 24-38 triangular shards (one InstancedMesh)
with simple physics: gravity, spin, a bounce off the floor or plinth, then they settle and stay, glinting, until the round
ends (oldest recycled; 700 on high, 360 medium, 160 low). By the end of a round every house sits in a glittering pile. A burst of glints on the hit, a puff of
dust on the plinth.

**Light and camera:** a low warm sun (`#FFC07A`, 12° high) with soft shadows (a tight shadow camera over the street; map size
by `ow.settings.quality`: none, 1024, 2048), a hemisphere light (peach sky, olive bounce), sRGB output, ACES tone mapping,
peach distance fog blended into the sky, distant mesas in the haze. First person at 1.6 m, FOV 66° vertical (in portrait,
wide enough for a 78° horizontal view). Camera shake from a trauma value (`shake = trauma²`, smooth noise) on bonks, nearby
shatters and your house falling; none with reduced motion. No bloom. A computer drawing without a graphics chip (a software
renderer) gets low quality and pixel ratio 1 whatever the setting says.

**Players and bots:** stylised low-poly people in their house colour; the bot neighbours dressed as above (Walt's flat cap,
Ray's and Rosa's aprons, Bev's pink robe, Sunny's skates and visor, Lindqvist's sun hat, Chad's headband and bare arms, the
Twins as two kids). Names live on the house plates and lawn signs, not over heads. Your first-person arm has a sleeve in your
colour and holds the stone, brick or gnome; it pulls back as you wind up and snaps forward on release.

**HUD in the world's language:** enamel house-number plates, a starburst clock, real stones for ammo, street-name blades for
streets, real-estate signs in the lobby, the hardware store's neon for the 1:30 mark.

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

Every picture is drawn by the game's own renderer from a real round frozen at its moment (`?poster=<name>`, `poster.js`):
- **Cover** (`cover`, thumb-1): from the green at golden hour, side-on to a throw: a neighbour winding up on their lawn, the
  dotted arc soaring over the green onto the next house's glass front, a pane there bursting. "Glass Houses" once, big, over
  the sky.
- **Action** (`action`, thumb-2): a glass front close up, one pane exploding out toward you and another already gone, the next
  stone a stride from the glass. No text.
- **Win** (`win`, thumb-3): the last house standing at sunset, its glass lit, the others out.
- **Multi** (`multi`, thumb-4): Porch Lights at night from under the oak: two neighbours trading stones across their lawns,
  trails glowing, both fronts bursting.
- **Icon**: a whole glass front at golden hour with two panes bursting and a stone flying at it from just past the lens. No
  text.
- **Badges**: a bold symbol for each on a coloured disc (a stone, a cracked pane, a house, a half-full pane, a clean pane with
  sparkles, two clacking stones, a gnome, a head with stars, a sunburst with a check, eight panes round a lawn).
- **Trailer** (`store/trailer.mp4`, 21 s, 1280×720, the game's own sound and music): six shots of real autoplay rounds, hard
  cuts. 0-1 s riding behind a stone into a neighbour's glass front, its number dropping 16, 15, 14 (the goal); 1-6 s first
  person on Palm Court, stone in hand, throwing across the green while the numbers fall; 6-9 s riding a lob high over the
  street and down onto a house; 9-11 s late on Sunset Loop, the dotted arc and a stone going in; 11-17 s the last houses, then
  "Your house stands"; 17-21 s "Glass Houses" on the title screen while the win's music plays on. Captured with `vcap` from a
  local build served on its own (a room of one, so the clock stays the page's own). The capture hooks are local only:
  `?autoplay=1` (this page plays itself with the bot brain), `?hush=1` (no sound until `__glass.hush(false)`, so a take can
  start late in a round without a long soundtrack to render) and `window.__glass` (the camera: first person, `chase`,
  `orbit`, `weak` or `stone`; the round clock; standing houses; breaks seen; draw calls).

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
- **Streets as layouts that all face one centre**, so every lawn can reach every house. Street 3 became Little Loop, a tight
  ring: in a straight lane, next-door fronts face the same way and can't be seen from each other's lawns.
- **The store closes at 1:30 and a pane takes 2.5 s** (planned 2:00 and 1.5 s): tuned until the balance simulations held (median
  round 1:40-2:45, few rounds reaching 3:00); the second half of a round is a straight fight.
- **Everyone moves one house along each round**, so nobody keeps the best spot for a whole match.
- **House plates over the houses instead of a strip at the top:** a number over each house (pinned to the screen's side when
  the house is behind you) is readable on a phone at any distance, and says which house is which without a legend.
- **Calm and gentle starts** are tied to round 1 (wind x0.3) and to a new player alone on the first two streets (bots hold off),
  so the first minute teaches the throw before the wind.
- **Ladder stars** are for your best round win on a street (1, 8+ or 15+ panes left), and one star unlocks the next street.

## Risks and how they're handled

| Risk | Handling |
|---|---|
| First-person aiming at 35-40 m is too hard for a newcomer | The full no-wind arc, a big facade (13 x 4 m), calm wind in round 1, bots holding off a first-timer's house; sims check a beginner script wins its share |
| Three players gang up and someone is out in 30 s | Bots spread targets (20% switch, no piling on a first-timer), the last panes are hard to hit, repair; sims check the first-out time |
| Late messages make pages disagree | Deterministic stones on the match clock, one page decides each house, a 400 ms correction window, predicted breaks put back if not confirmed |
| A host reload or change mid-round | Everything the host decides is in host state; bots, specials and away houses resume from it; tested through a fake room |
| Phone performance (glass, shards, shadows) | Instanced panes, shards and stones; static geometry merged per material (under 250 draw calls); env map baked once; no transmission; shadows and shard caps by quality; pause on hidden |
| iOS Safari | WebGL2 with a WebGL1-safe material set, audio started by the Play tap, every optional API guarded, no per-frame allocations |
| Glass not reading as glass from far away | A drawn pane texture with streaks (works on low quality), glints from the baked sky, broken teeth that differ in shape, the house number as the truth |
| Pointer lock refusals | The guide's rules: lock from a click in the world, Esc card with Resume, "Click" hint on a refusal, drag to look when locks keep failing |
| Too many rules | Every rule above shows itself in play (a cracked pane looks cracked, a closed store says CLOSED, a brick breaks three); hints teach only throw, repair and specials |

## How it's built

Vite + three.js, `@fontsource/josefin-sans` and `@fontsource/jost`, the SDK (`@onceworlds/sdk` with its match, host and bots
helpers); `"dir": "dist"`, `base: './'`.

- Pure modules in `src/core` (no page, no three.js; tested in node): `config.js` (every number), `rng.js`, `streets.js` (the
  eight layouts), `physics.js` (stone paths, wind, intercepts, facade and body hits, the aim solver), `round.js` (a round:
  panes, throws, specials, repair, the store, ghosts, eliminations, ranking), `bots.js` (brains and personalities), `sim.js`
  (a headless round: the title's attract round, autoplay and the balance tests), `sync.js` (one page's side of a round in a
  match: who decides what, presence, host state), `net.js` (checks on everything read from the network), `progress.js`
  (stars, unlocks, badges).
- `src/online.js`: the join, the lobby settings, `createMatch`, host state, the special claim, presence.
- Page modules in `src/view`: `stage.js` (renderer, sky, light, environment map), `build.js` (merged static geometry),
  `street.js` (the street), `glass.js` (panes, cracks, teeth, shards), `people.js` (figures, the first-person arm), `fx.js`
  (stones and trails, the arc, puffs, leaves, specials), `world.js` (all of it drawn from a round), `ui.js` (every screen's
  DOM), `input.js`, `audio.js`, `music.js`, `palette.js`, `poster.js`.
- `src/main.js`: join first, the title, lobby and rounds, cameras, events into sound and shards, the HUD.
- Static geometry is merged per material; panes, teeth, cracks, shards, stones, trails, arc dots and puffs are instanced, so a
  frame is about 80-110 draw calls with shadows (measured on high quality at 1280×720, first person and from above).
- Tests (`npm test`, `node --test`): rules and scoring, physics, bots (legal, beatable, not useless), balance simulations,
  throw and presence checks, and the room flow through a pretend room (host reload, a leaver, a latecomer).

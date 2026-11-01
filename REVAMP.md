# Glass Houses: the teardown, and the rebuild

Played headless from the `main` build (first person and the title, 16 s each, frames read at full size), against the games
this one should stand next to: Worms and Gunbound (arcs, wind, a shot that tells a story), Fortnite and Splatoon (a street
you want to look at, characters with weight, hits that land), Rocket League and Tony Hawk (named moments, streaks, a level
bar that fills after every match), Overwatch (the kill confirm, the play of the game).

## What is cheap, stiff, unclear or boring today

### Looks
- **The people are primitives.** Cylinders and spheres in a shirt colour, no faces worth the name, 1.8 m figures that read as
  pegs from 20 m. No rig, no animation beyond an arm cylinder swinging. Bots have hats glued on; the twins are two pegs.
- **The first-person hand is a sphere on a tube** with a lumpy grey rock: the biggest thing on screen most of the time, and the
  cheapest. When the autoplay lobs, the view is a flat blue sky with a sleeve in it.
- **The houses are cardboard.** A glass box, a slab roof, a stone side wall with a canvas texture that tiles visibly. No
  doors, no carports, no gardens, no roof detail, no variation house to house. The interiors are flat tan boxes, so the glass has
  nothing to show through it and breaking a pane reveals nothing.
- **The glass doesn't read as glass.** A painted streak texture over a cream tint; from the lawn every front looks like the
  same pale yellow wallpaper. No real reflections of a sky worth reflecting, no fresnel, no sun glint that moves.
- **Shattering, the star, is small.** A pinch of white triangles that vanish into the lawn colour at 20 m. No glitter, no dust,
  no flying glass that catches the sun. A broken pane far away is nearly invisible.
- **The world is flat colour.** Gradient sky with no clouds, flat-pyramid mesas, lawns of one green, a grey road. No ambient
  occlusion, no colour grade, nothing in the distance, no wind in the trees, no water in the pools.
- **The title is blocked by a giant blob of an oak** and the Play door is a small orange rectangle. It does not sell the game.
- **The HUD** is decent in parts (the sunburst clock, the house-number plates), but the side plates are a column of small
  coloured pills, and the five ammo dots are tiny.

### Feel
- **Hits happen far away and say nothing.** Your stone flies 30 m, a pane you can barely see flickers, a quiet distant crunch.
  No hit confirm at the crosshair, no number popping off the house, no sound at your ear. Missing and hitting feel the same.
- **The throw has no weight.** The arm slides back and forward; no anticipation, no camera kick, no follow-through, no visible
  stone leaving the hand toward the target with a trail you can follow.
- **Knocking a house out is a non-event** unless you happen to be looking: no punch-in, no slow-motion, no stamp, no sting.
- **Getting hit** is a white flash and a small arrow. Bonks wobble the view; nothing else.
- The camera never leans into anything: no strafe lean, no punch-in, no reaction to a house falling nearby.

### Depth and reasons to come back
- **Every throw is the same throw.** Five stones, 0.8 s refill: spam at whatever is in front. Nothing rewards accuracy over
  volume, nothing says "good shot".
- **No short-term goals.** No streaks, no combos, no named trick shots, nothing that pays off in the next five seconds.
- **No mid-term goals beyond the ladder.** Eight streets with stars are fine, but a round on street 3 plays like a round on
  street 1 with different numbers. There are no twists inside a match: round 20 is round 1.
- **No long-term goals.** No level, no rank, no unlocks, no cosmetics, nothing to spend a week on. Ten badges and three
  all-time boards.
- **No reason to come back tomorrow.** No daily anything, no streak of days, nothing new per session.
- **Your house is not yours.** Six identical houses in six colours. Nothing to show off to the street.

## The rebuild, against that list

### Art: Palm Springs, 1962, golden hour
- **Characters:** rigged, animated low-poly people (Quaternius, CC0), dressed per neighbour and in the owner's colour, with
  idle, walk, strafe left/right/back, hit, wave, celebrate and fall, crossfaded through an AnimationMixer; the throw is a
  procedural layer on the right arm (wind back, snap, follow through) over whatever the legs are doing.
- **First person:** a modelled, jointed hand and sleeve: the fingers close round the stone, the arm winds back and drops with
  power, snaps through on release with overshoot and settles; a camera kick and an FOV pop sell the release.
- **Houses with character:** each one different (butterfly roof, flat roof with beams, a clerestory, a stone chimney), a
  pastel front door, a carport with a car, breeze-block screens, planters, palms with skirts, agave, a pool with moving water,
  and real furniture behind the glass (CC0 models): sofas, lamps, plants, a TV, warm lamplight. Breaking a pane opens the room.
- **Glass:** environment reflections from a real sunset sky (Poly Haven HDRI, CC0), fresnel, a moving sun glint, tint.
- **Shattering:** many more shards, bigger near you, catching the sun as they spin, glitter sprites, a dust puff, glass
  piles that grow on the plinths.
- **The world:** HDRI-lit sky with clouds, layered desert mountains in haze, textured lawns and asphalt, ambient occlusion,
  a warm grade with cool shadows, a soft vignette, bloom only on the glints.
- **HUD in the world's language:** enamel house-number plates (bigger), the sunburst clock, real stones for ammo, and the
  Gazette (a mid-century newspaper) for round twists and results.

### Feel
- Hit confirm at the crosshair (a little crack mark), a crisp ding at your ear for every pane you break, "+1" floating off the
  pane, the plate thumping and rolling its number.
- Knockout: the camera punches in on the falling house, shards go slow-motion, the lights flicker out, a KO stamp, a brass sting.
- Getting hit: a hairline crack across your own view at the side it came from, a red edge, the arrow to whoever did it.
- Throws you can follow: a trail behind every stone, yours brightest.

### Depth
- **Hot streak:** three glass hits in a row heats your next stone; a hot stone breaks two panes at once and leaves a fire trail
  everyone can see coming (and knock down). A miss cools you. Accuracy now beats spam.
- **Knockout salvage:** breaking a house's last pane re-glazes one of yours. Races for the last pane become the story.
- **Round twists from the Gazette:** gales, hailstorms, brick deliveries, gnome season, double glazing, golden panes, a
  hardware-store sale. Drawn from the round's seed, the same on every page, announced as a headline.
- **Trick shots, named and paid:** long shot, lob over the oak, two in one, buzzer beater, revenge, intercept, from the ghost.

### Coming back
- **Level and rank** (XP from every round: panes, KOs, tricks, place), with a neighbourhood rank by level.
- **Cosmetics earned by playing:** what you throw (river stone, geode, baseball, golden egg...), its trail, your glass tint,
  your lawn (flamingos, a grill, sun loungers, a classic car, tiki torches, a dog). Others see them.
- **Daily jobs** (three a day, the same for everyone) and a **day streak**; the **Daily Street**: one seeded round a day with a
  twist, the same for everyone, scored, with today's best on a shared wall.
- More badges that mean something; leaderboards for level, rounds won, panes and the best daily score.

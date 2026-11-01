# Glass Houses

Everyone lives in a glass house. Everyone throws stones. Last house standing wins.

A first-person game for up to six neighbours (bots fill the empty houses) on eight streets. Hold to wind up, let go to throw,
hold R to re-glaze your own glass before the hardware store closes. Three hits in a row heat your next stone, knockouts win a
pane back, and every round the Gazette prints a twist (hail, a gale, golden panes, gnome season...). Every round pays XP
towards levels and the looks they unlock: what you throw, its trail, your glass, your lawn. Three jobs a day, a day streak, and
the Daily Street: one street for everyone each day, with the neighbourhood's best on the wall.

Play: https://onceworlds.com/play/glass-houses

## Run it

```sh
npm install
npm test        # rules, physics, bots, balance and the room flow, in node
npm run build   # dist/, what the platform serves
```

`DESIGN.md` has the rules, the numbers and how it is built.

MIT licensed.

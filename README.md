# chesscom-analyze-infinity

A userscript that adds a button on **Chess.com** to send your game to **Lichess**, automatically trigger the computer analysis, and orient the board to the colour you played.

Lichess offers free, unlimited engine analysis (server-side Stockfish). This script automates the whole Chess.com → Lichess handoff in a single click.

## Features

- Floating ♞ button on any Chess.com page, the button shows up once the game is over (not for vs bot), and on analysis pages too
- Scrapes the moves straight from the DOM
- **Automatic notation detection**: French (R/D/T/F/C) or English (K/Q/R/B/N), one single script
- Imports the game to Lichess via their public import API
- Automatically requests the computer analysis on open
- Board automatically oriented to the colour you played (black / white)
- Anti-spam guard: the button disables itself during a request

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension (Chrome, Firefox, Edge…)
2. Click this link: **[chesscom-lichess-analyze.user.js](https://raw.githubusercontent.com/ThibautGom-Dev/chesscom-analyze-infinity/main/chesscom-lichess-analyze.user.js)**
3. Tampermonkey opens the install page → click "Install"

Updates are automatic (via `@updateURL`).

## Usage

1. Recommended: be logged in to lichess.org in the same browser. It is not mandatory, the import and board orientation work either way, but the automatic computer analysis only runs for logged-in accounts. Without login the script simply logs that the analysis form was not found, and Lichess will ask you to sign in if you request the analysis manually.
2. Open a game on Chess.com
3. Click the ♞ button in the bottom-right corner
4. A Lichess tab opens: the game is imported, the board oriented, and the analysis starts

## Fair Use & Disclaimer

This tool is designed strictly as a post-match analysis utility to help you review and improve your gameplay after a match has concluded. It is not intended to be running during live or ranked matches, as doing so may provide an unfair advantage and violate the game's Terms of Service. By downloading and using this software, you agree to use it responsibly and solely for its intended purpose. The developers are not responsible for any account bans, suspensions, or other penalties resulting from the misuse of this tool during active gameplay.

## How it works

**Notation detection**: the only ambiguous letter between French and English is `R` (King in FR, Rook in EN). The other letters are disjoint. The script tests the scraped moves against both notation sets and keeps whichever validates the most of them — the language is inferred from the actual moves, game by game.

**Chess.com side**: the script reads the moves from the DOM, translates FR→EN notation if needed, builds a PGN and sends it to `lichess.org/api/import`.

**Lichess side**: the script also runs on lichess.org. It detects a marker in the URL, clicks the "request a computer analysis" button, and the board orientation is forced via the URL (`/black` or `/white`).

The analysis cannot be triggered directly from Chess.com: Lichess checks the origin of POST requests (anti-CSRF protection). That is why the trigger happens on the Lichess side, through a real same-origin click.

## Known limitations

- The script depends on the **DOM of Chess.com and Lichess**. If either changes its interface, some selectors may break (move scraping, analysis button, flip).
- Only **French and English** notations are recognised.
- You must be **logged in to Lichess** for the computer analysis to work.
- The Lichess import API is **rate-limited**: avoid spamming the button (it disables itself during a request to help with that).
- Colour detection follows the orientation shown on Chess.com — if you are watching someone else's game, it is not necessarily "your" colour.

## Debug

Open the browser console (F12). All script messages are prefixed with `[CC->Lichess]`. Useful lines:

| Message | Where | Meaning |
|---|---|---|
| `board: ... -> black=true/false` | Chess.com | detected colour played |
| `selector OK: ... -> N moves \| notation=FR/EN` | Chess.com | moves scraped + detected notation |
| `current orientation: black/white` | Lichess | board orientation |
| `analysis form not found` | Lichess | not logged in, or Lichess interface changed |

## Contributing

Check `CONTRIBUTING.md`

## License

MIT — see [LICENSE](LICENSE).

# Contributing

## Contributions are welcome — bug fixes, new selectors, ideas.

- `main` is the stable branch. It is what users install; only tested releases land here.
- `dev` is the working branch. Open your pull requests against dev, not main.
- For ideas or bugs without a fix, open an issue.

## Testing a change locally:

1.  In Tampermonkey, open the script editor and paste your modified version (or edit it in place).
2.  Reload a Chess.com game page and check the console ([CC->Lichess] logs).
3.  Most breakage comes from Chess.com / Lichess changing their DOM — when fixing a selector, keep the old ones as fallbacks rather than replacing them.

When your change is ready, bump `@version` in the userscript header so Tampermonkey picks up the update.

Thanks for your contributing ! 

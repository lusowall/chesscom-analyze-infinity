// ==UserScript==
// @name         Chess.com → Analyze on Lichess
// @namespace    https://github.com/lusowall
// @version      2.1
// @description  Sends your chess.com game to Lichess, triggers the computer analysis and orients the board to your colour. Auto-detects French and English move notation.
// @author       LusoWall
// @match        https://www.chess.com/game*
// @match        https://www.chess.com/play*
// @match        https://www.chess.com/analysis*
// @match        https://lichess.org/*
// @grant        GM_xmlhttpRequest
// @connect      lichess.org
// @run-at       document-idle
// @homepageURL  https://github.com/lusowall/chesscom-analyze-infinity
// @supportURL   https://github.com/lusowall/chesscom-analyze-infinity/issues
// @updateURL    https://raw.githubusercontent.com/lusowall/chesscom-analyze-infinity/main/chesscom-lichess-analyze.user.js
// @downloadURL  https://raw.githubusercontent.com/lusowall/chesscom-analyze-infinity/main/chesscom-lichess-analyze.user.js
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const HASH = 'cc-auto-analyse';
  const FLIP = 'flip';
  const onChessCom = location.hostname.endsWith('chess.com');
  const onLichess = location.hostname.endsWith('lichess.org');

  // =====================================================================
  // LICHESS SIDE: auto computer analysis + fallback board flip
  // =====================================================================
  if (onLichess) {
    if (!location.hash.includes(HASH)) return;
    const wantBlack = location.hash.includes(FLIP);
    console.log('[CC->Lichess] lichess + marker -> auto analysis | want black=' + wantBlack);

    // --- 1. request computer analysis ---
    let aTries = 0;
    const aTimer = setInterval(() => {
      aTries++;
      const form = document.querySelector('form[action*="request-analysis"]');
      if (form) {
        console.log('[CC->Lichess] requesting computer analysis');
        const b = form.querySelector('button, input[type=submit]');
        if (b) b.click();
        else if (form.requestSubmit) form.requestSubmit();
        else form.submit();
        return aDone();
      }
      const btn = [...document.querySelectorAll('button, a')].find((el) =>
        /analyse informatique|computer analysis/i.test(el.textContent || '')
      );
      if (btn) {
        console.log('[CC->Lichess] analysis button found (text)');
        btn.click();
        return aDone();
      }
      if (aTries > 40) {
        console.warn('[CC->Lichess] analysis form not found (already analysed? not logged in?)');
        aDone();
      }
    }, 500);

    function aDone() {
      clearInterval(aTimer);
      history.replaceState(null, '', location.pathname + location.search);
    }

    // --- 2. orientation: usually already correct via the URL (/black).
    //        this block only acts if the URL did not take effect ---
    function flipBoard() {
      const sels = ['.analyse__controls .flip', 'button.flip', '[data-act="flip"]'];
      for (const s of sels) {
        const el = document.querySelector(s);
        if (el) { console.log('[CC->Lichess] flip via', s); el.click(); return; }
      }
      const byLabel = [...document.querySelectorAll('button, a')].find((el) => {
        const t = el.getAttribute('title') || el.getAttribute('aria-label') || '';
        return /flip|retourner/i.test(t);
      });
      if (byLabel) { console.log('[CC->Lichess] flip via label'); byLabel.click(); return; }
      console.log('[CC->Lichess] flip via "f" key');
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'f', code: 'KeyF', keyCode: 70, which: 70, bubbles: true,
      }));
    }

    let flips = 0;
    const oTimer = setInterval(() => {
      const wrap = document.querySelector('.cg-wrap');
      if (!wrap) return;
      const isBlack = wrap.classList.contains('orientation-black');
      console.log('[CC->Lichess] current orientation: ' + (isBlack ? 'black' : 'white'));
      if (isBlack === wantBlack) { clearInterval(oTimer); return; }
      if (flips >= 3) {
        clearInterval(oTimer);
        console.warn('[CC->Lichess] fallback flip failed');
        return;
      }
      flips++;
      flipBoard();
    }, 900);
    setTimeout(() => clearInterval(oTimer), 25000);

    return;
  }

  if (!onChessCom) return;

  // =====================================================================
  // CHESS.COM SIDE: scrape moves + colour + import to lichess
  // =====================================================================
  console.log('[CC->Lichess] script loaded');

  // --- move notation ---------------------------------------------------
  // FR pieces : Roi=R Dame=D Tour=T Fou=F Cavalier=C
  // EN pieces : King=K Queen=Q Rook=R Bishop=B kNight=N
  // Only "R" overlaps -> the language is detected from the actual moves.
  const FR_MAP = { R: 'K', D: 'Q', T: 'R', F: 'B', C: 'N' };
  function sanRe(letters) {
    return new RegExp(
      '^([' + letters + ']?[a-h]?[1-8]?x?[a-h][1-8](=[' + letters + '])?|O-O(-O)?)[+#]?$'
    );
  }
  const RE_FR = sanRe('RDTFC');
  const RE_EN = sanRe('KQRBN');

  // --- game-over detection (used to gate the button on /play pages) ---
  function isGameOver() {
    // chess.com shows a "game over" modal/result component when a game ends
    return !!document.querySelector('[class*="game-over"], [class*="game-result"]');
  }

  // /game = rated games vs humans -> button only appears once the game is over
  // /play (vs bots) and /analysis -> button always available
  function shouldShowButton() {
    if (location.pathname.startsWith('/game')) return isGameOver();
    return true;
  }

  // --- colour detection: flipped board = you played black ---
  function playedBlack() {
    // target the chessboard first (not the first random .board)
    const board =
      document.querySelector('wc-chess-board') ||
      document.querySelector('chess-board') ||
      document.querySelector('[class*="board"][class*="flipped"]') ||
      document.querySelector('.board');
    const flipped = !!board && board.classList.contains('flipped');
    console.log(
      '[CC->Lichess] board:',
      board ? board.tagName.toLowerCase() + ' .' + board.className : 'NOT FOUND',
      '-> black=' + flipped
    );
    return flipped;
  }

  const SELECTORS = [
    '.main-line-ply .node-highlight-content',
    '.node-highlight-content',
    '.main-line-ply',
    '[data-ply] .node-highlight-content',
    'wc-move-list .node',
    'wc-simple-move-list .node',
    '.node',
  ];

  function cleanText(el) {
    let txt = el.textContent.trim().replace(/\s+/g, '');
    const fig = el.querySelector && el.querySelector('[data-figurine]');
    if (fig) {
      const p = fig.getAttribute('data-figurine');
      if (p && !txt.startsWith(p)) txt = p + txt;
    }
    return txt.replace(/^\d+\.+/, '');
  }

  // tries each selector; for the moves found, keeps whichever notation
  // (FR or EN) validates the most of them -> { moves, fr }
  function detectAndGetMoves() {
    for (const sel of SELECTORS) {
      const els = [...document.querySelectorAll(sel)];
      if (!els.length) continue;
      const texts = els.map(cleanText);
      const fr = texts.filter((t) => RE_FR.test(t));
      const en = texts.filter((t) => RE_EN.test(t));
      const useFr = fr.length > en.length;
      const moves = useFr ? fr : en;
      if (moves.length >= 2 && moves.length >= els.length * 0.6) {
        console.log(
          '[CC->Lichess] selector OK:', sel,
          '->', moves.length, 'moves | notation=' + (useFr ? 'FR' : 'EN')
        );
        return { moves, fr: useFr };
      }
    }
    return { moves: [], fr: false };
  }

  function buildPgn() {
    const { moves, fr } = detectAndGetMoves();
    if (!moves.length) return null;
    // FR notation -> translate to standard EN before sending the PGN
    const conv = fr
      ? moves.map((m) => m.replace(/[RDTFC]/g, (c) => FR_MAP[c] || c))
      : moves;
    let pgn = '';
    for (let i = 0; i < conv.length; i++) {
      if (i % 2 === 0) pgn += i / 2 + 1 + '. ';
      pgn += conv[i] + ' ';
    }
    return pgn.trim();
  }

  // --- import to Lichess via their public import API ---
  // done() is called in every case (success/error) -> releases the button
  function sendToLichess(pgn, setStatus, done) {
    setStatus(' sending…');
    const black = playedBlack();
    GM_xmlhttpRequest({
      method: 'POST',
      url: 'https://lichess.org/api/import',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      data: 'pgn=' + encodeURIComponent(pgn),
      onload: (res) => {
        done();
        try {
          const data = JSON.parse(res.responseText);
          if (data && data.url) {
            setStatus('✓', true);
            // orientation forced via the URL: lichess.org/{id}/black|white
            const oriented = data.url + '/' + (black ? 'black' : 'white');
            const hash = '#' + HASH + (black ? '&' + FLIP : '');
            console.log('[CC->Lichess] opening:', oriented + hash);
            window.open(oriented + hash, '_blank');
          } else {
            setStatus('error', true);
            console.error('[CC->Lichess] response:', res.responseText);
          }
        } catch (e) {
          setStatus('error', true);
          console.error('[CC->Lichess] parse fail:', e, res.responseText);
        }
      },
      onerror: (e) => {
        done();
        setStatus('network error', true);
        console.error('[CC->Lichess] request fail:', e);
      },
    });
  }

  // --- floating button (small round knight) ---
  let btnEl = null;
  let statusEl = null;

  function addButton() {
    if (btnEl) return; // deja cree
    if (!document.body) return;

    const status = document.createElement('div');
    status.id = 'lichess-analyse-status';
    Object.assign(status.style, {
      position: 'fixed',
      bottom: '62px',
      right: '78px',
      zIndex: '2147483647',
      padding: '4px 8px',
      background: 'rgba(0,0,0,.8)',
      color: '#fff',
      borderRadius: '4px',
      fontFamily: 'sans-serif',
      fontSize: '12px',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      opacity: '0',
      display: 'none',
      transition: 'opacity .15s',
    });

    let hideTimer;
    function setStatus(text, autoHide) {
      clearTimeout(hideTimer);
      status.textContent = text || '';
      status.style.opacity = text ? '1' : '0';
      if (autoHide) hideTimer = setTimeout(() => setStatus(''), 3000);
    }

    const btn = document.createElement('button');
    btn.id = 'lichess-analyse-btn';
    btn.textContent = '♞';
    btn.title = 'Analyze on Lichess';

    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '50px',
      right: '20px',
      zIndex: '2147483647',
      width: '48px',
      height: '48px',
      background: '#629924',
      color: '#fff',
      border: 'none',
      borderRadius: '50%',
      cursor: 'pointer',
      fontSize: '24px',
      lineHeight: '1',
      display: 'none', // la visibilite est geree par refreshVisibility()
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,.4)',
      transition: 'opacity .15s',
    });

    // anti-spam guard: one request at a time (lichess rate limit)
    let busy = false;
    function setBusy(b) {
      busy = b;
      btn.style.opacity = b ? '0.5' : '1';
      btn.style.cursor = b ? 'default' : 'pointer';
    }

    btn.addEventListener('click', () => {
      if (busy) return;
      const pgn = buildPgn();
      if (!pgn) {
        setStatus('no moves found', true);
        console.warn('[CC->Lichess] no moves detected');
        return;
      }
      console.log('[CC->Lichess] PGN:', pgn);
      setBusy(true);
      sendToLichess(pgn, setStatus, () => setBusy(false));
    });

    document.body.appendChild(status);
    document.body.appendChild(btn);
    btnEl = btn;
    statusEl = status;
    console.log('[CC->Lichess] button created');
  }

  // affiche / masque le bouton selon la page et l'etat de la partie
  let lastShown = null;
  function refreshVisibility() {
    if (!btnEl) return;
    const show = shouldShowButton();
    if (show === lastShown) return;
    lastShown = show;
    btnEl.style.display = show ? 'flex' : 'none';
    statusEl.style.display = show ? 'block' : 'none';
    console.log('[CC->Lichess] button ' + (show ? 'shown' : 'hidden'));
  }

  function tick() {
    addButton();
    refreshVisibility();
  }

  // injection + filet de securite (chess.com est une SPA)
  tick();
  new MutationObserver(tick).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  setInterval(tick, 2000);
})();

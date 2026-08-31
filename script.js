const root = document.documentElement;
const toggle = document.querySelector('.theme-toggle');
const themeColor = document.querySelector('meta[name="theme-color"]');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function effectiveTheme() {
  if (root.dataset.theme) return root.dataset.theme;
  return systemDark.matches ? 'dark' : 'light';
}

function updateToggle() {
  const theme = effectiveTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  toggle.setAttribute('aria-label', `Switch to ${next} mode`);
  toggle.setAttribute('title', `Switch to ${next} mode`);
  themeColor.setAttribute('content', theme === 'dark' ? '#090a0d' : '#f6f6f3');
}

toggle.addEventListener('click', () => {
  root.dataset.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
  updateToggle();
});

systemDark.addEventListener('change', () => {
  if (!root.dataset.theme) updateToggle();
});

updateToggle();


/*
 * Minimal-edit text morphing, adapted from the original portfolio.
 * Insertions, deletions, and substitutions each cost 1. Equal characters are
 * skipped instantly; only actual edits receive the block cursor.
 */
function levenshteinAtomicOps(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 0; i <= n; i += 1) dp[i][0] = i;
  for (let j = 0; j <= m; j += 1) dp[0][j] = j;

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        );
      }
    }
  }

  let i = n;
  let j = m;
  const reversed = [];

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      a[i - 1] === b[j - 1] &&
      dp[i][j] === dp[i - 1][j - 1]
    ) {
      reversed.push({ type: 'equal', ch: a[i - 1] });
      i -= 1;
      j -= 1;
      continue;
    }

    // Prefer substitutions when multiple minimum paths exist. It makes the
    // resulting animation read more naturally than delete-then-insert.
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      reversed.push({ type: 'substitute', from: a[i - 1], to: b[j - 1] });
      i -= 1;
      j -= 1;
      continue;
    }

    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      reversed.push({ type: 'delete', ch: a[i - 1] });
      i -= 1;
      continue;
    }

    reversed.push({ type: 'insert', ch: b[j - 1] });
    j -= 1;
  }

  reversed.reverse();
  return reversed;
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const MORPH_DELAY = 34;

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function morphText(element, target) {
  if (element.dataset.morphing === 'true') return;

  const source = element.textContent;
  if (source === target) return;

  if (reducedMotion.matches) {
    element.textContent = target;
    return;
  }

  element.dataset.morphing = 'true';
  element.setAttribute('aria-busy', 'true');

  const ops = levenshteinAtomicOps(source, target);
  let text = source;
  let cursor = 0;

  for (const op of ops) {
    if (op.type === 'equal') {
      cursor += 1;
      continue;
    }

    const atEnd = cursor >= text.length;
    let withBlock;

    if (op.type === 'insert') {
      withBlock = `${text.slice(0, cursor)}█${text.slice(cursor)}`;
    } else {
      withBlock = atEnd
        ? `${text}█`
        : `${text.slice(0, cursor)}█${text.slice(cursor + 1)}`;
    }

    element.textContent = withBlock;
    await sleep(MORPH_DELAY);

    if (op.type === 'insert') {
      text = `${text.slice(0, cursor)}${op.ch}${text.slice(cursor)}`;
      cursor += 1;
    } else if (op.type === 'delete') {
      if (!atEnd) text = `${text.slice(0, cursor)}${text.slice(cursor + 1)}`;
    } else if (op.type === 'substitute') {
      if (atEnd) {
        text += op.to;
      } else {
        text = `${text.slice(0, cursor)}${op.to}${text.slice(cursor + 1)}`;
      }
      cursor += 1;
    }

    element.textContent = text;
  }

  element.textContent = target;
  element.dataset.morphing = 'false';
  element.removeAttribute('aria-busy');
}

function toggleMorph(element) {
  const a = element.dataset.morphA;
  const b = element.dataset.morphB;
  const target = element.textContent === a ? b : a;
  return morphText(element, target);
}

// Copy the email address and use the same minimum-edit animation for feedback.
const emailButton = document.querySelector('.header-email');
if (emailButton) {
  const email = emailButton.dataset.email || emailButton.textContent.trim();
  let emailBusy = false;

  const writeEmailToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(email);
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = email;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
  };

  emailButton.addEventListener('click', async () => {
    if (emailBusy) return;
    emailBusy = true;

    await writeEmailToClipboard();
    emailButton.setAttribute('aria-label', 'Email address copied');
    emailButton.setAttribute('title', 'Copied');

    await morphText(emailButton, 'Copied');
    await sleep(1100);
    await morphText(emailButton, email);

    emailButton.setAttribute('aria-label', 'Copy email address');
    emailButton.setAttribute('title', 'Copy email address');
    emailBusy = false;
  });
}

const introMorph = document.querySelector('.levenshtein-inline');
if (introMorph) {
  introMorph.addEventListener('click', () => toggleMorph(introMorph));
}

const minecraftTrigger = document.querySelector('.project-morph-trigger');
const minecraftDescription = document.querySelector('.minecraft-description');
if (minecraftTrigger && minecraftDescription) {
  minecraftTrigger.addEventListener('click', () => toggleMorph(minecraftDescription));
}

// Keep the Levenshtein idea visible without making the header constantly busy.
// Start on "Edit Distance", wait 5 seconds, then alternate between it and
// "Levenshtein" every 8 seconds. Pause while the link is hovered/focused or
// while the page is hidden so the animation never fights the user's attention.
const navLevenshtein = document.querySelector('.levenshtein-nav');
if (navLevenshtein) {
  const FIRST_NAV_MORPH_DELAY = 5000;
  const NAV_MORPH_INTERVAL = 8000;
  let navPaused = false;

  navLevenshtein.textContent = reducedMotion.matches
    ? navLevenshtein.dataset.morphB
    : navLevenshtein.dataset.morphA;

  const setPaused = (paused) => {
    navPaused = paused;
  };

  navLevenshtein.addEventListener('mouseenter', () => setPaused(true));
  navLevenshtein.addEventListener('mouseleave', () => setPaused(false));
  navLevenshtein.addEventListener('focus', () => setPaused(true));
  navLevenshtein.addEventListener('blur', () => setPaused(false));

  const waitUntilActive = async () => {
    while (navPaused || document.hidden) {
      await sleep(250);
    }
  };

  const runNavMorphLoop = async () => {
    if (reducedMotion.matches) return;

    await sleep(FIRST_NAV_MORPH_DELAY);

    while (true) {
      await waitUntilActive();
      await toggleMorph(navLevenshtein);
      await sleep(NAV_MORPH_INTERVAL);
    }
  };

  runNavMorphLoop();
}


/* Keep the content clipping edge just below the actual fixed header height. */
const siteHeader = document.querySelector('.site-header');
if (siteHeader) {
  const HEADER_CLEARANCE = 12;

  const syncContentTop = () => {
    const headerBottom = siteHeader.getBoundingClientRect().bottom;
    root.style.setProperty('--content-top', `${Math.ceil(headerBottom + HEADER_CLEARANCE)}px`);
  };

  syncContentTop();

  if ('ResizeObserver' in window) {
    const headerObserver = new ResizeObserver(syncContentTop);
    headerObserver.observe(siteHeader);
  } else {
    window.addEventListener('resize', syncContentTop);
  }
}

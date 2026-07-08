(function () {
  'use strict';

  // ── Reading progress bar ────────────────────────────────────────
  var bar = document.getElementById('read-progress');
  if (bar) {
    var onScroll = function () {
      var doc = document.documentElement;
      var scrolled = doc.scrollTop || document.body.scrollTop;
      var total = doc.scrollHeight - doc.clientHeight;
      bar.style.width = total > 0 ? (scrolled / total * 100) + '%' : '0%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Back to top ─────────────────────────────────────────────────
  var btt = document.getElementById('back-top');
  if (btt) {
    window.addEventListener('scroll', function () {
      btt.classList.toggle('visible', window.scrollY > 600);
    }, { passive: true });
    btt.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Mobile nav toggle ────────────────────────────────────────────
  var navToggle = document.getElementById('nav-toggle');
  var siteNav = document.querySelector('.site-nav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      var expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      siteNav.classList.toggle('nav-open', !expanded);
    });
    document.addEventListener('click', function (e) {
      if (!navToggle.contains(e.target) && !siteNav.contains(e.target)) {
        navToggle.setAttribute('aria-expanded', 'false');
        siteNav.classList.remove('nav-open');
      }
    });
  }

  // ── Language switcher ─────────────────────────────────────────────
  var LANG_KEY = 'shoshit-lang';
  var currentLang = localStorage.getItem(LANG_KEY) || 'ne';

  function applyLanguage(lang) {
    currentLang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}

    // Update buttons
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      var active = btn.dataset.lang === lang;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    // Show/hide translations per piece
    document.querySelectorAll('.piece').forEach(function (piece) {
      var allTrans = piece.querySelectorAll('.trans');
      if (!allTrans.length) return; // no translation markup — leave as-is

      allTrans.forEach(function (t) { t.hidden = true; });

      var target = piece.querySelector('.trans.lang-' + lang);
      if (target) {
        target.hidden = false;
      } else {
        // Fallback to Nepali
        var ne = piece.querySelector('.trans.lang-ne');
        if (ne) ne.hidden = false;
      }
    });
  }

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLanguage(btn.dataset.lang);
    });
  });

  // Apply on load
  applyLanguage(currentLang);

  // ── Auto-generate share buttons ───────────────────────────────────
  function buildShareStrip(piece) {
    var strip = document.createElement('div');
    strip.className = 'share-strip';
    strip.setAttribute('aria-label', 'Share this piece');
    strip.innerHTML =
      '<span class="share-strip-label">Share —</span>' +
      '<button class="share-btn" data-platform="facebook" title="Share on Facebook">f Facebook</button>' +
      '<button class="share-btn" data-platform="whatsapp" title="Share on WhatsApp">&#9993; WhatsApp</button>' +
      '<button class="share-btn" data-platform="twitter" title="Share on X / Twitter">ᵔ X</button>' +
      '<button class="share-btn copy-btn" data-platform="copy" title="Copy link to this piece">🔗 Link</button>';
    return strip;
  }

  document.querySelectorAll('.piece h3').forEach(function (h3) {
    var piece = h3.closest('.piece');
    if (!piece) return;
    h3.after(buildShareStrip(piece));
  });

  // ── Share button click handler ────────────────────────────────────
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.share-btn');
    if (!btn) return;
    e.preventDefault();

    var platform = btn.dataset.platform;
    var piece = btn.closest('.piece');
    var pieceId = piece ? piece.id : '';
    var titleEl = piece ? piece.querySelector('h3') : null;
    var title = titleEl ? titleEl.textContent.trim() : document.title;

    var pageUrl = window.location.origin + window.location.pathname;
    var url = pieceId ? pageUrl + '#' + pieceId : pageUrl;
    var shareText = title + ' — मुक्तिनाथ शर्मा “शोषित”';

    var encoded = encodeURIComponent(url);
    var text = encodeURIComponent(shareText);

    if (platform === 'facebook') {
      window.open(
        'https://www.facebook.com/sharer/sharer.php?u=' + encoded,
        '_blank', 'width=600,height=400,noopener'
      );
    } else if (platform === 'whatsapp') {
      window.open(
        'https://wa.me/?text=' + text + '%20' + encoded,
        '_blank', 'noopener'
      );
    } else if (platform === 'twitter') {
      window.open(
        'https://twitter.com/intent/tweet?text=' + text + '&url=' + encoded,
        '_blank', 'width=600,height=400,noopener'
      );
    } else if (platform === 'copy') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          btn.textContent = '✓ Copied!';
          setTimeout(function () { btn.innerHTML = '🔗 Link'; }, 2200);
        }).catch(function () {
          fallbackCopy(url, btn);
        });
      } else {
        fallbackCopy(url, btn);
      }
    }
  });

  function fallbackCopy(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      btn.textContent = '✓ Copied!';
      setTimeout(function () { btn.innerHTML = '🔗 Link'; }, 2200);
    } catch (e) {}
    document.body.removeChild(ta);
  }

})();

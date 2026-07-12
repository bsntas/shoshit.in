(function () {
  'use strict';

  // ── Reading progress bar ────────────────────────────────────────
  var bar = document.getElementById('read-progress');
  if (bar) {
    var onScroll = function () {
      var doc = document.documentElement;
      var scrolled = doc.scrollTop || document.body.scrollTop;
      var total = doc.scrollHeight - doc.clientHeight;
      var pct = total > 0 ? Math.round(scrolled / total * 100) : 0;
      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', pct);
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

  // ── Theme toggle ─────────────────────────────────────────────────
  var THEME_KEY = 'shoshit-theme';
  var themeBtn = document.getElementById('theme-toggle');

  function isDark() {
    var stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (themeBtn) {
      themeBtn.textContent = dark ? '☀ Light' : '☾ Dark';
      themeBtn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
      themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  applyTheme(isDark());

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var nowDark = document.documentElement.getAttribute('data-theme') === 'dark';
      try { localStorage.setItem(THEME_KEY, nowDark ? 'light' : 'dark'); } catch (e) {}
      applyTheme(!nowDark);
    });
  }

  // ── Mobile nav toggle ────────────────────────────────────────────
  var navToggle = document.getElementById('nav-toggle');
  var navWrap = document.querySelector('.nav-wrap');
  if (navToggle && navWrap) {
    navToggle.addEventListener('click', function () {
      var expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      navWrap.classList.toggle('nav-open', !expanded);
    });
    document.addEventListener('click', function (e) {
      if (!navToggle.contains(e.target) && !navWrap.contains(e.target)) {
        navToggle.setAttribute('aria-expanded', 'false');
        navWrap.classList.remove('nav-open');
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

    // Show/hide translations — works for any element that directly parents .trans children,
    // not limited to .piece. Shows all matching children (supports multiple per container).
    var seen = new Set();
    var parents = [];
    document.querySelectorAll('.trans').forEach(function (t) {
      var p = t.parentElement;
      if (p && !seen.has(p)) { seen.add(p); parents.push(p); }
    });
    parents.forEach(function (parent) {
      var allTrans = Array.prototype.filter.call(parent.children, function (c) {
        return c.classList.contains('trans');
      });
      if (!allTrans.length) return;
      var hasLang = allTrans.some(function (t) { return t.classList.contains('lang-' + lang); });
      allTrans.forEach(function (t) {
        var show = t.classList.contains('lang-' + lang) ||
                   (!hasLang && t.classList.contains('lang-ne'));
        t.hidden = !show;
      });
    });

    // Swap text on elements with data-ne/en/hi attributes (titles, kickers, links)
    document.querySelectorAll('[data-ne]').forEach(function (el) {
      var text = el.getAttribute('data-' + lang);
      if (!text) text = el.getAttribute('data-ne');
      if (text !== null) el.textContent = text;
    });

    // Bilingual display for piece/article titles: show "Translation — नेपाली मूल"
    if (lang !== 'ne') {
      document.querySelectorAll('.piece h3[data-ne]').forEach(function (el) {
        var ne = el.getAttribute('data-ne');
        var tr = el.getAttribute('data-' + lang) || ne;
        if (tr && ne && tr !== ne) el.textContent = tr + ' — ' + ne;
      });
    }

    document.documentElement.lang = lang === 'en' ? 'en' : lang === 'hi' ? 'hi' : 'ne';
  }

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLanguage(btn.dataset.lang);
    });
  });

  // Apply on load
  applyLanguage(currentLang);

  // ── Settings panel ───────────────────────────────────────────────
  var settingsPanel = document.getElementById('settings-panel');
  var settingsToggle = document.getElementById('settings-toggle');
  var settingsClose = document.getElementById('settings-close');
  var settingsBackdrop = settingsPanel && settingsPanel.querySelector('.settings-backdrop');

  function openSettings() {
    if (!settingsPanel) return;
    settingsPanel.classList.add('is-open');
    settingsPanel.setAttribute('aria-hidden', 'false');
    if (settingsToggle) settingsToggle.setAttribute('aria-expanded', 'true');
    if (settingsClose) settingsClose.focus();
  }

  function closeSettings() {
    if (!settingsPanel) return;
    settingsPanel.classList.remove('is-open');
    settingsPanel.setAttribute('aria-hidden', 'true');
    if (settingsToggle) settingsToggle.setAttribute('aria-expanded', 'false');
    if (settingsToggle) settingsToggle.focus();
  }

  if (settingsToggle) settingsToggle.addEventListener('click', openSettings);
  if (settingsClose) settingsClose.addEventListener('click', closeSettings);
  if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettings);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && settingsPanel && settingsPanel.classList.contains('is-open')) {
      closeSettings();
    }
  });

  // ── Auto-generate share buttons ───────────────────────────────────
  function buildShareStrip(piece) {
    var strip = document.createElement('div');
    strip.className = 'share-strip';
    strip.setAttribute('aria-label', 'Share this piece');
    strip.innerHTML =
      '<span class="share-strip-label">Share</span>' +
      '<button class="share-btn" data-platform="facebook" title="Share on Facebook">Facebook</button>' +
      '<button class="share-btn" data-platform="whatsapp" title="Share on WhatsApp">WhatsApp</button>' +
      '<button class="share-btn" data-platform="twitter" title="Share on X / Twitter">X</button>' +
      '<button class="share-btn copy-btn" data-platform="copy" title="Copy link to this piece">Copy link</button>';
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

  // ── Font size controls (reader pages) ───────────────────────────
  var FONT_SIZE_KEY = 'shoshit-fontsize';
  var readerEl = document.querySelector('.reader');
  if (readerEl) {
    var savedSize = localStorage.getItem(FONT_SIZE_KEY) || 'md';
    readerEl.setAttribute('data-font-size', savedSize);

    var fsContainer = document.createElement('div');
    fsContainer.className = 'font-size-controls';
    fsContainer.setAttribute('aria-label', 'Font size');
    fsContainer.innerHTML =
      '<span class="font-size-label">अक्षर ·</span>' +
      '<button class="font-size-btn" data-size="sm" title="Smaller text">A−</button>' +
      '<button class="font-size-btn" data-size="md" title="Default text">A</button>' +
      '<button class="font-size-btn" data-size="lg" title="Larger text">A+</button>';

    var worksEl = readerEl.querySelector('.works');
    if (worksEl) worksEl.insertBefore(fsContainer, worksEl.firstChild);

    fsContainer.querySelectorAll('.font-size-btn').forEach(function (btn) {
      if (btn.dataset.size === savedSize) btn.classList.add('active');
      btn.addEventListener('click', function () {
        var size = btn.dataset.size;
        readerEl.setAttribute('data-font-size', size);
        try { localStorage.setItem(FONT_SIZE_KEY, size); } catch (e) {}
        fsContainer.querySelectorAll('.font-size-btn').forEach(function (b) {
          b.classList.toggle('active', b.dataset.size === size);
        });
      });
    });
  }

  // ── Book listing & detail view ───────────────────────────────────
  var bookReader = document.querySelector('.reader');
  if (bookReader) {
    var bookWorks = bookReader.querySelector('.works');
    var bookPieces = bookWorks ? Array.prototype.slice.call(bookWorks.querySelectorAll('.piece')) : [];

    if (bookPieces.length) {

      var occasionGroups = bookWorks
        ? Array.prototype.slice.call(bookWorks.querySelectorAll('.occasion-group'))
        : [];

      var showBookDetail = function (id) {
        var art = document.getElementById(id);
        if (!art) return;
        bookPieces.forEach(function (p) { p.classList.remove('is-active'); });
        art.classList.add('is-active');
        // Activate only the occasion-group immediately preceding this piece
        occasionGroups.forEach(function (og) { og.classList.remove('is-active'); });
        var prev = art.previousElementSibling;
        while (prev) {
          if (prev.classList.contains('occasion-group')) {
            prev.classList.add('is-active');
            break;
          }
          prev = prev.previousElementSibling;
        }
        bookReader.classList.remove('in-listing');
        bookReader.classList.add('in-detail');
        history.pushState(null, '', '#' + id);
        window.scrollTo(0, 0);
        applyLanguage(currentLang);
      };

      var showBookListing = function () {
        bookPieces.forEach(function (p) { p.classList.remove('is-active'); });
        occasionGroups.forEach(function (og) { og.classList.remove('is-active'); });
        bookReader.classList.remove('in-detail');
        bookReader.classList.add('in-listing');
        var h = window.location.hash;
        if (h && h !== '#top') {
          history.pushState(null, '', window.location.pathname + window.location.search);
        }
        window.scrollTo(0, 0);
        applyLanguage(currentLang);
      };

      // Build card grid
      var bookListing = document.createElement('div');
      bookListing.className = 'book-listing';
      bookListing.id = 'book-listing';
      var articleGrid = document.createElement('div');
      articleGrid.className = 'article-grid';

      bookPieces.forEach(function (article) {
        var kicker = article.querySelector('.kicker');
        var h3 = article.querySelector('h3');
        if (!kicker && !h3) return;

        var card = document.createElement('button');
        card.className = 'article-card';
        card.type = 'button';

        if (kicker && h3) {
          // Standard layout: kicker label + title
          var ks = document.createElement('span');
          ks.className = 'card-kicker';
          ['ne', 'en', 'hi'].forEach(function (l) {
            var v = kicker.getAttribute('data-' + l);
            if (v !== null) ks.setAttribute('data-' + l, v);
          });
          ks.textContent = kicker.getAttribute('data-ne') || kicker.textContent;

          var ts = document.createElement('span');
          ts.className = 'card-title';
          ['ne', 'en', 'hi'].forEach(function (l) {
            var v = h3.getAttribute('data-' + l);
            if (v !== null) ts.setAttribute('data-' + l, v);
          });
          ts.textContent = h3.getAttribute('data-ne') || h3.textContent;

          card.appendChild(ks);
          card.appendChild(ts);
        } else {
          // Kicker-only (e.g. numbered muktaks) — use kicker as the card title
          var titleEl = kicker || h3;
          var ts2 = document.createElement('span');
          ts2.className = 'card-title';
          ['ne', 'en', 'hi'].forEach(function (l) {
            var v = titleEl.getAttribute('data-' + l);
            if (v !== null) ts2.setAttribute('data-' + l, v);
          });
          ts2.textContent = titleEl.getAttribute('data-ne') || titleEl.textContent;
          card.appendChild(ts2);
        }

        var artId = article.id;
        card.addEventListener('click', function () { showBookDetail(artId); });
        articleGrid.appendChild(card);
      });

      bookListing.appendChild(articleGrid);
      bookReader.insertBefore(bookListing, bookReader.firstChild);

      // Move frontmatter sections (dedication, foreword, etc.) before the card grid
      // so they appear in listing view. CSS hides them in detail view.
      var frontmatters = bookWorks ? Array.prototype.slice.call(bookWorks.querySelectorAll('.frontmatter')) : [];
      frontmatters.forEach(function (fm) {
        bookReader.insertBefore(fm, bookListing);
      });

      // Add back button + repurpose bottom top-link for each article
      bookPieces.forEach(function (article) {
        var backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'back-to-list';
        backBtn.setAttribute('data-ne', '← सूचीमा');
        backBtn.setAttribute('data-en', '← Back to list');
        backBtn.setAttribute('data-hi', '← सूची पर वापस');
        backBtn.textContent = '← सूचीमा';
        backBtn.addEventListener('click', showBookListing);
        article.insertBefore(backBtn, article.firstChild);

        // Add a back button at the bottom of the article
        var backBtnBottom = document.createElement('button');
        backBtnBottom.type = 'button';
        backBtnBottom.className = 'back-to-list';
        backBtnBottom.setAttribute('data-ne', '← सूचीमा');
        backBtnBottom.setAttribute('data-en', '← Back to list');
        backBtnBottom.setAttribute('data-hi', '← सूची पर वापस');
        backBtnBottom.textContent = '← सूचीमा';
        backBtnBottom.addEventListener('click', showBookListing);
        article.appendChild(backBtnBottom);
      });

      // TOC link delegation: open articles via card view
      bookReader.addEventListener('click', function (e) {
        var ta = e.target.closest('.toc a[href^="#"]');
        if (ta) {
          var tid = ta.getAttribute('href').slice(1);
          var tt = document.getElementById(tid);
          if (tt && tt.classList.contains('piece')) {
            e.preventDefault();
            showBookDetail(tid);
          }
        }
      });

      // Initial state based on URL hash
      var initHash = window.location.hash.slice(1);
      if (initHash) {
        var initTarget = document.getElementById(initHash);
        if (initTarget && initTarget.classList.contains('piece')) {
          showBookDetail(initHash);
        } else {
          showBookListing();
        }
      } else {
        showBookListing();
      }

      // Browser back/forward
      window.addEventListener('popstate', function () {
        var h = window.location.hash.slice(1);
        if (h) {
          var t = document.getElementById(h);
          if (t && t.classList.contains('piece')) { showBookDetail(h); return; }
        }
        showBookListing();
      });

      // Escape to return to listing
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && bookReader.classList.contains('in-detail')) {
          showBookListing();
        }
      });
    }
  }

})();

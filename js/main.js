/* The Pastelist — site behaviour (no dependencies). */
(() => {
  'use strict';

  // ---- Settings --------------------------------------------------------------
  // WhatsApp number in international format, digits only (91 = India).
  // If the number ever changes, also search index.html for 918547413837 and "85474 13837".
  const WHATSAPP = '918547413837';
  const EMAIL = 'info.thepastelist@gmail.com';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touchDevice = window.matchMedia('(pointer: coarse)').matches;
  const waUrl = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

  // ---- Header: shadow on scroll + mobile menu ----------------------------------
  const header = $('.site-header');
  const toggle = $('.menu-toggle');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setMenu = (open) => {
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  $$('#site-nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('menu-open')) { setMenu(false); toggle.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (header.classList.contains('menu-open') && !header.contains(e.target)) setMenu(false);
  });
  window.matchMedia('(min-width: 980px)').addEventListener('change', () => setMenu(false));

  // ---- Reveal on scroll ----------------------------------------------------------
  const revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reducedMotion) {
    revealEls.forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
      el.style.setProperty('--delay', `${Math.min(siblings.indexOf(el), 5) * 70}ms`);
    });
    // anything already on screen shows immediately (no flash), the rest fades in
    const vh = window.innerHeight;
    revealEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) el.classList.add('is-visible');
    });
    document.documentElement.classList.add('reveal-ready');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    revealEls.filter((el) => !el.classList.contains('is-visible')).forEach((el) => io.observe(el));
  }

  // ---- WhatsApp shortcuts: sticky bar (phones) + floating button (desktop) --------
  // Both step aside while the enquiry form is on screen or someone is typing.
  const bar = $('.wa-bar');
  const float = $('.wa-float');
  let pastHero = false;
  let formInView = false;
  let typing = false;
  const updateWa = () => {
    if (float) float.classList.toggle('is-visible', pastHero && !formInView);
    if (bar) bar.classList.toggle('is-hidden', formInView || typing);
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; updateWa(); }).observe($('.hero'));
    new IntersectionObserver(([e]) => { formInView = e.isIntersecting; updateWa(); }).observe($('#enquire'));
  } else if (float) {
    float.classList.add('is-visible');
  }
  document.addEventListener('focusin', (e) => {
    if (e.target.matches('input:not([type=radio]):not([type=checkbox]), select, textarea')) { typing = true; updateWa(); }
  });
  document.addEventListener('focusout', () => { typing = false; updateWa(); });

  // ---- Footer year -------------------------------------------------------------------
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  // ---- Recent creations: filters -------------------------------------------------------
  const filterBtns = $$('.filter');
  const galleryItems = $$('#gallery .g-item');
  const tagsOf = (el) => (el.dataset.tags || '').split(/\s+/).filter(Boolean);

  // "All" starts with a first set (8 on phones, 9 on bigger screens) and a "Show all" button
  const moreWrap = $('.gallery-more-wrap');
  const moreBtn = $('#gallery-more');
  let expanded = false;
  let current = 'all';

  const applyFilter = (key) => {
    if (!filterBtns.some((b) => b.dataset.filter === key && !b.hidden)) key = 'all';
    current = key;
    filterBtns.forEach((b) => {
      const on = b.dataset.filter === key;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const limit = window.matchMedia('(min-width: 900px)').matches ? 9 : 8;
    let shown = 0;
    let extra = 0;
    galleryItems.forEach((item) => {
      const isNote = item.classList.contains('g-note');
      let show = key === 'all' ? !isNote : tagsOf(item).includes(key);
      if (show && key === 'all' && !expanded && shown >= limit) { show = false; extra += 1; }
      if (show) shown += 1;
      item.hidden = !show;
      if (show) item.classList.add('is-visible');
    });
    if (moreWrap) moreWrap.hidden = extra === 0;
  };
  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      expanded = true;
      moreBtn.setAttribute('aria-expanded', 'true');
      applyFilter(current);
    });
  }
  // a filter only appears once at least one photo carries its tag
  filterBtns.forEach((b) => {
    if (b.dataset.filter !== 'all' && !galleryItems.some((i) => tagsOf(i).includes(b.dataset.filter))) b.hidden = true;
    b.addEventListener('click', () => applyFilter(b.dataset.filter));
  });
  applyFilter('all');

  // ---- Forms: two paths ("help me choose" and "I know what I want") ------------------
  const formHelp = $('#form-help');
  const formKnow = $('#form-know');
  const status = $('#form-status');
  const tabs = $$('.form-tabs [role="tab"]');

  const selectTab = (tab, focus = false) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
    });
    status.textContent = '';
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      selectTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
    });
  });

  // answers typed in one path carry over to the other
  $$('[data-sync]').forEach((el) => {
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      $$(`[data-sync="${el.dataset.sync}"]`).forEach((other) => { if (other !== el) other.value = el.value; });
    });
  });
  $$('[data-sync-group] input').forEach((input) => {
    input.addEventListener('change', () => {
      $$(`[data-sync-group] input[value="${CSS.escape(input.value)}"]`).forEach((other) => { other.checked = input.checked; });
    });
  });

  const setSelect = (sync, value) => {
    $$(`select[data-sync="${sync}"]`).forEach((sel) => {
      if ([...sel.options].some((o) => o.value === value)) sel.value = value;
    });
  };

  // "Explore" on an occasion: show matching creations and remember the occasion
  $$('[data-filter-link]').forEach((link) => {
    link.addEventListener('click', () => {
      applyFilter(link.dataset.filterLink);
      if (link.dataset.occasion) setSelect('occasion', link.dataset.occasion);
    });
  });

  // "Plan My Gift" on a gift type: open the detailed path with that gift ticked
  $$('[data-product]').forEach((link) => {
    link.addEventListener('click', () => {
      selectTab($('#tab-know'));
      const box = $$('input[name="products"]', formKnow).find((i) => i.value === link.dataset.product);
      if (box) box.checked = true;
    });
  });

  // Budget picker: pre-fills the WhatsApp message and both forms
  const budgetCta = $('#budget-cta');
  $$('input[name="budget-pick"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const value = radio.value;
      const line = value === 'Custom budget' ? 'I have a custom budget in mind' : value;
      budgetCta.href = waUrl(`Hi The Pastelist! 💜 I'd like to build a gift around my budget.\n\nBudget: ${line}\nOccasion:\nFor:`);
      setSelect('budget', value);
    });
  });

  // date picker can't go into the past
  const dateInput = $('#k-date');
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  dateInput.min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const validPhone = (v) => { const d = v.replace(/\D/g, ''); return d.length >= 10 && d.length <= 15; };
  const rules = {
    'form-help': [['h-occasion', (v) => v !== ''], ['h-phone', validPhone]],
    'form-know': [['k-name', (v) => v.trim().length > 1], ['k-phone', validPhone], ['k-occasion', (v) => v !== '']],
  };

  const showError = (el, bad) => {
    const err = $(`#${el.id}-err`);
    el.setAttribute('aria-invalid', String(bad));
    err.hidden = !bad;
    if (bad) el.setAttribute('aria-describedby', err.id);
    else el.removeAttribute('aria-describedby');
  };

  Object.entries(rules).forEach(([, list]) => list.forEach(([id, test]) => {
    const el = $(`#${id}`);
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (el.getAttribute('aria-invalid') === 'true') showError(el, !test(el.value));
    });
  }));

  const validate = (form) => {
    let firstBad = null;
    rules[form.id].forEach(([id, test]) => {
      const el = $(`#${id}`);
      const bad = !test(el.value);
      showError(el, bad);
      if (bad && !firstBad) firstBad = el;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  };

  const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(`${value}T00:00:00`);
    const part = (opt) => d.toLocaleDateString('en-IN', opt);
    return `${part({ weekday: 'short' })}, ${d.getDate()} ${part({ month: 'short' })} ${d.getFullYear()}`; // Mon, 12 Oct 2026
  };

  const bullets = (pairs) => pairs
    .map(([label, value]) => [label, String(value || '').trim()])
    .filter(([, value]) => value)
    .map(([label, value]) => `• ${label}: ${value}`)
    .join('\n');

  const optionText = (select) => select.selectedOptions[0]?.value ? select.value : '';

  const messageFor = (form) => {
    const data = new FormData(form);
    if (form === formHelp) {
      return `Hi The Pastelist! 💜 I need help choosing a gift.\n\n${bullets([
        ['Occasion', optionText($('#h-occasion'))],
        ['For', data.get('recipient')],
        ['Budget', optionText($('#h-budget'))],
        ['My WhatsApp', data.get('phone')],
      ])}\n\nCould you suggest a few ideas? (Sent from the website)`;
    }
    return `Hi The Pastelist! 💜 I'd like to plan a gift.\n\n${bullets([
      ['Name', data.get('name')],
      ['WhatsApp', data.get('phone')],
      ['Occasion', optionText($('#k-occasion'))],
      ['For', data.get('recipient')],
      ['Looking for', data.getAll('products').join(', ')],
      ['Budget', optionText($('#k-budget'))],
      ['Needed by', formatDate(data.get('date'))],
      ['Deliver to', data.get('location')],
      ['Message & personalisation', data.get('message')],
    ])}\n\n(Sent from the website)`;
  };

  const say = (html) => { status.innerHTML = html; };

  [formHelp, formKnow].forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validate(form)) { say('Please fill in the highlighted fields.'); return; }
      const url = waUrl(messageFor(form));
      say(`Opening WhatsApp… If it didn’t open, <a href="${url}" target="_blank" rel="noopener">send your message here</a>.`);
      // phones (incl. the Instagram in-app browser) hand wa.me links to the WhatsApp app;
      // on computers open WhatsApp Web in a new tab so this page stays open
      if (touchDevice) window.location.href = url;
      else window.open(url, '_blank', 'noopener');
    });
  });

  $('#send-email').addEventListener('click', () => {
    if (!validate(formKnow)) { say('Please fill in the highlighted fields.'); return; }
    const subject = `Gift enquiry: ${$('#k-occasion').value} (${$('#k-name').value.trim()})`;
    const body = messageFor(formKnow).replace(' 💜', '');
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    say(`Opening your email app… or write to us at <a href="mailto:${EMAIL}">${EMAIL}</a>.`);
  });

  // ---- Gallery lightbox (follows the active filter) ------------------------------------------
  const dialog = $('#lightbox');
  if (dialog && typeof dialog.showModal === 'function') {
    const lbImg = $('#lb-img');
    const lbWebp = $('#lb-webp');
    const lbCaption = $('#lb-caption');
    let list = [];
    let index = 0;
    let opener = null;

    const srcset = (name, max, ext) =>
      [480, 800, max].filter((w, i, a) => a.indexOf(w) === i)
        .map((w) => `assets/img/${name}-${w}.${ext} ${w}w`).join(', ');

    const show = (i) => {
      index = (i + list.length) % list.length;
      const item = list[index];
      const name = item.dataset.full;
      const max = Number(item.dataset.w);
      const sizes = '(min-width: 1200px) 1100px, 92vw';
      lbWebp.srcset = srcset(name, max, 'webp');
      lbWebp.sizes = sizes;
      lbImg.srcset = srcset(name, max, 'jpg');
      lbImg.sizes = sizes;
      lbImg.src = `assets/img/${name}-${max}.jpg`;
      lbImg.width = max;
      lbImg.height = Number(item.dataset.h);
      lbImg.alt = $('img', item).alt;
      lbCaption.textContent = item.closest('figure').querySelector('figcaption')?.textContent || '';
    };

    // unlock scrolling and return focus; runs on our close buttons and again on the
    // dialog's own "close" event (Esc key), so it's safe to call twice
    const cleanup = () => {
      document.documentElement.style.overflow = '';
      if (opener) opener.focus();
    };
    const close = () => {
      if (dialog.open) dialog.close();
      cleanup();
    };

    $$('.gallery-item').forEach((item) => item.addEventListener('click', () => {
      list = $$('.gallery-item').filter((b) => !b.closest('.g-item').hidden);
      opener = item;
      show(list.indexOf(item));
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
    }));

    dialog.addEventListener('close', cleanup);
    $('.lb-close', dialog).addEventListener('click', close);
    $('.lb-prev', dialog).addEventListener('click', () => show(index - 1));
    $('.lb-next', dialog).addEventListener('click', () => show(index + 1));
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.tagName === 'FIGURE') close();
    });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
    });

    // swipe on phones
    let startX = 0;
    let startY = 0;
    dialog.addEventListener('touchstart', (e) => {
      startX = e.changedTouches[0].clientX;
      startY = e.changedTouches[0].clientY;
    }, { passive: true });
    dialog.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 60) show(index + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }
})();

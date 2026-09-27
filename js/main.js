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
  window.matchMedia('(min-width: 900px)').addEventListener('change', () => setMenu(false));

  // ---- Reveal on scroll ----------------------------------------------------------
  const revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reducedMotion) {
    revealEls.forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
      el.style.setProperty('--delay', `${Math.min(siblings.indexOf(el), 5) * 80}ms`);
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

  // ---- Floating WhatsApp button: after the hero, hidden while the form is on screen ----
  const waFloat = $('.wa-float');
  const hero = $('.hero');
  const enquire = $('#enquire');
  let pastHero = false;
  let formInView = false;
  const updateFloat = () => waFloat.classList.toggle('is-visible', pastHero && !formInView);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; updateFloat(); }).observe(hero);
    new IntersectionObserver(([e]) => { formInView = e.isIntersecting; updateFloat(); },
      { threshold: 0.15 }).observe(enquire);
  } else {
    waFloat.classList.add('is-visible');
  }

  // ---- Footer year ------------------------------------------------------------------
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  // ---- Enquiry form -----------------------------------------------------------------
  const form = $('#enquiry-form');
  const status = $('#form-status');
  const dateInput = $('#f-date');

  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  dateInput.min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  // "Enquire about …" links tick the matching product in the form
  $$('[data-product]').forEach((link) => {
    link.addEventListener('click', () => {
      const box = $$('input[name="products"]', form).find((i) => i.value === link.dataset.product);
      if (box) box.checked = true;
    });
  });

  const fields = {
    name: { el: $('#f-name'), test: (v) => v.trim().length > 1 },
    phone: { el: $('#f-phone'), test: (v) => { const d = v.replace(/\D/g, ''); return d.length >= 10 && d.length <= 15; } },
    occasion: { el: $('#f-occasion'), test: (v) => v !== '' },
  };

  const showError = (key, bad) => {
    const { el } = fields[key];
    const err = $(`#${el.id}-err`);
    el.setAttribute('aria-invalid', String(bad));
    err.hidden = !bad;
    if (bad) el.setAttribute('aria-describedby', err.id);
    else el.removeAttribute('aria-describedby');
  };

  Object.keys(fields).forEach((key) => {
    const { el, test } = fields[key];
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (el.getAttribute('aria-invalid') === 'true') showError(key, !test(el.value));
    });
  });

  const validate = () => {
    let firstBad = null;
    Object.keys(fields).forEach((key) => {
      const { el, test } = fields[key];
      const bad = !test(el.value);
      showError(key, bad);
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

  const buildMessage = () => {
    const data = new FormData(form);
    const products = data.getAll('products');
    const lines = [
      ['Name', data.get('name')],
      ['Phone', data.get('phone')],
      ['Occasion', data.get('occasion')],
      ['For', data.get('recipient')],
      ['Looking for', products.join(', ')],
      ['Budget', data.get('budget')],
      ['Needed by', formatDate(data.get('date'))],
      ['Deliver to', data.get('location')],
      ['Details', data.get('message')],
    ]
      .map(([label, value]) => [label, String(value || '').trim()])
      .filter(([, value]) => value)
      .map(([label, value]) => `• ${label}: ${value}`);
    return `Hi The Pastelist! 🤍 I'd like to plan a gift.\n\n${lines.join('\n')}\n\n(Sent from the website)`;
  };

  const say = (html) => { status.innerHTML = html; };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) { say('Please fill in the highlighted fields.'); return; }
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(buildMessage())}`;
    say(`Opening WhatsApp… If it didn’t open, <a href="${url}" target="_blank" rel="noopener">send your message here</a>.`);
    // phones (incl. the Instagram in-app browser) hand wa.me links to the WhatsApp app;
    // on computers open WhatsApp Web in a new tab so this page stays open
    if (touchDevice) window.location.href = url;
    else window.open(url, '_blank', 'noopener');
  });

  $('#send-email').addEventListener('click', () => {
    if (!validate()) { say('Please fill in the highlighted fields.'); return; }
    const occasion = $('#f-occasion').value;
    const subject = `Gift enquiry: ${occasion} (${$('#f-name').value.trim()})`;
    const body = buildMessage().replace('🤍 ', '');
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    say(`Opening your email app… or write to us at <a href="mailto:${EMAIL}">${EMAIL}</a>.`);
  });

  // ---- Gallery lightbox ------------------------------------------------------------------
  const dialog = $('#lightbox');
  const items = $$('.gallery-item');
  if (dialog && typeof dialog.showModal === 'function' && items.length) {
    const lbImg = $('#lb-img');
    const lbWebp = $('#lb-webp');
    const lbCaption = $('#lb-caption');
    let index = 0;
    let opener = null;

    const srcset = (name, max, ext) =>
      [480, 800, max].filter((w, i, a) => a.indexOf(w) === i)
        .map((w) => `assets/img/${name}-${w}.${ext} ${w}w`).join(', ');

    const show = (i) => {
      index = (i + items.length) % items.length;
      const item = items[index];
      const name = item.dataset.full;
      const max = Number(item.dataset.w);
      const thumb = $('img', item);
      const sizes = '(min-width: 1200px) 1100px, 92vw';
      lbWebp.srcset = srcset(name, max, 'webp');
      lbWebp.sizes = sizes;
      lbImg.srcset = srcset(name, max, 'jpg');
      lbImg.sizes = sizes;
      lbImg.src = `assets/img/${name}-${max}.jpg`;
      lbImg.width = max;
      lbImg.height = Number(item.dataset.h);
      lbImg.alt = thumb.alt;
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

    items.forEach((item, i) => item.addEventListener('click', () => {
      opener = item;
      show(i);
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

/* Whiteberry — storefront: shop grid, product quick view, bag, checkout, order confirmation.
   No dependencies. Data: products.js · Settings: config.js
   Orders are saved in the browser and sent to the shop on WhatsApp / email (or paid via Razorpay if a key is set).
   There is no server, so nothing is stored centrally — see README for adding one. */
(() => {
  'use strict';
  const C = Object.assign({ currency: 'INR', locale: 'en-IN', shippingFlat: 0, freeShippingOver: 0, payWhatsApp: true, cod: false, razorpayKey: '', sizes: ['S', 'M', 'L', 'XL', 'Custom'] }, window.WB_CONFIG || {});
  const PRODUCTS = window.WB_PRODUCTS || [];
  const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
  const TYPE = { half: 'Half saree', skirt: 'Skirt set', anarkali: 'Anarkali set', kurta: 'Kurta set' };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = new Intl.NumberFormat(C.locale, { style: 'currency', currency: C.currency, maximumFractionDigits: 0 });
  const money = (n) => fmt.format(n);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  const bagBtn = $('#bagBtn');
  /* ───────────────── bag state ───────────────── */
  let bag = store.get('wb-bag-v1', []).filter((l) => byId[l.id]);
  const saveBag = () => { store.set('wb-bag-v1', bag); updateBagUI(); };
  const lineKey = (l) => l.id + '|' + l.size;
  const count = () => bag.reduce((n, l) => n + l.qty, 0);
  const subtotal = () => bag.reduce((n, l) => n + byId[l.id].price * l.qty, 0);
  const shipping = (sub) => (!sub || (C.freeShippingOver && sub >= C.freeShippingOver) ? 0 : C.shippingFlat);
  function addToBag(id, size, qty) {
    const l = bag.find((x) => x.id === id && x.size === size);
    if (l) l.qty = Math.min(10, l.qty + qty); else bag.push({ id, size, qty });
    saveBag();
    bagBtn.classList.remove('bump'); void bagBtn.offsetWidth; bagBtn.classList.add('bump');
  }
  addEventListener('storage', (e) => { if (e.key === 'wb-bag-v1') { bag = store.get('wb-bag-v1', []).filter((l) => byId[l.id]); updateBagUI(); } });

  /* ───────────────── dialogs (built once) ───────────────── */
  const closeBtn = '<button type="button" class="x" data-close aria-label="Close"><i></i><i></i></button>';
  document.body.insertAdjacentHTML('beforeend', `
  <dialog class="pdp" id="pdp" aria-label="Product"></dialog>
  <dialog class="drawer" id="cartDlg" aria-label="Shopping bag">
    <div class="dr-head"><h2>Your bag <i id="cartN"></i></h2>${closeBtn}</div>
    <div class="ship" id="shipBar"><p></p><span><i></i></span></div>
    <ul class="dr-list" id="cartList"></ul>
    <div class="dr-empty" id="cartEmpty"><p>Your bag is empty.</p><a class="link" href="#shop" data-close><span>Browse the collection</span><svg class="arr"><use href="#arrow"/></svg></a></div>
    <div class="dr-foot" id="cartFoot">
      <dl class="tot"><div><dt>Subtotal</dt><dd id="tSub"></dd></div><div><dt>Shipping</dt><dd id="tShip"></dd></div><div class="grand"><dt>Total</dt><dd id="tTot"></dd></div></dl>
      <button type="button" class="btn btn--solid btn--full" id="goCheckout"><span>Checkout</span></button>
      <p class="dr-note">Every piece is made to measure — we confirm sizes and timelines with you after you order.</p>
    </div>
  </dialog>
  <dialog class="co" id="coDlg" aria-label="Checkout"></dialog>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>`);
  const pdp = $('#pdp'), cartDlg = $('#cartDlg'), coDlg = $('#coDlg');
  const dialogs = [pdp, cartDlg, coDlg];
  function openDlg(d) {
    dialogs.forEach((x) => { if (x !== d && x.open) x.close(); });
    if (!d.open) d.showModal();
    document.body.style.overflow = 'hidden';
  }
  dialogs.forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
    d.addEventListener('close', () => {
      if (!dialogs.some((x) => x.open)) document.body.style.overflow = '';
      if (d === pdp && /^#product=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    });
  });
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
  }

  /* ───────────────── header bag button ───────────────── */
  function updateBagUI() {
    const n = count();
    const b = $('.bag-n', bagBtn);
    b.textContent = n; bagBtn.classList.toggle('has', n > 0);
    bagBtn.setAttribute('aria-label', `Open bag, ${n} item${n === 1 ? '' : 's'}`);
    renderCart();
  }
  bagBtn.addEventListener('click', () => { renderCart(); openDlg(cartDlg); });

  /* ───────────────── shop grid ───────────────── */
  const state = { cat: 'all', colour: 'all', sort: 'featured' };
  const grid = $('#shopGrid');
  const cats = window.WB_CATS || [], cols = window.WB_COLOURS || [];
  $('#shopTabs').innerHTML = cats.map(([k, l]) => `<button type="button" role="tab" class="tab${k === 'all' ? ' is-on' : ''}" data-cat="${k}" aria-selected="${k === 'all'}">${l}<i>${k === 'all' ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === k).length}</i></button>`).join('');
  $('#shopSwatches').innerHTML = cols.map(([k, l, c]) => `<button type="button" class="sw${k === 'all' ? ' is-on' : ''}" data-filter="${k}" title="${l}" aria-label="${l}"><i style="--c:${c}"></i><span>${l}</span></button>`).join('');

  function card(p, i) {
    const off = p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
    return `<article class="piece" data-id="${p.id}" style="--d:${((i % 4) * 0.07).toFixed(2)}">
      <a class="piece-media frame" href="#product=${p.id}" data-open="${p.id}" aria-label="${esc(p.name)} — view details">
        <img class="base" src="${p.img[0]}" alt="${esc(p.name)}" width="760" height="1000" loading="lazy">${p.img[1] ? `<img class="swap" src="${p.img[1]}" alt="" loading="lazy">` : ''}
        ${off ? `<span class="badge-off">${off}% off</span>` : ''}
        <span class="quick">Choose size</span>
      </a>
      <div class="piece-info">
        <p class="tag">${TYPE[p.cat] || ''}</p>
        <h3><a href="#product=${p.id}" data-open="${p.id}">${esc(p.name)}</a></h3>
        <p class="price"><b>${money(p.price)}</b>${off ? `<s>${money(p.mrp)}</s>` : ''}</p>
        <div class="piece-foot"><span class="dots">${(p.swatch || []).map((c) => `<i style="--c:${c}"></i>`).join('')}</span>
          <button type="button" class="link link--btn" data-quick="${p.id}"><span>Add to bag</span><svg class="arr"><use href="#arrow"/></svg></button></div>
      </div>
    </article>`;
  }
  function renderGrid(animate) {
    let list = PRODUCTS.filter((p) => (state.cat === 'all' || p.cat === state.cat) && (state.colour === 'all' || p.colors.includes(state.colour)));
    if (state.sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
    if (state.sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
    grid.innerHTML = list.map(card).join('');
    $('#shopEmpty').hidden = list.length > 0;
    $('#shopCount').textContent = `${list.length} piece${list.length === 1 ? '' : 's'}`;
    requestAnimationFrame(() => $$('.piece', grid).forEach((el) => {
      $$('.frame', el).forEach((f) => f.classList.add('in'));
      el.classList.add('in'); if (animate) el.classList.add('pop');
    }));
  }
  function setCat(cat, animate = true) {
    state.cat = cat;
    $$('#shopTabs .tab').forEach((t) => { const on = t.dataset.cat === cat; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', on); });
    renderGrid(animate);
  }
  $('#shopTabs').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) setCat(t.dataset.cat); });
  $('#shopSwatches').addEventListener('click', (e) => {
    const s = e.target.closest('.sw'); if (!s) return;
    state.colour = s.dataset.filter;
    $$('#shopSwatches .sw').forEach((x) => x.classList.toggle('is-on', x === s));
    renderGrid(true);
  });
  $('#shopSort').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(true); });
  $('#shopClear').addEventListener('click', () => {
    state.colour = 'all'; $$('#shopSwatches .sw').forEach((x) => x.classList.toggle('is-on', x.dataset.filter === 'all')); setCat('all');
  });
  // collection cards elsewhere on the page jump here with the type preselected
  $$('#collections a[data-cat]').forEach((a) => a.addEventListener('click', () => setCat(a.dataset.cat)));

  grid.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]'); const q = e.target.closest('[data-quick]');
    if (o) { e.preventDefault(); openProduct(o.dataset.open); }
    else if (q) openProduct(q.dataset.quick);
  });

  /* ───────────────── product quick view ───────────────── */
  function openProduct(id, push = true) {
    const p = byId[id]; if (!p) return;
    const off = p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
    let size = '', qty = 1;
    const imgs = p.img;
    pdp.innerHTML = `${closeBtn}
      <div class="pdp-in">
        <div class="pdp-gal">
          <div class="pdp-main frame in"><img id="pdpMain" src="${imgs[0]}" alt="${esc(p.name)}"></div>
          ${imgs.length > 1 ? `<div class="pdp-th">${imgs.map((s, i) => `<button type="button" class="${i ? '' : 'on'}" data-img="${s}" aria-label="Photo ${i + 1}"><img src="${s}" alt=""></button>`).join('')}</div>` : ''}
        </div>
        <div class="pdp-info">
          <p class="tag">${TYPE[p.cat] || ''}</p>
          <h2>${esc(p.name)}</h2>
          <p class="price price--lg"><b>${money(p.price)}</b>${off ? `<s>${money(p.mrp)}</s><em>${off}% off</em>` : ''}</p>
          <p class="pdp-d">${esc(p.desc)}</p>
          ${p.includes ? `<p class="pdp-inc"><span>Includes</span>${p.includes.map(esc).join(' · ')}</p>` : ''}
          <div class="pdp-sz"><p class="lab">Size <a href="#contact" class="sg" data-close>Need help? Ask us</a></p>
            <div class="sizes" id="pdpSizes" role="radiogroup" aria-label="Size">${C.sizes.map((s) => `<button type="button" role="radio" aria-checked="false" data-size="${s}">${s === 'Custom' ? 'Made to measure' : s}</button>`).join('')}</div>
            <p class="sz-note" id="szNote">Choose “Made to measure” and we’ll take your measurements on WhatsApp.</p></div>
          <div class="pdp-buy">
            <div class="qty" aria-label="Quantity"><button type="button" data-q="-1" aria-label="Fewer">−</button><output id="pdpQ">1</output><button type="button" data-q="1" aria-label="More">+</button></div>
            <button type="button" class="btn btn--solid" id="pdpAdd"><span>Add to bag — <b id="pdpPrice">${money(p.price)}</b></span></button>
          </div>
          <ul class="pdp-perks"><li>Stitched to your measure</li><li>${C.freeShippingOver ? `Free shipping over ${money(C.freeShippingOver)}` : 'Shipping across India'}</li><li>Questions? We reply on WhatsApp</li></ul>
        </div>
      </div>`;
    const sizes = $('#pdpSizes', pdp);
    sizes.addEventListener('click', (e) => {
      const b = e.target.closest('[data-size]'); if (!b) return;
      size = b.dataset.size; sizes.classList.remove('err');
      $$('[data-size]', sizes).forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
    });
    $('.pdp-in', pdp).addEventListener('click', (e) => {
      const t = e.target.closest('[data-img]');
      if (t) { $('#pdpMain', pdp).src = t.dataset.img; $$('.pdp-th button', pdp).forEach((x) => x.classList.toggle('on', x === t)); }
      const q = e.target.closest('[data-q]');
      if (q) { qty = Math.min(10, Math.max(1, qty + +q.dataset.q)); $('#pdpQ', pdp).textContent = qty; $('#pdpPrice', pdp).textContent = money(p.price * qty); }
    });
    $('#pdpAdd', pdp).addEventListener('click', () => {
      if (!size) { sizes.classList.add('err'); $('#szNote', pdp).textContent = 'Please choose a size to continue.'; sizes.scrollIntoView({ block: 'nearest' }); return; }
      addToBag(id, size, qty);
      pdp.close(); renderCart(); openDlg(cartDlg);
    });
    openDlg(pdp);
    if (push) history.replaceState(null, '', '#product=' + id);
  }
  const fromHash = () => { const m = /^#product=([\w-]+)/.exec(location.hash); if (m && byId[m[1]]) openProduct(m[1], false); };
  addEventListener('hashchange', fromHash);

  /* ───────────────── bag drawer ───────────────── */
  function renderCart() {
    const n = count(), sub = subtotal(), ship = shipping(sub);
    $('#cartN').textContent = n ? `(${n})` : '';
    $('#cartEmpty').hidden = n > 0; $('#cartFoot').hidden = n === 0; $('#shipBar').hidden = n === 0;
    $('#cartList').innerHTML = bag.map((l) => {
      const p = byId[l.id];
      return `<li data-k="${esc(lineKey(l))}"><img src="${p.img[0]}" alt="" width="84" height="110">
        <div><h3>${esc(p.name)}</h3><p class="meta">${l.size === 'Custom' ? 'Made to measure' : 'Size ' + esc(l.size)}</p>
          <div class="row"><div class="qty qty--sm"><button type="button" data-act="dec" aria-label="Fewer">−</button><output>${l.qty}</output><button type="button" data-act="inc" aria-label="More">+</button></div>
          <b>${money(p.price * l.qty)}</b></div></div>
        <button type="button" class="rm" data-act="rm" aria-label="Remove ${esc(p.name)}">Remove</button></li>`;
    }).join('');
    $('#tSub').textContent = money(sub);
    $('#tShip').textContent = ship ? money(ship) : (sub ? 'Free' : '—');
    $('#tTot').textContent = money(sub + ship);
    const bar = $('#shipBar'); const need = C.freeShippingOver - sub;
    if (C.freeShippingOver) {
      $('p', bar).textContent = need > 0 ? `Add ${money(need)} more for free shipping` : 'You’ve unlocked free shipping ✓';
      $('i', bar).style.width = Math.min(100, (sub / C.freeShippingOver) * 100) + '%';
    } else bar.hidden = true;
  }
  $('#cartList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const k = b.closest('li').dataset.k; const l = bag.find((x) => lineKey(x) === k); if (!l) return;
    if (b.dataset.act === 'inc') l.qty = Math.min(10, l.qty + 1);
    if (b.dataset.act === 'dec') l.qty = Math.max(1, l.qty - 1);
    if (b.dataset.act === 'rm') bag = bag.filter((x) => x !== l);
    saveBag();
  });
  $('#goCheckout').addEventListener('click', () => { if (bag.length) { renderCheckout(); openDlg(coDlg); } });

  /* ───────────────── checkout ───────────────── */
  const methods = () => {
    const m = [];
    if (C.payWhatsApp !== false) m.push(['whatsapp', 'Confirm on WhatsApp', 'We message you a payment link / UPI details to complete the order.']);
    if (C.razorpayKey) m.push(['razorpay', 'Pay online now', 'UPI, cards, netbanking & wallets via Razorpay.']);
    if (C.cod) m.push(['cod', 'Cash on delivery', 'Pay when your order arrives.']);
    return m.length ? m : [['whatsapp', 'Confirm on WhatsApp', 'We message you to complete the order.']];
  };
  function summaryHTML() {
    const sub = subtotal(), ship = shipping(sub);
    return `<ul class="co-items">${bag.map((l) => { const p = byId[l.id]; return `<li><span class="th"><img src="${p.img[0]}" alt=""><i>${l.qty}</i></span><span class="nm">${esc(p.name)}<small>${l.size === 'Custom' ? 'Made to measure' : 'Size ' + esc(l.size)}</small></span><b>${money(p.price * l.qty)}</b></li>`; }).join('')}</ul>
      <dl class="tot"><div><dt>Subtotal</dt><dd>${money(sub)}</dd></div><div><dt>Shipping</dt><dd>${ship ? money(ship) : 'Free'}</dd></div><div class="grand"><dt>Total</dt><dd>${money(sub + ship)}</dd></div></dl>`;
  }
  function renderCheckout() {
    const saved = store.get('wb-customer', {});
    const m = methods();
    coDlg.innerHTML = `${closeBtn}
      <div class="co-in">
        <form class="co-form" id="coForm" novalidate>
          <p class="kicker"><i></i>Checkout</p>
          <h2>Delivery details</h2>
          <div class="co-grid">
            <div class="field"><input id="c-name" name="name" placeholder=" " autocomplete="name" required value="${esc(saved.name || '')}"><label for="c-name">Full name *</label></div>
            <div class="field"><input id="c-phone" name="phone" type="tel" placeholder=" " autocomplete="tel" required value="${esc(saved.phone || '')}"><label for="c-phone">Phone / WhatsApp *</label></div>
            <div class="field field--full"><input id="c-email" name="email" type="email" placeholder=" " autocomplete="email" value="${esc(saved.email || '')}"><label for="c-email">Email (optional)</label></div>
            <div class="field field--full"><input id="c-addr" name="address" placeholder=" " autocomplete="street-address" required value="${esc(saved.address || '')}"><label for="c-addr">Address *</label></div>
            <div class="field"><input id="c-city" name="city" placeholder=" " autocomplete="address-level2" required value="${esc(saved.city || '')}"><label for="c-city">City *</label></div>
            <div class="field"><input id="c-pin" name="pin" inputmode="numeric" placeholder=" " autocomplete="postal-code" required value="${esc(saved.pin || '')}"><label for="c-pin">Pincode *</label></div>
            <div class="field field--full"><input id="c-note" name="note" placeholder=" "><label for="c-note">Note — occasion date, measurements, colour change…</label></div>
          </div>
          <h2 class="h2s">Payment</h2>
          <div class="pay" role="radiogroup">${m.map(([k, t, d], i) => `<label class="pay-o"><input type="radio" name="pay" value="${k}"${i === 0 ? ' checked' : ''}><span><b>${t}</b><small>${d}</small></span></label>`).join('')}</div>
          <p class="co-err" id="coErr" role="alert"></p>
          <button class="btn btn--solid btn--full" type="submit" id="coGo"><span>Place order</span></button>
        </form>
        <aside class="co-sum"><h2>Order summary</h2>${summaryHTML()}</aside>
      </div>`;
    $('#coForm', coDlg).addEventListener('submit', onPlaceOrder);
    $('#coForm', coDlg).addEventListener('input', () => { $('#coErr', coDlg).textContent = ''; $$('.field.bad', coDlg).forEach((x) => x.classList.remove('bad')); });
  }

  function orderText(o) {
    const lines = o.items.map((l, i) => `${i + 1}. ${l.name} — ${l.size === 'Custom' ? 'Made to measure' : 'Size ' + l.size} × ${l.qty} — ${money(l.price * l.qty)}`);
    return [`New Whiteberry order ${o.id}`, '', `Name: ${o.customer.name}`, `Phone: ${o.customer.phone}`, o.customer.email ? `Email: ${o.customer.email}` : null,
      `Address: ${o.customer.address}, ${o.customer.city} ${o.customer.pin}`, '', 'Items:', ...lines, '',
      `Subtotal: ${money(o.subtotal)}`, `Shipping: ${o.shipping ? money(o.shipping) : 'Free'}`, `Total: ${money(o.total)}`, `Payment: ${o.payLabel}`,
      o.customer.note ? `Note: ${o.customer.note}` : null].filter((x) => x !== null).join('\n');
  }
  const waUrl = (text) => 'https://wa.me/' + String(C.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
  const mailUrl = (o, text) => 'mailto:' + C.email + '?subject=' + encodeURIComponent('Whiteberry order ' + o.id) + '&body=' + encodeURIComponent(text);

  function onPlaceOrder(e) {
    e.preventDefault();
    const f = e.target; const d = Object.fromEntries(new FormData(f));
    const err = $('#coErr', coDlg);
    $$('.field', f).forEach((x) => x.classList.remove('bad'));
    const need = [['name', 'your name'], ['phone', 'a phone number'], ['address', 'your address'], ['city', 'your city'], ['pin', 'your pincode']];
    for (const [k, label] of need) {
      if (!String(d[k] || '').trim()) { err.textContent = `Please enter ${label}.`; $(`[name="${k}"]`, f).closest('.field').classList.add('bad'); $(`[name="${k}"]`, f).focus(); return; }
    }
    if (String(d.phone).replace(/\D/g, '').length < 10) { err.textContent = 'Please enter a valid phone number.'; $('[name="phone"]', f).focus(); return; }
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) { err.textContent = 'That email doesn’t look right.'; $('[name="email"]', f).focus(); return; }
    err.textContent = '';
    const sub = subtotal(), ship = shipping(sub);
    const m = methods().find(([k]) => k === d.pay) || methods()[0];
    const o = {
      id: 'WB-' + Date.now().toString(36).toUpperCase().slice(-6), at: new Date().toISOString(), pay: m[0], payLabel: m[1],
      customer: { name: d.name.trim(), phone: d.phone.trim(), email: (d.email || '').trim(), address: d.address.trim(), city: d.city.trim(), pin: d.pin.trim(), note: (d.note || '').trim() },
      items: bag.map((l) => ({ id: l.id, name: byId[l.id].name, size: l.size, qty: l.qty, price: byId[l.id].price })), subtotal: sub, shipping: ship, total: sub + ship
    };
    store.set('wb-customer', { name: o.customer.name, phone: o.customer.phone, email: o.customer.email, address: o.customer.address, city: o.customer.city, pin: o.customer.pin });
    const go = $('#coGo', f); go.disabled = true;

    if (m[0] === 'razorpay') {
      loadRazorpay().then(() => {
        const rz = new window.Razorpay({
          key: C.razorpayKey, amount: o.total * 100, currency: C.currency, name: 'Whiteberry', description: 'Order ' + o.id,
          prefill: { name: o.customer.name, contact: o.customer.phone, email: o.customer.email }, theme: { color: '#0E1546' },
          handler: (r) => { o.payLabel = 'Paid online (Razorpay ' + r.razorpay_payment_id + ')'; o.paymentId = r.razorpay_payment_id; finishOrder(o, false); },
          modal: { ondismiss: () => { go.disabled = false; } }
        });
        rz.on('payment.failed', () => { err.textContent = 'Payment didn’t go through. Please try again or choose another method.'; go.disabled = false; });
        rz.open();
      }).catch(() => { err.textContent = 'Couldn’t load the payment window. Check your connection, or choose another method.'; go.disabled = false; });
      return;
    }
    finishOrder(o, m[0] === 'whatsapp' && !!C.whatsapp);
  }
  let rzP;
  function loadRazorpay() {
    if (window.Razorpay) return Promise.resolve();
    return rzP || (rzP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = res; s.onerror = () => { rzP = null; rej(); }; document.head.append(s); }));
  }

  function finishOrder(o, autoWhatsApp) {
    store.set('wb-orders', [o, ...store.get('wb-orders', [])].slice(0, 20));
    bag = []; saveBag();
    const text = orderText(o);
    if (autoWhatsApp) window.open(waUrl(text), '_blank', 'noopener');
    const next = o.pay === 'razorpay' ? 'Your payment is received. We’ll confirm your measurements and delivery date shortly.' :
      o.pay === 'cod' ? 'We’ll call or message you to confirm your order, measurements and delivery date. Pay when it arrives.' :
        'We’ll message you on WhatsApp with a payment link / UPI details and to confirm your measurements.';
    const send = C.whatsapp ? `<a class="btn btn--solid" href="${waUrl(text)}" target="_blank" rel="noopener"><span>${autoWhatsApp ? 'Re-open WhatsApp' : 'Send order on WhatsApp'}</span></a>`
      : C.email ? `<a class="btn btn--solid" href="${mailUrl(o, text)}"><span>Email this order</span></a>`
        : `<button type="button" class="btn btn--solid" id="copyOrder"><span>Copy order details</span></button>`;
    coDlg.innerHTML = `${closeBtn}
      <div class="co-done">
        <svg class="tick" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="32" r="28" pathLength="1"/><path d="M20 33l8 8 16-18" pathLength="1"/></svg>
        <p class="kicker kicker--c"><i></i>Thank you, ${esc(o.customer.name.split(' ')[0])}<i></i></p>
        <h2>Order ${o.id} received</h2>
        <p class="lead">${next}</p>
        <div class="co-sum co-sum--done"><ul class="co-items">${o.items.map((l) => `<li><span class="nm">${esc(l.name)}<small>${l.size === 'Custom' ? 'Made to measure' : 'Size ' + esc(l.size)} × ${l.qty}</small></span><b>${money(l.price * l.qty)}</b></li>`).join('')}</ul>
          <dl class="tot"><div class="grand"><dt>Total</dt><dd>${money(o.total)}</dd></div></dl></div>
        <div class="done-act">${send}<button type="button" class="link" data-close><span>Continue shopping</span><svg class="arr"><use href="#arrow"/></svg></button></div>
        ${!C.whatsapp && !C.email ? '<p class="owner-note">Shop owner: add your WhatsApp number or email in <code>config.js</code> so orders reach you.</p>' : ''}
      </div>`;
    const cp = $('#copyOrder', coDlg);
    if (cp) cp.addEventListener('click', () => { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Order details copied'), () => toast('Select and copy the order from your bag history')); });
  }

  /* contact form: list the pieces */
  (function () {
    const sel = $('#f-piece'); if (!sel) return;
    const custom = sel.lastElementChild;
    PRODUCTS.forEach((p) => { const o = document.createElement('option'); o.textContent = p.name; sel.insertBefore(o, custom); });
  })();

  /* ───────────────── start ───────────────── */
  renderGrid(false);
  updateBagUI();
  fromHash();
})();

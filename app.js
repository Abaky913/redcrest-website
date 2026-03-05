// Redcrest Foods v6 — Application Logic
'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// ① GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════════
let _currentUser      = null; // { id, email, firstName, name, emailVerified }
let _currentLoyalty   = null; // { total_jars, free_jars }
let _pendingCardId    = null;
let _pendingCardDisc  = 0;
let _screenshotFile   = null;
let _selectedPayMethod = 'bank';
let _deviceId         = localStorage.getItem('rc_device_id') ||
                        (()=>{ const id = crypto.randomUUID(); localStorage.setItem('rc_device_id',id); return id; })();

// ═══════════════════════════════════════════════════════════════════════════════
// ② UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** XSS-safe HTML sanitizer — only for content that must render HTML */
function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Set text content safely — never use innerHTML for user data */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? '');
}

function currentUser() { return _currentUser; }

function checkRateLimit(action, intervalMs, bypass = false) {
  if (bypass) return true;
  const key     = `rc_rl_${action}_${_deviceId}`;
  const lastStr = localStorage.getItem(key);
  const now     = Date.now();
  if (lastStr) {
    const elapsed = now - parseInt(lastStr, 10);
    if (elapsed < intervalMs) {
      const remaining = Math.ceil((intervalMs - elapsed) / 1000);
      showToast(`⏳ Please wait ${remaining}s before trying again.`, 'warn');
      return false;
    }
  }
  localStorage.setItem(key, String(now));
  return true;
}

function clearRateLimit(action) {
  localStorage.removeItem(`rc_rl_${action}_${_deviceId}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ③ TOAST NOTIFICATION
// ═══════════════════════════════════════════════════════════════════════════════
let _toastTimer = null;

function showToast(msg, type = 'info', retryFn = null) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(_toastTimer);
  toast.className = `toast toast--${type} show`;
  const msgEl = toast.querySelector('.toast-msg');
  if (msgEl) msgEl.textContent = msg;
  const retryBtn = toast.querySelector('.toast-retry');
  if (retryBtn) {
    retryBtn.hidden = !retryFn;
    if (retryFn) {
      retryBtn.onclick = () => { hideToast(); retryFn(); };
    }
  }
  toast.setAttribute('aria-live', 'polite');
  _toastTimer = setTimeout(hideToast, retryFn ? 8000 : 3500);
}

function hideToast() {
  const toast = document.getElementById('toast');
  if (toast) toast.classList.remove('show');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ④ MODAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let _lastFocused = null;

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  _lastFocused = document.activeElement;
  modal.removeAttribute('hidden');
  modal.setAttribute('aria-modal', 'true');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    const firstInput = modal.querySelector('input:not([disabled]),select:not([disabled]),button:not([disabled])');
    if (firstInput) firstInput.focus();
    else { const f = modal.querySelector(FOCUSABLE); if (f) f.focus(); }
  });
  modal.addEventListener('keydown', trapFocus);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.setAttribute('hidden', '');
  modal.removeAttribute('aria-modal');
  document.body.style.overflow = '';
  modal.removeEventListener('keydown', trapFocus);
  if (_lastFocused) { _lastFocused.focus(); _lastFocused = null; }
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const modal     = e.currentTarget;
  const focusable = Array.from(modal.querySelectorAll(FOCUSABLE)).filter(el => !el.closest('[hidden]'));
  if (!focusable.length) { e.preventDefault(); return; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['authModal','dashModal','scratchModal','faqModal','legalModal'].forEach(id => {
      const m = document.getElementById(id);
      if (m && !m.hasAttribute('hidden')) closeModal(id);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ⑤ LOADING SPINNER
// ═══════════════════════════════════════════════════════════════════════════════
function setSpinner(btn, on, label = '') {
  if (!btn) return;
  btn.disabled = on;
  const sp = btn.querySelector('.spinner');
  const tx = btn.querySelector('.btn-label');
  if (sp) sp.hidden = !on;
  if (tx && label) tx.textContent = label;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑥ AUTH FLOWS
// ═══════════════════════════════════════════════════════════════════════════════
function showAuthTab(tab) {
  const loginPanel    = document.getElementById('loginPanel');
  const registerPanel = document.getElementById('registerPanel');
  const tabs          = document.querySelectorAll('.modal-tab');
  loginPanel.hidden    = tab !== 'login';
  registerPanel.hidden = tab !== 'register';
  tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.tab === tab ? 'true' : 'false'));
}

async function handleLogin(e) {
  e.preventDefault();
  const btn   = document.getElementById('loginBtn');
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');

  errEl.textContent = '';
  if (!email || !pass) { errEl.textContent = 'Please fill in all fields.'; return; }

  setSpinner(btn, true, 'Signing in…');
  try {
    const { data, error } = await db_signIn(email, pass);
    if (error) throw error;
    await restoreSession(data.session);
    closeModal('authModal');
    showToast('✓ Welcome back, ' + (_currentUser?.firstName || 'friend') + '!', 'success');
  } catch (err) {
    errEl.textContent = err.message || 'Login failed. Please try again.';
  } finally {
    setSpinner(btn, false, 'Sign In');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn   = document.getElementById('registerBtn');
  const first = document.getElementById('regFirst').value.trim();
  const last  = document.getElementById('regLast').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPass').value;
  const errEl = document.getElementById('registerError');

  errEl.textContent = '';
  if (!first || !last || !email || !pass) { errEl.textContent = 'Please fill in all fields.'; return; }
  if (pass.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
  if (pass.length > 72) { errEl.textContent = 'Password is too long.'; return; }

  setSpinner(btn, true, 'Creating account…');
  try {
    const { data, error } = await db_signUp(email, pass);
    if (error) throw error;
    if (!data.user) throw new Error('Account could not be created. This email may already be registered.');

    const uid         = data.user.id;
    const isConfirmed = !!(data.user.email_confirmed_at || data.user.confirmed_at);
    await db_upsertProfile(uid, first, last, '');
    await db_upsertLoyalty(uid, 0, 0);

    _currentUser = {
      id: uid, email, firstName: first,
      name: first + ' ' + last,
      emailVerified: isConfirmed,
    };

    closeModal('authModal');
    updateNavAuth();

    if (!isConfirmed) {
      showVerifyNotice(email);
    } else {
      showToast('✓ Account created! Welcome, ' + first + '!', 'success');
    }
  } catch (err) {
    errEl.textContent = err.message || 'Registration failed. Please try again.';
  } finally {
    setSpinner(btn, false, 'Create Account');
  }
}

function showVerifyNotice(email) {
  const zone = document.getElementById('verifyNoticeZone');
  if (!zone) return;
  zone.hidden = false;
  const emailSpan = zone.querySelector('.verify-email');
  if (emailSpan) emailSpan.textContent = email;
  const resendBtn = zone.querySelector('.verify-resend');
  if (resendBtn) {
    resendBtn.onclick = async () => {
      if (!checkRateLimit('resend', CONFIG.rateLimits.resend)) return;
      const { error } = await db_resendVerification(email);
      if (error) showToast('Could not resend. Try again shortly.', 'error');
      else showToast('✓ Verification email sent to ' + email, 'success');
    };
  }
}

async function handleSignOut() {
  await db_signOut();
  _currentUser    = null;
  _currentLoyalty = null;
  _pendingCardId  = null;
  _pendingCardDisc = 0;
  updateNavAuth();
  clearOrderRewards();
  showToast('Signed out.', 'info');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑦ SESSION RESTORE
// ═══════════════════════════════════════════════════════════════════════════════
async function restoreSession(session) {
  if (!session) {
    _currentUser    = null;
    _currentLoyalty = null;
    updateNavAuth();
    return;
  }
  const uid         = session.user.id;
  const email       = session.user.email;
  const isConfirmed = !!(session.user.email_confirmed_at || session.user.confirmed_at);
  const [prof, loy] = await Promise.all([db_getProfile(uid), db_getLoyalty(uid)]);
  _currentUser = {
    id: uid, email,
    firstName: prof?.first_name || email.split('@')[0],
    name: prof ? prof.first_name + ' ' + prof.last_name : email,
    emailVerified: isConfirmed,
  };
  _currentLoyalty = { total_jars: loy.total_jars, free_jars: loy.free_jars };
  updateNavAuth();
  await autoApplyRewards();
}

// ─── onAuthStateChange: single source of truth ───────────────────────────────
function initAuth() {
  getClient().auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      await restoreSession(session);
    } else if (event === 'SIGNED_OUT' || !session) {
      _currentUser    = null;
      _currentLoyalty = null;
      updateNavAuth();
      clearOrderRewards();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑧ NAV AUTH UI
// ═══════════════════════════════════════════════════════════════════════════════
function updateNavAuth() {
  const area = document.getElementById('navAuthArea');
  if (!area) return;
  if (_currentUser) {
    const initials = (_currentUser.firstName?.[0] || '?').toUpperCase();
    const btn      = document.createElement('button');
    btn.className  = 'nav-avatar';
    btn.setAttribute('aria-label', 'Open dashboard for ' + _currentUser.firstName);
    const av = document.createElement('span');
    av.className = 'avatar-circle';
    av.textContent = initials;
    const nm = document.createElement('span');
    nm.className = 'avatar-name';
    nm.textContent = _currentUser.firstName;
    btn.appendChild(av);
    btn.appendChild(nm);
    btn.addEventListener('click', () => openDashboard());
    area.innerHTML = '';
    area.appendChild(btn);
  } else {
    area.innerHTML = '';
    const btn = document.createElement('button');
    btn.className   = 'btn-nav-login';
    btn.textContent = 'Sign In';
    btn.addEventListener('click', () => openModal('authModal'));
    area.appendChild(btn);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑨ LOYALTY & REWARDS
// ═══════════════════════════════════════════════════════════════════════════════
async function updateLoyalty(userId, jarsAdded) {
  const fresh = await db_getLoyalty(userId);
  const newTotal = fresh.total_jars + jarsAdded;
  let newFree = fresh.free_jars;
  if (newTotal >= CONFIG.loyalty.freeJarThreshold && newFree === 0) newFree = 1;
  _currentLoyalty = { total_jars: newTotal, free_jars: newFree };
  await db_upsertLoyalty(userId, newTotal, newFree);
}

async function autoApplyRewards() {
  const user = _currentUser;
  const discBadge  = document.getElementById('orderDiscountBadge');
  const freeBadge  = document.getElementById('orderFreeJarBadge');
  const rewardBox  = document.getElementById('rewardsBox');

  if (!discBadge || !freeBadge) return;

  if (!user) {
    discBadge.hidden = true;
    freeBadge.hidden = true;
    if (rewardBox) rewardBox.classList.remove('rewards-active');
    return;
  }

  if (!user.emailVerified) {
    discBadge.hidden = true;
    freeBadge.hidden = true;
    if (rewardBox) rewardBox.classList.add('rewards-locked');
    return;
  }

  if (rewardBox) rewardBox.classList.remove('rewards-locked');

  const loy   = _currentLoyalty || await db_getLoyalty(user.id);
  const cards  = await db_getUnusedCards(user.id);

  if (cards.length > 0) {
    _pendingCardId   = cards[0].id;
    _pendingCardDisc = cards[0].discount;
    discBadge.hidden = false;
    const pct = document.getElementById('discountPct');
    if (pct) pct.textContent = cards[0].discount;
  } else {
    _pendingCardId   = null;
    _pendingCardDisc = 0;
    discBadge.hidden = true;
  }

  if (loy.free_jars > 0) {
    freeBadge.hidden = false;
  } else {
    freeBadge.hidden = true;
  }

  updateOrderSummary();
}

function clearOrderRewards() {
  _pendingCardId   = null;
  _pendingCardDisc = 0;
  const discBadge = document.getElementById('orderDiscountBadge');
  const freeBadge = document.getElementById('orderFreeJarBadge');
  if (discBadge) discBadge.hidden = true;
  if (freeBadge) freeBadge.hidden = true;
  updateOrderSummary();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑩ SCRATCH CARD
// ═══════════════════════════════════════════════════════════════════════════════
let _scratchCtx = null;
let _scratchRevealPct = 0;
let _scratchActive = false;

async function grantScratchCard() {
  const user = _currentUser;
  if (!user || !user.emailVerified) return;
  const already = await db_todayCardExists(user.id);
  if (already) { showToast('You already scratched today!', 'info'); return; }
  const discount  = Math.random() < 0.5 ? 10 : 20;
  const cardId    = await db_insertCard(user.id, discount);
  if (!cardId) { showToast('Could not issue scratch card. Try again later.', 'error'); return; }
  _pendingCardId   = cardId;
  _pendingCardDisc = discount;
  openScratchModal();
}

function openScratchModal() {
  openModal('scratchModal');
  initScratchCanvas();
}

function initScratchCanvas() {
  const canvas = document.getElementById('scratchCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  _scratchCtx = ctx;
  _scratchRevealPct = 0;
  _scratchActive = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#b0b8a0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Scratch here!', canvas.width / 2, canvas.height / 2);

  canvas.addEventListener('mousedown', startScratch);
  canvas.addEventListener('touchstart', startScratch, { passive: true });
}

let _isScratching = false;

function startScratch()  { _isScratching = true; }
function stopScratch()   { _isScratching = false; }

function scratchAt(x, y) {
  if (!_isScratching || !_scratchCtx || !_scratchActive) return;
  const ctx = _scratchCtx;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.fill();

  // check reveal percent every 10 events
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  let transparent = 0;
  for (let i = 3; i < imageData.data.length; i += 4) {
    if (imageData.data[i] < 128) transparent++;
  }
  _scratchRevealPct = transparent / (ctx.canvas.width * ctx.canvas.height) * 100;
  if (_scratchRevealPct > 60 && _scratchActive) autoRevealScratch();
}

function autoRevealScratch() {
  _scratchActive = false;
  if (_scratchCtx) {
    _scratchCtx.clearRect(0, 0, _scratchCtx.canvas.width, _scratchCtx.canvas.height);
  }
  const revealEl = document.getElementById('scratchReveal');
  const discEl   = document.getElementById('scratchDiscountVal');
  if (revealEl) revealEl.hidden = false;
  if (discEl) discEl.textContent = _pendingCardDisc + '%';
  showToast('🎉 You revealed a ' + _pendingCardDisc + '% discount!', 'success');
}

async function closeScratchAndSave() {
  closeModal('scratchModal');
  if (_pendingCardId) {
    await autoApplyRewards();
    showToast('💰 ' + _pendingCardDisc + '% discount saved for your next order!', 'success');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑪ DELIVERY & ORDER SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
function getDeliveryFee(city) {
  const entry = CONFIG.delivery[city] || CONFIG.delivery.other;
  return entry.fee;
}

function updateDeliverySummary() {
  const cityEl  = document.getElementById('oCity');
  const qtyEl   = document.getElementById('oQty');
  const city    = cityEl ? cityEl.value : '';
  const qty     = parseInt(qtyEl ? qtyEl.value : '1', 10) || 1;
  clearFieldErr('oCity');
  updateOrderSummary();
}

function updateOrderSummary() {
  const cityEl    = document.getElementById('oCity');
  const qtyEl     = document.getElementById('oQty');
  const flavorEl  = document.getElementById('oFlavor');
  const summCity  = document.getElementById('summCity');
  const summJars  = document.getElementById('summJars');
  const summFee   = document.getElementById('summFee');
  const summDisc  = document.getElementById('summDisc');
  const summTotal = document.getElementById('summTotal');

  if (!qtyEl || !cityEl) return;

  const qty    = parseInt(qtyEl.value, 10) || 1;
  const city   = cityEl.value || 'other';
  const fee    = getDeliveryFee(city);
  const loy    = _currentLoyalty;
  const freeJ  = (loy && _currentUser?.emailVerified && loy.free_jars > 0) ? 1 : 0;
  const discPct = (_currentUser?.emailVerified && _pendingCardDisc > 0) ? _pendingCardDisc : 0;

  const jarPrice   = qty >= 3 ? CONFIG.pricing.triple : CONFIG.pricing.single * qty;
  const afterFree  = freeJ > 0 ? jarPrice - CONFIG.pricing.single : jarPrice;
  const afterDisc  = afterFree * (1 - discPct / 100);
  const total      = Math.round(afterDisc + fee);

  const cityLabel  = (CONFIG.delivery[city] || CONFIG.delivery.other).label;

  if (summCity)  summCity.textContent  = cityLabel;
  if (summJars)  summJars.textContent  = qty + (freeJ ? ' + 1 Free' : '');
  if (summFee)   summFee.textContent   = 'Rs. ' + fee;
  if (summDisc)  summDisc.textContent  = discPct > 0 ? discPct + '%' : '—';
  if (summTotal) summTotal.textContent = 'Rs. ' + total;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑫ ORDER FORM VALIDATION & SUBMISSION
// ═══════════════════════════════════════════════════════════════════════════════
function fieldErr(inputId, errId, msg) {
  const el = document.getElementById(inputId);
  const sp = document.getElementById(errId);
  if (el) el.setAttribute('aria-invalid', 'true');
  if (sp) { sp.textContent = msg; sp.hidden = false; }
}

function clearFieldErr(inputId) {
  const el   = document.getElementById(inputId);
  const errId = 'err' + inputId.charAt(0).toUpperCase() + inputId.slice(1);
  const sp   = document.getElementById(errId);
  if (el) el.removeAttribute('aria-invalid');
  if (sp) { sp.textContent = ''; sp.hidden = true; }
}

function validatePhone(ph) {
  return /^(\+92|0092|0)?3[0-9]{9}$/.test(ph.replace(/[\s\-]/g, ''));
}

function validateEmail(em) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
}

async function handleOrder(e, isRetry = false) {
  e && e.preventDefault();

  if (!checkRateLimit('order', CONFIG.rateLimits.order, isRetry)) return;

  const first   = document.getElementById('oFirst').value.trim();
  const last    = document.getElementById('oLast').value.trim();
  const email   = document.getElementById('oEmail').value.trim();
  const phone   = document.getElementById('oPhone').value.trim();
  const flavor  = document.getElementById('oFlavor').value;
  const qtyRaw  = document.getElementById('oQty').value;
  const qty     = parseInt(qtyRaw, 10);
  const address = document.getElementById('oAddress').value.trim();
  const message = document.getElementById('oMessage').value.trim();
  const cityEl  = document.getElementById('oCity');
  const city    = cityEl ? cityEl.value : '';
  const btn     = document.getElementById('placeOrderBtn');

  let hasErr = false;

  if (!first)           { fieldErr('oFirst',   'errOFirst',   'First name required.');         hasErr = true; }
  if (!last)            { fieldErr('oLast',    'errOLast',    'Last name required.');           hasErr = true; }
  if (!validateEmail(email)) { fieldErr('oEmail', 'errOEmail', 'Valid email required.');       hasErr = true; }
  if (!validatePhone(phone)) { fieldErr('oPhone', 'errOPhone', 'Valid Pakistani number required.'); hasErr = true; }
  if (!flavor)          { fieldErr('oFlavor',  'errOFlavor',  'Please select a flavor.');      hasErr = true; }
  if (isNaN(qty) || qty < 1 || qty > 50) { fieldErr('oQty', 'errOQty', 'Quantity must be 1–50.'); hasErr = true; }
  if (!address)         { fieldErr('oAddress', 'errOAddress', 'Delivery address required.');   hasErr = true; }
  if (!city)            { fieldErr('oCity',    'errOCity',    'Please select a city.');         hasErr = true; }

  if (hasErr) { clearRateLimit('order'); return; }

  const user    = _currentUser;
  const fee     = getDeliveryFee(city);
  const loy     = _currentLoyalty;
  const freeJ   = (user?.emailVerified && loy && loy.free_jars > 0) ? 1 : 0;
  const discPct = (user?.emailVerified && _pendingCardDisc > 0) ? _pendingCardDisc : 0;
  const cardId  = (discPct > 0) ? _pendingCardId : null;

  const jarPrice   = qty >= 3 ? CONFIG.pricing.triple : CONFIG.pricing.single * qty;
  const afterFree  = freeJ > 0 ? jarPrice - CONFIG.pricing.single : jarPrice;
  const afterDisc  = afterFree * (1 - discPct / 100);
  const total      = Math.round(afterDisc + fee);

  setSpinner(btn, true, 'Placing order…');

  // Upload screenshot if provided
  let screenshotUrl = null;
  if (_screenshotFile && user) {
    const { url, error: upErr } = await db_uploadScreenshot(user.id, _screenshotFile);
    if (upErr) showToast('Screenshot upload failed — order will proceed without it.', 'warn');
    else screenshotUrl = url;
  }

  // Atomic: lock card before insert
  if (cardId) {
    const locked = await db_useCard(cardId, user.id);
    if (!locked) {
      showToast('Discount could not be applied. Placing order without discount.', 'warn');
      _pendingCardId   = null;
      _pendingCardDisc = 0;
    }
  }

  const orderPayload = {
    user_id:        user?.id || null,
    first_name:     first,
    last_name:      last,
    email,
    phone,
    flavor,
    qty,
    free_jars:      freeJ,
    city,
    address,
    message,
    payment_method: _selectedPayMethod,
    screenshot_url: screenshotUrl,
    delivery_fee:   fee,
    discount_pct:   discPct,
    total_amount:   total,
    status:         'pending',
    created_at:     new Date().toISOString(),
  };

  const { id: orderId, error: insertErr } = await db_insertOrder(orderPayload);

  if (insertErr) {
    if (cardId) await db_unuseCard(cardId, user.id);
    setSpinner(btn, false, 'Place My Order →');
    showToast('Order failed — please try again.', 'error', () => handleOrder(null, true));
    return;
  }

  // Update loyalty
  if (user) {
    await updateLoyalty(user.id, qty + freeJ);
    if (freeJ > 0) {
      _currentLoyalty.free_jars = Math.max(0, _currentLoyalty.free_jars - 1);
    }
    _pendingCardId   = null;
    _pendingCardDisc = 0;
    await autoApplyRewards();
  }

  setSpinner(btn, false, 'Place My Order →');
  _screenshotFile = null;
  document.getElementById('paymentScreenshot') && (document.getElementById('paymentScreenshot').value = '');
  document.getElementById('screenshotPreview') && (document.getElementById('screenshotPreview').hidden = true);

  // Build WhatsApp message & open
  const waUrl = buildWaUrl({
    first, last, flavor, qty, freeJ, discPct, city,
    address, fee, total, payMethod: _selectedPayMethod,
  });
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  showToast('✓ Order placed! Opening WhatsApp…', 'success');
  document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑬ WHATSAPP URL BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
function buildWaUrl({ first, last, flavor, qty, freeJ, discPct, city, address, fee, total, payMethod }) {
  const flavorLabels = { classic: 'Classic', spicy: 'Spicy', herb: 'Herb & Garlic' };
  const payLabels    = { bank: 'Meezan Bank', easypaisa: 'Easypaisa', jazzcash: 'JazzCash' };

  let msg = `🧡 *New Order — Redcrest Foods*\n\n`;
  msg += `👤 *Name:* ${first} ${last}\n`;
  msg += `🫙 *Flavor:* ${flavorLabels[flavor] || flavor}\n`;
  msg += `📦 *Qty:* ${qty}${freeJ ? ' + 1 Free Jar!' : ''}\n`;
  if (discPct) msg += `🎟️ *Discount:* ${discPct}%\n`;
  msg += `🏙️ *City:* ${(CONFIG.delivery[city] || CONFIG.delivery.other).label}\n`;
  msg += `📍 *Address:* ${address}\n`;
  msg += `🚚 *Delivery Fee:* Rs. ${fee}\n`;
  msg += `💰 *Total:* Rs. ${total}\n`;
  msg += `💳 *Payment:* ${payLabels[payMethod] || payMethod}\n`;

  return `https://wa.me/${CONFIG.site.whatsapp}?text=${encodeURIComponent(msg)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑭ SCREENSHOT UPLOAD HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
function handleScreenshotUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const maxMB = 5;
  if (file.size > maxMB * 1024 * 1024) {
    showToast(`Screenshot must be under ${maxMB}MB.`, 'warn');
    input.value = '';
    return;
  }
  _screenshotFile = file;
  const preview = document.getElementById('screenshotPreview');
  if (preview) {
    preview.hidden = false;
    const img = preview.querySelector('img');
    if (img) img.src = URL.createObjectURL(file);
  }
  showToast('✓ Screenshot ready to upload with your order.', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑮ DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
async function openDashboard() {
  if (!_currentUser) { openModal('authModal'); return; }
  openModal('dashModal');
  renderDashboard();
}

async function renderDashboard() {
  const user = _currentUser;
  if (!user) return;

  setText('dashName',  user.firstName);
  setText('dashEmail', user.email);

  const [loy, orders] = await Promise.all([
    db_getLoyalty(user.id),
    db_getOrders(user.id),
  ]);

  _currentLoyalty = { total_jars: loy.total_jars, free_jars: loy.free_jars };

  setText('dashTotalJars', loy.total_jars);
  setText('dashFreeJars',  loy.free_jars);

  const ordersEl = document.getElementById('dashOrders');
  if (!ordersEl) return;
  ordersEl.innerHTML = '';

  if (!orders.length) {
    const p = document.createElement('p');
    p.className   = 'dash-empty';
    p.textContent = 'No orders yet. Place your first order below!';
    ordersEl.appendChild(p);
    return;
  }

  orders.forEach(o => {
    const card = document.createElement('div');
    card.className = 'dash-order-card';

    const date   = new Date(o.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
    const status = document.createElement('span');
    status.className   = 'order-status order-status--' + (o.status || 'pending');
    status.textContent = (o.status || 'pending').charAt(0).toUpperCase() + (o.status || 'pending').slice(1);

    const title = document.createElement('p');
    title.className   = 'order-title';
    title.textContent = o.flavor.charAt(0).toUpperCase() + o.flavor.slice(1) + ' × ' + o.qty;

    const meta = document.createElement('p');
    meta.className   = 'order-meta';
    meta.textContent = 'Rs. ' + o.total_amount + ' · ' + date;

    const reorderBtn = document.createElement('button');
    reorderBtn.className   = 'btn-reorder';
    reorderBtn.textContent = 'Reorder';
    reorderBtn.addEventListener('click', () => reorder(o));

    card.appendChild(status);
    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(reorderBtn);
    ordersEl.appendChild(card);
  });
}

function reorder(o) {
  closeModal('dashModal');
  setTimeout(() => {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('oFlavor',  o.flavor);
    setVal('oQty',     o.qty);
    setVal('oAddress', o.address);
    setVal('oCity',    o.city);
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' });
    updateOrderSummary();
  }, 300);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑯ PAYMENT METHOD SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════
function selectPayMethod(method) {
  _selectedPayMethod = method;
  ['bank','easypaisa','jazzcash'].forEach(m => {
    const btn    = document.getElementById('pay-' + m);
    const detail = document.getElementById('pay-detail-' + m);
    if (btn) btn.classList.toggle('active', m === method);
    if (detail) detail.hidden = m !== method;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑰ FAQ ACCORDION
// ═══════════════════════════════════════════════════════════════════════════════
function toggleFaq(n) {
  const ans = document.getElementById('faq-ans-' + n);
  const btn = document.getElementById('faq-btn-' + n);
  if (!ans || !btn) return;
  const open = ans.hidden === false;
  // close all
  for (let i = 1; i <= 8; i++) {
    const a = document.getElementById('faq-ans-' + i);
    const b = document.getElementById('faq-btn-' + i);
    if (a) a.hidden = true;
    if (b) b.setAttribute('aria-expanded', 'false');
  }
  if (!open) {
    ans.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑱ MOBILE NAV
// ═══════════════════════════════════════════════════════════════════════════════
function toggleMobileNav() {
  const nav = document.getElementById('mobileNav');
  const btn = document.getElementById('mobileNavBtn');
  if (!nav || !btn) return;
  const open = !nav.hidden;
  nav.hidden = open;
  btn.setAttribute('aria-expanded', String(!open));
  document.body.style.overflow = open ? '' : 'hidden';
}

function closeMobileNav() {
  const nav = document.getElementById('mobileNav');
  const btn = document.getElementById('mobileNavBtn');
  if (nav) nav.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑲ SCROLL REVEAL
// ═══════════════════════════════════════════════════════════════════════════════
function initScrollReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⑳ OFFLINE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════
function initOffline() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  const update = () => {
    banner.hidden = navigator.onLine;
  };
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ㉑ SCRATCH CANVAS EVENT WIRING
// ═══════════════════════════════════════════════════════════════════════════════
function initScratchEvents() {
  const canvas = document.getElementById('scratchCanvas');
  if (!canvas) return;
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    scratchAt(e.clientX - r.left, e.clientY - r.top);
  });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const r     = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    scratchAt(touch.clientX - r.left, touch.clientY - r.top);
  }, { passive: false });
  document.addEventListener('mouseup',  stopScratch);
  document.addEventListener('touchend', stopScratch);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ㉒ WAITLIST
// ═══════════════════════════════════════════════════════════════════════════════
function joinWaitlist() {
  const user = _currentUser;
  if (user) {
    const list = JSON.parse(localStorage.getItem('rc_waitlist') || '[]');
    if (!list.includes(user.email)) {
      list.push(user.email);
      localStorage.setItem('rc_waitlist', JSON.stringify(list));
    }
    showToast('🔔 You\'re on the list! We\'ll notify ' + user.email + ' when online payments launch.', 'success');
  } else {
    openModal('authModal');
    showToast('Sign in to join the waitlist.', 'info');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ㉓ BOOT
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // Init auth listener first
  initAuth();

  // Restore any existing session
  const session = await db_getSession();
  if (session) await restoreSession(session);
  else updateNavAuth();

  // UI init
  initScrollReveal();
  initOffline();
  initScratchEvents();
  selectPayMethod('bank');
  updateOrderSummary();

  // Default pay method tabs
  document.querySelectorAll('.pay-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => selectPayMethod(btn.dataset.method));
  });

  // FAQ wiring
  for (let i = 1; i <= 8; i++) {
    const btn = document.getElementById('faq-btn-' + i);
    if (btn) btn.addEventListener('click', () => toggleFaq(i));
  }

  // Order form
  const orderForm = document.getElementById('orderForm');
  if (orderForm) orderForm.addEventListener('submit', handleOrder);

  // Login / register forms
  const loginForm    = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (loginForm)    loginForm.addEventListener('submit',    handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  // Auth tabs
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => showAuthTab(tab.dataset.tab));
  });

  // Mobile nav
  const mobileBtn = document.getElementById('mobileNavBtn');
  if (mobileBtn) mobileBtn.addEventListener('click', toggleMobileNav);

  // Close mobile nav on link click
  document.querySelectorAll('#mobileNav a').forEach(a => {
    a.addEventListener('click', closeMobileNav);
  });

  // Delivery city / qty live update
  const cityEl = document.getElementById('oCity');
  const qtyEl  = document.getElementById('oQty');
  if (cityEl) { cityEl.addEventListener('change', () => { clearFieldErr('oCity'); updateOrderSummary(); }); }
  if (qtyEl)  { qtyEl.addEventListener('input',  () => { clearFieldErr('oQty');  updateOrderSummary(); }); }

  // Flavor clear
  const flavorEl = document.getElementById('oFlavor');
  if (flavorEl) flavorEl.addEventListener('change', () => clearFieldErr('oFlavor'));

  // Screenshot
  const ssInput = document.getElementById('paymentScreenshot');
  if (ssInput) ssInput.addEventListener('change', () => handleScreenshotUpload(ssInput));

  // Backdrop close modals
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', e => {
      if (e.target === bd) {
        const modal = bd.closest('[id$="Modal"]');
        if (modal) closeModal(modal.id);
      }
    });
  });

  // Scratch card grant buttons
  document.querySelectorAll('[data-action="scratch"]').forEach(btn => {
    btn.addEventListener('click', grantScratchCard);
  });

  // Dashboard open
  document.querySelectorAll('[data-action="dashboard"]').forEach(btn => {
    btn.addEventListener('click', openDashboard);
  });

  // Sign out
  document.querySelectorAll('[data-action="signout"]').forEach(btn => {
    btn.addEventListener('click', handleSignOut);
  });

  // Auth modal open
  document.querySelectorAll('[data-action="signin"]').forEach(btn => {
    btn.addEventListener('click', () => openModal('authModal'));
  });
});

// Redcrest Foods v6 — Supabase DB Helpers
'use strict';

// ── Client ──────────────────────────────────────────────────────────────────
let _supabase = null;

function getClient() {
  if (!_supabase) {
    _supabase = window.supabase.createClient(
      CONFIG.supabase.url,
      CONFIG.supabase.anonKey,
      { auth: { autoRefreshToken: true, persistSession: true } }
    );
  }
  return _supabase;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────
async function db_getSession() {
  try {
    const { data: { session }, error } = await getClient().auth.getSession();
    if (error) throw error;
    return session;
  } catch (e) {
    console.error('[db_getSession]', e.message);
    return null;
  }
}

async function db_signUp(email, password) {
  const { data, error } = await getClient().auth.signUp({ email, password });
  return { data, error };
}

async function db_signIn(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  return { data, error };
}

async function db_signOut() {
  await getClient().auth.signOut();
}

async function db_resendVerification(email) {
  const { error } = await getClient().auth.resend({ type: 'signup', email });
  return { error };
}

// ── Profile ──────────────────────────────────────────────────────────────────
async function db_getProfile(userId) {
  try {
    const { data, error } = await getClient()
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('[db_getProfile]', e.message);
    return null;
  }
}

async function db_upsertProfile(userId, firstName, lastName, phone) {
  if (!userId) return;
  try {
    await getClient()
      .from('profiles')
      .upsert({ user_id: userId, first_name: firstName, last_name: lastName, phone },
               { onConflict: 'user_id' });
  } catch (e) {
    console.error('[db_upsertProfile]', e.message);
  }
}

// ── Loyalty ───────────────────────────────────────────────────────────────────
async function db_getLoyalty(userId) {
  try {
    const { data, error } = await getClient()
      .from('loyalty_accounts')
      .select('total_jars, free_jars')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data || { total_jars: 0, free_jars: 0 };
  } catch (e) {
    console.error('[db_getLoyalty]', e.message);
    return { total_jars: 0, free_jars: 0 };
  }
}

async function db_upsertLoyalty(userId, totalJars, freeJars) {
  if (!userId) return;
  try {
    await getClient()
      .from('loyalty_accounts')
      .upsert({ user_id: userId, total_jars: totalJars, free_jars: freeJars },
               { onConflict: 'user_id' });
  } catch (e) {
    console.error('[db_upsertLoyalty]', e.message);
  }
}

// ── Scratch Cards ─────────────────────────────────────────────────────────────
async function db_todayCardExists(userId) {
  try {
    const now   = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const { data, error } = await getClient()
      .from('scratch_cards')
      .select('id')
      .eq('user_id', userId)
      .gte('issued_at', start.toISOString())
      .lte('issued_at', end.toISOString())
      .maybeSingle();
    if (error) throw error;
    return !!data;
  } catch (e) {
    console.error('[db_todayCardExists]', e.message);
    return true; // fail-safe: deny double issuance
  }
}

async function db_insertCard(userId, discount) {
  try {
    const { data, error } = await getClient()
      .from('scratch_cards')
      .insert({ user_id: userId, discount, used: false, issued_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  } catch (e) {
    console.error('[db_insertCard]', e.message);
    return null;
  }
}

async function db_getUnusedCards(userId) {
  try {
    const { data, error } = await getClient()
      .from('scratch_cards')
      .select('id, discount')
      .eq('user_id', userId)
      .eq('used', false)
      .order('issued_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('[db_getUnusedCards]', e.message);
    return [];
  }
}

async function db_useCard(cardId, userId) {
  try {
    const { error } = await getClient()
      .from('scratch_cards')
      .update({ used: true })
      .eq('id', cardId)
      .eq('user_id', userId)
      .eq('used', false);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error('[db_useCard]', e.message);
    return false;
  }
}

async function db_unuseCard(cardId, userId) {
  try {
    await getClient()
      .from('scratch_cards')
      .update({ used: false })
      .eq('id', cardId)
      .eq('user_id', userId);
  } catch (e) {
    console.error('[db_unuseCard]', e.message);
  }
}

// ── Orders ────────────────────────────────────────────────────────────────────
async function db_insertOrder(order) {
  try {
    const { data, error } = await getClient()
      .from('orders')
      .insert(order)
      .select('id')
      .single();
    if (error) throw error;
    return { id: data.id, error: null };
  } catch (e) {
    console.error('[db_insertOrder]', e.message);
    return { id: null, error: e };
  }
}

async function db_getOrders(userId) {
  try {
    const { data, error } = await getClient()
      .from('orders')
      .select('id, flavor, qty, total_amount, delivery_fee, discount_pct, free_jars, city, address, payment_method, screenshot_url, created_at, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('[db_getOrders]', e.message);
    return [];
  }
}

// ── Screenshot Upload ─────────────────────────────────────────────────────────
async function db_uploadScreenshot(userId, file) {
  try {
    const ext  = file.name.split('.').pop() || 'jpg';
    const path = `${CONFIG.storage.pathPrefix}/${userId}/${Date.now()}.${ext}`;
    const { error } = await getClient()
      .storage
      .from(CONFIG.storage.bucket)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data: urlData } = getClient()
      .storage
      .from(CONFIG.storage.bucket)
      .getPublicUrl(path);
    return { url: urlData.publicUrl, error: null };
  } catch (e) {
    console.error('[db_uploadScreenshot]', e.message);
    return { url: null, error: e };
  }
}

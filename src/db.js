// ============================================
// Supabase Database Adapter
// Production-only implementation
// ============================================

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (singleton pattern)
let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  return supabaseClient;
}

// ============================================
// Members Operations
// ============================================

async function upsertMember({ chatId, userId, username, fullName }) {
  const supabase = getSupabaseClient();

  const memberData = {
    chat_id: chatId,
    user_id: userId,
    username: username || null,
    full_name: fullName || null,
    enabled: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('members')
    .upsert(memberData, { onConflict: 'chat_id,user_id' });

  if (error) {
    throw new Error(`Failed to upsert member: ${error.message}`);
  }
}

async function setOptOut({ chatId, userId, isOptedOut }) {
  const supabase = getSupabaseClient();

  const memberData = {
    chat_id: chatId,
    user_id: userId,
    enabled: !isOptedOut,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('members')
    .upsert(memberData, { onConflict: 'chat_id,user_id' });

  if (error) {
    throw new Error(`Failed to update opt-out status: ${error.message}`);
  }
}

async function getTaggableMembers(chatId, limit = 10000) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('members')
    .select('user_id,username,full_name')
    .eq('chat_id', chatId)
    .eq('enabled', true)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch taggable members: ${error.message}`);
  }

  return (data || []).map((row) => ({
    user_id: row.user_id,
    username: row.username,
    full_name: row.full_name,
  }));
}

// ============================================
// Cooldown Operations
// ============================================

async function getCooldown(chatId, command = 'all') {
  const supabase = getSupabaseClient();

  let result;
  try {
    // Try to use maybeSingle if available (newer versions)
    if (typeof supabase.from('').maybeSingle === 'function') {
      result = await supabase
        .from('cooldowns')
        .select('next_available_at')
        .eq('chat_id', chatId)
        .eq('command', command)
        .maybeSingle();
    } else {
      // Fallback for older versions
      result = await supabase
        .from('cooldowns')
        .select('next_available_at')
        .eq('chat_id', chatId)
        .eq('command', command)
        .limit(1)
        .single()
        .catch(() => ({ data: null, error: null }));
    }
  } catch (err) {
    // No cooldown found
    return 0;
  }

  if (result.error || !result.data || !result.data.next_available_at) {
    return 0;
  }

  return new Date(result.data.next_available_at).getTime();
}

async function setCooldown(
  chatId,
  command = 'all',
  nextAvailableAt = new Date()
) {
  const supabase = getSupabaseClient();

  const cooldownData = {
    chat_id: chatId,
    command,
    next_available_at: new Date(nextAvailableAt).toISOString(),
  };

  const { error } = await supabase
    .from('cooldowns')
    .upsert(cooldownData, { onConflict: 'chat_id,command' });

  if (error) {
    throw new Error(`Failed to set cooldown: ${error.message}`);
  }
}

// ============================================
// Exports
// ============================================

module.exports = {
  upsertMember,
  setOptOut,
  getTaggableMembers,
  getCooldown,
  setCooldown,
};

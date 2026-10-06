/* VIZ HF15 only. Frozen canonical operation scopes; no wildcard or authority delegation.
 * Protocol provenance and build recipe: v3/vendor/viz/README.md.
 */
(function exposeVizAgents(global) {
  'use strict';
  const epoch = '1970-01-01T00:00:00';
  const nullKey = 'VIZ1111111111111111111111111111111114T1Anm';
  const operations = Object.freeze([
    'transfer', 'transfer_to_vesting', 'withdraw_vesting',
    'validator_update', 'account_validator_vote', 'account_validator_proxy',
    'custom', 'set_withdraw_vesting_route', 'request_account_recovery', 'escrow_transfer',
    'escrow_dispute', 'escrow_release', 'escrow_approve', 'delegate_vesting_shares',
    'account_create', 'account_metadata', 'proposal_create', 'proposal_delete',
    'chain_properties_update', 'committee_worker_create_request', 'committee_worker_cancel_request',
    'committee_vote_request', 'create_invite', 'claim_invite_balance', 'invite_registration',
    'versioned_chain_properties_update', 'award', 'set_paid_subscription', 'paid_subscribe',
    'buy_account', 'use_invite_balance', 'fixed_award', 'set_reward_sharing',
    'pm_oracle_register', 'pm_oracle_update', 'pm_create_market', 'pm_oracle_accept_market',
    'pm_place_bet', 'pm_commit_bet', 'pm_reveal_bet', 'pm_cancel_bet', 'pm_add_liquidity',
    'pm_withdraw_liquidity', 'pm_resolve_market', 'pm_no_contest', 'pm_dispute_create',
    'pm_dispute_vote', 'pm_dispute_resolve', 'pm_transfer_position', 'pm_lazy_deposit',
    'pm_lazy_withdraw', 'pm_leverage_open', 'pm_leverage_close', 'pm_leverage_convert',
    'pm_dispute_oracle_respond', 'pm_unban'
  ]);
  // Read historical protocol rows without offering retired operations for new grants.
  const readableOperations = Object.freeze([...operations, 'vote', 'content', 'delete_content']);
  function publicKey(value) {
    const key = String(value || '').trim();
    try {
      if (!/^VIZ[1-9A-HJ-NP-Za-km-z]{1,51}$/.test(key) || key === nullKey) throw new Error();
      if (!global.viz.auth.isPubkey(key, 'VIZ')) throw new Error();
      return key;
    } catch (_) { throw new Error('Нужен корректный публичный ключ VIZ, не приватный WIF.'); }
  }
  function build(input) {
    const account = String(input.account || '');
    if (global.viz.utils.validateAccountName(account)) throw new Error('Выберите аккаунт VIZ.');
    const name = String(input.name || '').trim();
    if (!/^[a-z0-9_-]{1,32}$/.test(name)) throw new Error('Имя агента: 1–32 символа a-z, 0-9, _ или -.');
    if (input.revoke) return ['set_agent_permission', { account, agent_name:name, agent_key:nullKey, operations:[], expiration:epoch, addons:[], extensions:[] }];
    const selected = input.operations || [];
    if (!Array.isArray(selected) || selected.length > operations.length || selected.some((name) => !operations.includes(name))) throw new Error('Недопустимая операция агента.');
    const scopes = [...new Set(selected)].sort();
    const raw = String(input.addons || '').trim();
    const addons = raw ? raw.split(',').map((item) => item.trim()) : [];
    if (addons.some((item) => !item || item.length > 63 || /(?:5[1-9A-HJ-NP-Za-km-z]{50}|[KL][1-9A-HJ-NP-Za-km-z]{51})/.test(item) || new TextEncoder().encode(item).length > 63) || addons.length > 10) throw new Error('Addons: максимум 10 непустых значений, каждое до 63 байт UTF-8, через запятую.');
    if (!scopes.length && !addons.length) throw new Error('Выберите права или addons; для отзыва используйте режим «Отозвать».');
    let expiration = epoch;
    if (!input.unlimited) {
      const value = String(input.expiration || '');
      const canonical = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
      const time = Date.parse(`${canonical}Z`);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(canonical) || !Number.isFinite(time) || time <= Date.now() || time / 1000 > 4294967295 || new Date(time).toISOString().slice(0,19) !== canonical) throw new Error('Дата окончания должна быть корректной будущей датой UTC до 2106 года.');
      expiration = canonical;
    }
    return ['set_agent_permission', {account, agent_name:name, agent_key:publicKey(input.publicKey), operations:scopes, expiration, addons:[...new Set(addons)].sort(), extensions:[]}];
  }
  function generate() {
    if (!global.crypto || !global.crypto.getRandomValues) throw new Error('Безопасная генерация ключа недоступна.');
    const entropy = new Uint8Array(32);
    try {
      global.crypto.getRandomValues(entropy);
      const seed = Array.from(entropy, (byte) => byte.toString(16).padStart(2,'0')).join('');
      const wif = global.viz.auth.toWif('', seed, 'agent');
      return { publicKey:global.viz.auth.wifToPublic(wif), privateKey:wif };
    } finally { entropy.fill(0); }
  }
  async function read(client, account) {
    if (!client || !client.api || typeof client.api.getAgentPermissionsAsync !== 'function') throw new Error('Нода или библиотека не поддерживает HF15 get_agent_permissions.');
    let rows;
    try {
      rows = global.DposProfiles && typeof global.DposProfiles.apiCall === 'function'
        ? await global.DposProfiles.apiCall({ client }, 'getAgentPermissions', [account])
        : await client.api.getAgentPermissionsAsync(account);
    }
    catch (error) {
      if (error && (error.code === -32601 || /unknown method|method not found|could not find method/i.test(String(error.message || '')))) throw new Error('Нода или библиотека не поддерживает HF15 get_agent_permissions.');
      throw error;
    }
    const validRow = row => row && row.account === account
      && typeof row.agent_name === 'string' && /^[a-z0-9_-]{1,32}$/.test(row.agent_name)
      && typeof row.agent_key === 'string'
      && Array.isArray(row.operations) && row.operations.length <= readableOperations.length && row.operations.every(name => typeof name === 'string' && readableOperations.includes(name))
      && Array.isArray(row.addons) && row.addons.length <= 10
      && row.addons.every(addon => typeof addon === 'string' && addon && addon.length <= 63 && !addon.includes(',') && new TextEncoder().encode(addon).length <= 63 && !/(?:5[1-9A-HJ-NP-Za-km-z]{50}|[KL][1-9A-HJ-NP-Za-km-z]{51})/.test(addon))
      && typeof row.expiration === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(row.expiration)
      && Number.isFinite(Date.parse(row.expiration + 'Z')) && new Date(row.expiration + 'Z').toISOString().slice(0,19) === row.expiration
      && typeof row.expired === 'boolean';
    if (!Array.isArray(rows) || rows.length > 16 || !rows.every(validRow) || new Set(rows.map(row => row.agent_name)).size !== rows.length) throw new Error('Некорректный ответ get_agent_permissions.');
    rows.forEach(row => publicKey(row.agent_key));
    return rows;
  }
  global.DposVizAgents = Object.freeze({build, generate, read, operations, epoch, nullKey});
})(window);

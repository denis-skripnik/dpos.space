(function exposeRewardDisplay(global) {
  'use strict';
  const specs = {
    golos: { raw: 'GESTS', power: 'СГ', liquid: 'GOLOS', fund: 'total_vesting_fund_steem' },
    steem: { raw: 'VESTS', power: 'SP', liquid: 'STEEM', fund: 'total_vesting_fund_steem' },
    hive: { raw: 'VESTS', power: 'HP', liquid: 'HIVE', fund: 'total_vesting_fund_hive' }
  };
  function asset(value, symbol, precision) {
    const match = String(value || '').match(/^(\d+)(?:\.(\d+))? ([A-Z]+)$/);
    if (!match || match[3] !== symbol || (match[2] || '').length > precision || match[1].length > 40) return null;
    return BigInt(match[1] + (match[2] || '').padEnd(precision, '0'));
  }
  function identify(event) {
    const route = new URLSearchParams(String(event.route || event.url || '').replace(/^#/, ''));
    const chainId = event.chainId || route.get('chain');
    const type = event.type || event.opType || route.get('ops');
    const spec = specs[chainId];
    if (!spec || type !== 'curation_reward') return null;
    const amount = asset(event.text, spec.raw, 6);
    return amount === null ? null : { chainId, spec, amount };
  }
  function rate(chainId, properties) {
    const spec = specs[chainId];
    if (!spec) return null;
    const fund = asset(properties && properties[spec.fund], spec.liquid, 3);
    const shares = asset(properties && properties.total_vesting_shares, spec.raw, 6);
    return fund !== null && fund > 0n && shares !== null && shares > 0n ? { fund, shares } : null;
  }
  function present(event, properties) {
    const info = identify(event);
    if (!info) return null;
    const { spec, amount } = info;
    const conversion = rate(info.chainId, properties);
    const details = String(event.text);
    if (!conversion) {
      return { text: `Пересчёт кураторской награды в ${spec.power} недоступен.`, details };
    }
    const { fund, shares } = conversion;
    if (amount === 0n) return { text: `0.000 ${spec.power}`, details };
    // Integer arithmetic: fund is already in thousandths of liquid/power units.
    const numerator = amount * fund;
    if (numerator < shares) return { text: `<0.001 ${spec.power} (по текущему соотношению)`, details };
    const thousandths = (numerator + shares / 2n) / shares;
    const value = `${thousandths / 1000n}.${String(thousandths % 1000n).padStart(3, '0')}`;
    return { text: `≈ +${value} ${spec.power} (по текущему соотношению)`, details };
  }
  global.DposRewardDisplay = Object.freeze({ identify, present, validRate: (chainId, properties) => rate(chainId, properties) !== null });
})(window);

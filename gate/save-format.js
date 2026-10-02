'use strict';

// Cloud progress contains no executable scene, settings, account identifiers, or HTML.
window.GateProgress = (() => {
  const MAX_LENGTH = 64000;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function number(value, fallback, max, integer = false) {
    if (value == null) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) throw Error('invalid-save');
    return value;
  }
  function map(value, ids, max, defaults = {}) {
    if (value != null && !object(value)) throw Error('invalid-save');
    const result = {...defaults};
    for (const [id, level] of Object.entries(value || {})) {
      if (!ids.includes(id)) throw Error('unsupported-save');
      result[id] = number(level === true ? 1 : level, 0, max, true);
    }
    return result;
  }
  function date(value) {
    if (value == null || value === '') return '';
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('invalid-save');
    return value;
  }
  function normalize(data, weapons, skins) {
    if (!object(data)) throw Error('invalid-save');
    const ownedWeapons = map(data.weapons, weapons, 10, {pea: 1});
    const ownedSkins = map(data.skins, skins, 5, {green: 1});
    if (!ownedWeapons.pea || !ownedSkins.green) throw Error('invalid-save');
    const weapon = data.weapon == null ? 'pea' : data.weapon, skin = data.skin == null ? 'green' : data.skin;
    if (!ownedWeapons[weapon] || !weapons.includes(weapon) || !ownedSkins[skin] || !skins.includes(skin)) throw Error('invalid-save');
    const gifts = data.gifts == null ? [] : data.gifts;
    if (!Array.isArray(gifts) || gifts.length > 200) throw Error('save-limit');
    const safeId = id => typeof id === 'string' && /^[A-Za-z0-9._:-]{1,80}$/.test(id) && !['__proto__','constructor','prototype'].includes(id);
    const giftIds = {};
    if (data.giftIds != null && !object(data.giftIds)) throw Error('invalid-save');
    if (Object.keys(data.giftIds || {}).length > 2000) throw Error('save-limit');
    for (const [id, claimed] of Object.entries(data.giftIds || {})) {
      if (!safeId(id) || (claimed !== 1 && claimed !== true)) throw Error('invalid-save');
      giftIds[id] = 1;
    }
    const seen = new Set();
    const safeGifts = gifts.map(gift => {
      if (!object(gift) || !safeId(gift.id) || seen.has(gift.id) || !['welcome','update','demote','login'].includes(gift.k)) throw Error('invalid-save');
      seen.add(gift.id);
      let n = number(gift.n == null || gift.k === 'update' ? 0 : gift.n, 0, 7, true);
      if (gift.k === 'update') {
        if (typeof gift.n !== 'string' || !/^\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/.test(gift.n)) throw Error('invalid-save');
        n = gift.n;
      }
      giftIds[gift.id] = 1;
      return {id: gift.id, k: gift.k, n, p: number(gift.p, 0, 1e9, true), c: number(gift.c, 0, 1e12, true)};
    });
    for (const key of ['free10','pity','login','daily']) if (data[key] != null && !object(data[key])) throw Error('invalid-save');
    const daily = data.daily || {}, login = data.login || {};
    const got = map(daily.got, ['eat','tags','boss','m','all'], 1);
    const result = {
      best: number(data.best, 0, 1e12), runs: number(data.runs, 0, 1e9, true), run: null,
      coins: number(data.coins, 0, 1e250), pearls: number(data.pearls, 0, 1e12, true),
      free10: map(data.free10, ['weapon','skin'], 1, {weapon: 1, skin: 1}), gifts: safeGifts, giftIds,
      login: {last: date(login.last), days: number(login.days, 0, 7, true)},
      daily: {day: date(daily.day), eat: number(daily.eat, 0, 1e12, true), tags: number(daily.tags, 0, 1e12, true), boss: number(daily.boss, 0, 1e12, true), m: number(daily.m, 0, 1e12), got},
      maxStage: number(data.maxStage, 0, 1e6, true), pity: map(data.pity, ['weapon','skin'], 49, {weapon: 0, skin: 0}),
      weapons: ownedWeapons, weapon, skins: ownedSkins, skin,
    };
    if (JSON.stringify(result).length > MAX_LENGTH) throw Error('save-limit');
    return result;
  }
  return {normalize, MAX_LENGTH};
})();

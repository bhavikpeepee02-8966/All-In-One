/* db.js — શેર્ડ માર્કેટ ડેટાબેઝ (બધી એપ આ જ ફાઇલ વાપરશે)
   દિવસનો રેકોર્ડ: {d:'YYYY-MM-DD', rows:[[sym,series,open,high,low,close,prevClose,volume,value,isin],...]} */
(function (w) {
  const DB = 'MarketHub', V = 1, MAX = 500;
  let db = null;
  const rq = r => new Promise((s, j) => { r.onsuccess = () => s(r.result); r.onerror = () => j(r.error); });
  const st = (n, m) => db.transaction(n, m).objectStore(n);

  async function open() {
    if (db) return db;
    db = await new Promise((s, j) => {
      const q = indexedDB.open(DB, V);
      q.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('days')) d.createObjectStore('days', { keyPath: 'd' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'k' });
      };
      q.onsuccess = () => s(q.result);
      q.onerror = () => j(q.error);
    });
    db.onversionchange = () => { db.close(); db = null; };
    return db;
  }

  async function dates() { await open(); return (await rq(st('days', 'readonly').getAllKeys())).sort(); }
  async function putDay(day) { await open(); await rq(st('days', 'readwrite').put(day)); }
  async function getDay(d) { await open(); return rq(st('days', 'readonly').get(d)); }
  async function getAll() {
    await open();
    const a = await rq(st('days', 'readonly').getAll());
    return a.sort((x, y) => (x.d < y.d ? -1 : 1));
  }
  async function trim() {
    const ds = await dates();
    const extra = ds.length - MAX;
    if (extra <= 0) return 0;
    for (const d of ds.slice(0, extra)) await rq(st('days', 'readwrite').delete(d));
    return extra;
  }
  async function holidays() {
    await open();
    const r = await rq(st('meta', 'readonly').get('hol'));
    return r ? r.list : [];
  }
  async function setHolidays(list) {
    await open();
    await rq(st('meta', 'readwrite').put({ k: 'hol', list: [...new Set(list)].sort() }));
  }
  async function addHoliday(d) { await setHolidays([...(await holidays()), d]); }
  async function removeHoliday(d) { await setHolidays((await holidays()).filter(x => x !== d)); }
  async function clear() { await open(); await rq(st('days', 'readwrite').clear()); }

  /* શનિ-રવિ અને રજા સિવાય ખૂટતા દિવસ (પહેલી થી છેલ્લી તારીખ વચ્ચે) */
  function missingDays(ds, hol) {
    if (ds.length < 2) return [];
    const have = new Set(ds), h = new Set(hol), out = [];
    const t = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
    const end = t(ds[ds.length - 1]);
    for (let x = t(ds[0]); x <= end; x += 864e5) {
      const dt = new Date(x), g = dt.getUTCDay();
      if (g === 0 || g === 6) continue;
      const s = dt.toISOString().slice(0, 10);
      if (!have.has(s) && !h.has(s)) out.push(s);
    }
    return out;
  }

  async function status() {
    const ds = await dates(), hol = await holidays();
    return { dates: ds, count: ds.length, first: ds[0] || null, last: ds[ds.length - 1] || null, holidays: hol, missing: missingDays(ds, hol) };
  }

  /* ભારતીય સમય (IST) મુજબ આજની તારીખ */
  function todayIST() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); }
  function fmt(d) {
    if (!d) return '—';
    const M = ['જાન્યુ', 'ફેબ્રુ', 'માર્ચ', 'એપ્રિલ', 'મે', 'જૂન', 'જુલાઈ', 'ઑગસ્ટ', 'સપ્ટે', 'ઑક્ટો', 'નવે', 'ડિસે'];
    return d.slice(8, 10) + ' ' + M[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4);
  }

  w.MarketDB = { MAX, open, dates, putDay, getDay, getAll, trim, holidays, addHoliday, removeHoliday, clear, missingDays, status, todayIST, fmt };
})(window);

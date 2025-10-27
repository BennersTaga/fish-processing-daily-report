// ===== Config =====
const SHEET_DB = 'さばき日報_DB';
const TZ = 'Asia/Tokyo';
const ALLOW_ORIGINS = ['https://fish-processing-daily-report.vercel.app']; // 必要に応じ追加
const REQUIRE_API_KEY = false; // trueにする場合はX-API-KEYをチェック
const API_KEY = 'change-me-if-use'; // Vercelの環境変数と合わせる

// ===== Entry points =====
function doPost(e) {
  const origin = e?.parameter?.origin || '';
  if (!isAllowedOrigin(origin)) return respond({ ok: false, error: 'forbidden origin' });
  if (REQUIRE_API_KEY && !isValidKey(e)) return respond({ ok: false, error: 'unauthorized' });

  const action = (e?.parameter?.action || '').toLowerCase();
  const type = (e?.parameter?.type || '').toLowerCase();

  try {
    if (action === 'record') {
      const body = parseBody(e);
      const res = appendAction(body, type || body.type);
      audit('record', body.ticketId, origin);
      return respond({ ok: true, result: res });
    }
    if (action === 'uploadb64') {
      const p = parseBody(e);
      const r = uploadB64(p);
      audit('uploadB64', p.ticketId, origin);
      return respond({ ok: true, result: r });
    }
    if (action === 'intake' || action === 'inventory') {
      const b = parseBody(e);
      const r = appendAction(b, action);
      audit(action, b.ticketId, origin);
      return respond({ ok: true, result: r });
    }
    return respond({ ok: false, error: 'unknown action', action });
  } catch (err) {
    return respond({ ok: false, error: String((err && err.message) || err) });
  }
}

function doGet(e) {
  const origin = e?.parameter?.origin || '';
  if (!isAllowedOrigin(origin)) return respond({ ok: false, error: 'forbidden origin' });
  if (REQUIRE_API_KEY && !isValidKey(e)) return respond({ ok: false, error: 'unauthorized' });

  const action = (e?.parameter?.action || '').toLowerCase();
  try {
    if (action === 'list') {
      const month = e?.parameter?.month;
      return respond({ ok: true, items: listMonth(month) });
    }
    if (action === 'ticket') {
      const id = e?.parameter?.id;
      return respond({ ok: true, item: findByTicketId(id) });
    }
    if (action === 'masters') {
      return respond({ ok: true, master: loadMaster() });
    }
    return respond({ ok: false, error: 'unknown action', action });
  } catch (err) {
    return respond({ ok: false, error: String((err && err.message) || err) });
  }
}

// ===== Helpers =====
function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function parseBody(e) {
  try {
    return JSON.parse(e?.postData?.contents || '{}');
  } catch (_err) {
    return {};
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return ALLOW_ORIGINS.some(function (o) {
    return origin.indexOf(o) === 0;
  });
}

function isValidKey(e) {
  try {
    const parsed = e?.postData?.contents ? JSON.parse(e.postData.contents) : {};
    const key = e?.parameter?.apiKey || e?.parameter?.apikey || parsed.apiKey || '';
    return key === API_KEY;
  } catch (err) {
    return false;
  }
}

function nowStr() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm:ss');
}

function getDbSheet() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_DB);
  if (!sh) throw new Error('Sheet "' + SHEET_DB + '" not found');
  return sh;
}

function readHeaders(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function hhmmOf_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, TZ, 'HH:mm');
  }
  var m = String(v || '').match(/(\d{1,2}):(\d{2})/);
  return m ? (('0' + m[1]).slice(-2) + ':' + m[2]) : '';
}
function baseTicketId_(id) {
  return String(id || '').replace(/[PS]$/, '');
}
function ymOf_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, TZ, 'yyyy-MM');
  }
  return String(v || '').slice(0, 7);
}

var FACTORY_CODE = {
  '羽野': 'HN',
  '大道': 'OD',
  '原田': 'HD',
};

function zero(n, len) {
  return ('000000' + n).slice(-len);
}

function yyyymmddFrom(row) {
  var raw = String((row && (row.purchaseDate || row.date)) || '');
  if (!raw) return Utilities.formatDate(new Date(), TZ, 'yyyyMMdd');
  return raw.replace(/[^0-9]/g, '').slice(0, 8);
}

function factoryAbbr(name) {
  var ab = FACTORY_CODE[name] || 'XX';
  return String(ab).toUpperCase();
}

function nextSeq(yyyymmdd, abbr) {
  var sh = getDbSheet();
  var last = sh.getLastRow();
  if (last < 2) return 1;
  var headers = readHeaders(sh);
  var idx = {};
  headers.forEach(function (h, i) {
    idx[h] = i;
  });
  var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  var re = new RegExp('^' + yyyymmdd + abbr + '(\\d{3})[PS]$');
  var max = 0;
  for (var i = 0; i < vals.length; i++) {
    var id = String((vals[i][idx['ticketId']] || ''));
    var m = id.match(re);
    if (m) {
      var n = Number(m[1] || 0);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

function createTicketIdForIntake(row) {
  var y = yyyymmddFrom(row);
  var ab = factoryAbbr(row && row.factory);
  var n = nextSeq(y, ab);
  var root = y + ab + zero(n, 3);
  return root + 'P';
}

function appendAction(row, type) {
  const sh = getDbSheet();
  const headers = readHeaders(sh);
  if (type === 'intake' && !row.ticketId) {
    row.ticketId = createTicketIdForIntake(row);
  }

  if (row.ticketId && findRowIndexByTicketId(row.ticketId) > 0) {
    if (type === 'intake') {
      var y = yyyymmddFrom(row);
      var ab = factoryAbbr(row && row.factory);
      var n = nextSeq(y, ab);
      row.ticketId = y + ab + zero(n, 3) + 'P';
      if (findRowIndexByTicketId(row.ticketId) > 0) {
        return { skipped: true, reason: 'duplicate ticketId', ticketId: row.ticketId };
      }
    } else {
      return { skipped: true, reason: 'duplicate ticketId', ticketId: row.ticketId };
    }
  }
  const rec = headers.map(function (h) {
    if (h === 'timestamp') return row.timestamp || nowStr();
    if (h === 'type') return type || row.type || '';
    return row[h] != null ? row[h] : '';
  });
  sh.appendRow(rec);
  return { appended: true, ticketId: row.ticketId };
}

function listMonth(month) {
  const sh = getDbSheet();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const headers = readHeaders(sh);
  const idx = Object.fromEntries(headers.map(function (h, i) {
    return [h, i];
  }));
  const vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  const map = {};
  const order = [];

  for (let i = 0; i < vals.length; i++) {
    const r = vals[i];
    const base = baseTicketId_(r[idx['ticketId']]);
    if (!base) continue;
    if (!map[base]) {
      map[base] = {
        firstDate: r[idx['date']] || '',
        firstTs: r[idx['timestamp']] || '',
        intakeDate: null,
        intakeTs: null,
        species: r[idx['species']] || '',
        factory: r[idx['factory']] || '',
        hasInventory: false,
      };
      order.push(base);
    }
    const t = String(r[idx['type']] || '').toLowerCase();
    if (t === 'intake') {
      map[base].intakeDate = r[idx['date']];
      map[base].intakeTs = r[idx['timestamp']];
      map[base].species = r[idx['species']] || map[base].species;
      map[base].factory = r[idx['factory']] || map[base].factory;
    } else if (t === 'inventory') {
      map[base].hasInventory = true;
    }
  }

  const items = [];
  for (const k of order) {
    const entry = map[k];
    const date = entry.intakeDate != null ? entry.intakeDate : entry.firstDate;
    if (month && ymOf_(date) !== month) continue;

    const ts = entry.intakeTs != null ? entry.intakeTs : entry.firstTs;
    items.push({
      date: date,
      type: entry.hasInventory ? 'inventory' : 'intake',
      ticketId: k + 'P',
      species: entry.species,
      factory: entry.factory,
      status: entry.hasInventory ? '報告完了' : '仕入',
      reportTime: hhmmOf_(ts),
    });
  }
  return items;
}

function findByTicketId(id) {
  if (!id) return null;
  const sh = getDbSheet();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const headers = readHeaders(sh);
  const idx = {};
  headers.forEach(function (h, i) {
    idx[h] = i;
  });
  const vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][idx['ticketId']] === id) {
      var result = {};
      headers.forEach(function (h, col) {
        result[h] = vals[i][col];
      });
      return result;
    }
  }
  return null;
}

function findRowIndexByTicketId(id) {
  if (!id) return -1;
  const sh = getDbSheet();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const headers = readHeaders(sh);
  const idx = {};
  headers.forEach(function (h, i) {
    idx[h] = i;
  });
  const vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][idx['ticketId']] === id) {
      return i + 2;
    }
  }
  return -1;
}

function uploadB64(p) {
  if (!p || !p.contentB64) throw new Error('contentB64 required');
  const name = p.fileName || (p.ticketId ? p.ticketId + '.png' : 'upload_' + Date.now() + '.png');
  const mime = p.mimeType || 'image/png';
  const blob = Utilities.newBlob(Utilities.base64Decode(p.contentB64), mime, name);
  const file = DriveApp.getRootFolder().createFile(blob);
  return { id: file.getId(), url: file.getUrl(), name: file.getName() };
}

function audit(action, ticketId, origin) {
  // 任意：監査ログを別シートに出す場合はここに実装
}

function loadMaster() {
  // 任意：マスター情報を別シートから読み込む場合に実装
  return {};
}

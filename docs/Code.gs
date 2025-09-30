/**
 * Fish Daily Report API (Sheets + Drive)
 * Google Apps Script entry point. Deploy as a Web App with anonymous access.
 */
const SPREADSHEET_ID = '1Dxn1eeWPx-FJErBvnMG1QXFt57LYFIhts6NaPlycKo8';
const SHEET_LIST = 'リスト';
const SHEET_ACTION = 'action';
const DRIVE_FOLDER_ID_PHOTOS = '1h3RCYDQrsNuBObQwKXsYM-HYtk8kE5R5';

function _cors(resp) {
  return ContentService.createTextOutput(resp)
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function doOptions() {
  return _cors(JSON.stringify({ ok: true }));
}

function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();
  if (action === 'master') return _cors(JSON.stringify(readMaster()));
  return _cors(JSON.stringify({ error: 'unknown action' }));
}

function doPost(e) {
  const action = (e.parameter.action || '').toLowerCase();
  if (action === 'intake') return _cors(JSON.stringify(appendAction(JSON.parse(e.postData.contents), 'intake')));
  if (action === 'inventory') return _cors(JSON.stringify(appendAction(JSON.parse(e.postData.contents), 'inventory')));
  if (action === 'upload') return _cors(JSON.stringify(uploadFiles(e)));
  return _cors(JSON.stringify({ error: 'unknown action' }));
}

function readMaster() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_LIST);
  const values = sh.getDataRange().getValues();
  if (values.length < 3) return {};
  const ids = values[1].map(String);
  const out = {};
  for (let c = 0; c < ids.length; c++) {
    const id = ids[c];
    if (!id) continue;
    const arr = [];
    for (let r = 2; r < values.length; r++) {
      const v = values[r][c];
      if (v !== '') arr.push(String(v));
    }
    out[id] = arr;
  }
  return out;
}

function appendAction(payload, kind) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_ACTION);
  if (!sh) throw new Error('action sheet not found');

  const now = new Date();
  payload._type = kind;
  payload._ts = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  const headers = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0] : [];
  const keys = Object.keys(payload);
  keys.forEach((k) => {
    if (headers.indexOf(k) === -1) headers.push(k);
  });
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);

  const row = headers.map((h) => (payload[h] ?? ''));
  sh.appendRow(row);
  return { ok: true, row: sh.getLastRow() };
}

function uploadFiles(e) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID_PHOTOS);
  const meta = JSON.parse(e.parameter.meta || '{}');
  const result = [];
  const files = e.parameter.file;
  const blobs = [];
  if (files) {
    if (files.length) {
      for (let i = 0; i < files.length; i++) {
        blobs.push(Utilities.newBlob(Utilities.base64Decode(files[i].split(',')[1]), 'image/jpeg', `${meta.prefix || 'photo'}_${i}.jpg`));
      }
    } else {
      blobs.push(Utilities.newBlob(Utilities.base64Decode(files.split(',')[1]), 'image/jpeg', `${meta.prefix || 'photo'}_0.jpg`));
    }
  }
  blobs.forEach((blob) => {
    const file = folder.createFile(blob);
    result.push({ id: file.getId(), name: file.getName() });
  });
  return { ok: true, files: result };
}

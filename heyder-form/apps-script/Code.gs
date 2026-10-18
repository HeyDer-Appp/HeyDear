// HeyDer form -> Google Sheet.  Paste into Extensions > Apps Script of the sheet, then Deploy > Web app.
const SECRET = 'CHANGE-THIS-TO-A-LONG-RANDOM-STRING';   // same value as GOOGLE_SCRIPT_SECRET in .env

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return out({ ok: false, error: 'bad secret' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(d.tab) || ss.insertSheet(d.tab);
    if (sh.getLastRow() === 0) {
      sh.appendRow(d.headers);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, d.headers.length).setFontWeight('bold');
    }

    // Row is matched by Submission ID (column A): update if it exists, otherwise append.
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().flat() : [];
    const i = ids.indexOf(d.row[0]);
    if (i === -1) sh.appendRow(d.row);
    else sh.getRange(i + 2, 1, 1, d.row.length).setValues([d.row]);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

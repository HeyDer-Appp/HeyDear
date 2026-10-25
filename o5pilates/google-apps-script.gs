/**
 * O5 Pilates — waiting-list receiver
 * 1. Open the sheet: https://docs.google.com/spreadsheets/d/1Im7xs-4t_ZU5MOqe4OdGoBDcXDWDK_OrFBZXfNvvuDk/edit
 * 2. Extensions > Apps Script > paste this file > Save.
 * 3. Deploy > New deployment > type "Web app"
 *      Execute as: Me   |   Who has access: Anyone
 * 4. Copy the Web app URL into SHEET_URL in js/main.js.
 * Every submit adds a row. Open the sheet any time, or File > Download > .xlsx for Excel.
 */
const SHEET_ID = "1Im7xs-4t_ZU5MOqe4OdGoBDcXDWDK_OrFBZXfNvvuDk";
const SHEET_NAME = "Waitlist";
const HEADERS = ["Timestamp", "Name", "WhatsApp", "Email", "Interested in", "Note", "Page"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#e6d6c5");
      sh.setFrozenRows(1);
    }
    const p = e.parameter;
    sh.appendRow([
      Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM yyyy, hh:mm a"),
      p.name || "",
      "'" + (p.phone || ""),
      p.email || "",
      p.interest || "",
      p.note || "",
      p.page || "",
    ]);
    return ContentService.createTextOutput("ok");
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput("O5 waitlist endpoint is live.");
}

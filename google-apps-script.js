function doPost(event) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lock = LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const values = event.parameter;

    sheet.appendRow([
      new Date(),
      values.attendance || "",
      values.name || "",
      values.contact || "",
      values.email || "",
      values.count || "",
      values.message || "",
      values.submittedAt || "",
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

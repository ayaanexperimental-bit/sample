const FAILURE_LOG_SECRET = "REPLACE_WITH_LONG_RANDOM_SECRET";
const SPREADSHEET_ID = "1D1orv4pqfmI7WRGzvCP_jMspFlAQPaXTDm5H3HerxO8";
const SHEET_NAME = "AUTOMATION FAILURES";

const HEADERS = [
  "Timestamp",
  "Razorpay Payment ID",
  "Order ID",
  "Full Name",
  "Email ID",
  "Mobile Number",
  "Bot Status",
  "Failure Status",
  "Retry Count",
  "Last Error",
  "Recovered At",
  "Manual Follow-up"
];

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents || "{}");

    if (payload.secret !== FAILURE_LOG_SECRET) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const sheet = getOrCreateSheet();
    const rowIndex = findRowByPaymentId(sheet, payload.razorpay_payment_id);

    if (payload.action === "upsert_failure") {
      const values = [
        payload.timestamp || "",
        payload.razorpay_payment_id || "",
        payload.razorpay_order_id || "",
        payload.full_name || "",
        payload.email || "",
        payload.phone_number || "",
        payload.bot_status || "Offline",
        payload.failure_status || "Active",
        payload.retry_count || 0,
        payload.last_error || "",
        payload.recovered_at || "",
        payload.manual_followup || "Manual follow-up required until this row is resolved."
      ];

      if (rowIndex > 1) {
        sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([values]);
      } else {
        sheet.appendRow(values);
      }

      return jsonResponse({ ok: true, action: "upsert_failure" });
    }

    if (payload.action === "mark_resolved") {
      if (rowIndex > 1) {
        sheet.getRange(rowIndex, 7, 1, 6).setValues([[
          "Online",
          "Resolved",
          payload.retry_count || "",
          payload.last_error || "",
          payload.recovered_at || new Date().toISOString(),
          payload.manual_followup || "Resolved by retry."
        ]]);
      }

      return jsonResponse({ ok: true, action: "mark_resolved", found: rowIndex > 1 });
    }

    return jsonResponse({ ok: false, error: "Unknown action" }, 400);
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) }, 500);
  }
}

function getOrCreateSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const headersMissing = HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (headersMissing) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground("#fbbc04")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
  }

  return sheet;
}

function findRowByPaymentId(sheet, paymentId) {
  if (!paymentId || sheet.getLastRow() < 2) {
    return -1;
  }

  const paymentIds = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();

  for (let index = 0; index < paymentIds.length; index += 1) {
    if (paymentIds[index][0] === paymentId) {
      return index + 2;
    }
  }

  return -1;
}

function jsonResponse(body, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify({ ...body, statusCode: statusCode || 200 }))
    .setMimeType(ContentService.MimeType.JSON);
}

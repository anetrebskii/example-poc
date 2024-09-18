import { AvitoListItem, scrapeSearchResults } from "./lib";
import { google } from "googleapis";
import { authenticate } from "@google-cloud/local-auth";
import { JWT } from "google-auth-library";
import puppeteer, { Browser } from "puppeteer";

console.log("Hello from ts-node in GitHub Actions!");

type GoogleSheetRecord = AvitoListItem & {
  lastFoundIn: string;
};

async function getAuthClient() {
  // You'll need to set up credentials and download a JSON key file
  // from the Google Cloud Console
  const auth = new JWT({
    keyFile:
      "creds.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  return auth;
}

async function updateGoogleSheet(sheet: string, records: GoogleSheetRecord[]) {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = "1516pEtVknzNlMRmMq5NlOa3hUTgL2xPLl_aY_QylnwE";
  const range = sheet+"!A:F"; // Adjust based on your sheet structure

  // Get existing records
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const existingRecords = response.data.values || [];
  const updatedRecords = [];

  for (const record of records) {
    const existingIndex = existingRecords.findIndex(
      (row) => row[4] === record.url
    );
    if (existingIndex !== -1) {
      // Update existing record
      existingRecords[existingIndex] = [
        record.title,
        record.description,
        record.price.toString(),
        record.address,
        record.url,
        record.lastFoundIn,
        existingRecords[existingIndex][6],
      ];
    } else {
      // Add new record
      updatedRecords.push([
        record.title,
        record.description,
        record.price.toString(),
        record.address,
        record.url,
        record.lastFoundIn,
        new Date(),
      ]);
    }
  }

  // Update existing records
  if (existingRecords.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: existingRecords },
    });
  }

  // Append new records
  if (updatedRecords.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: updatedRecords },
    });
  }
}

async function loadData(baseUrl: string, sheet: string, browser: Browser) {
    let pageNumber = 1;
    let googleSheetRecords: GoogleSheetRecord[] = [];
    await updateGoogleSheet(sheet, []);
    do {
      
      let url = baseUrl;
      if (pageNumber > 1) {
        url +=  "?p=" + pageNumber;  
      }

      console.log("load page: " + pageNumber + ", with url: " + url);
      
      const searchResult = await scrapeSearchResults(url, browser);

      googleSheetRecords = [];
      googleSheetRecords = searchResult.map((x) => ({
        ...x,
        lastFoundIn: new Date().toISOString(),
      }));

      await updateGoogleSheet(sheet, googleSheetRecords);
      console.log("Google Sheet " + sheet + " updated successfully");
      pageNumber = pageNumber + 1;

      // Add a 20-second wait
      console.log("Waiting for 20 seconds before the next request...");
      await new Promise((resolve) => setTimeout(resolve, 20000));
    } while (googleSheetRecords.length > 0);
}

(async function () {
  try {
    const browser = await puppeteer.launch({ headless: "new", timeout: 120000 });

    await loadData(
        "https://www.avito.ru/samara/garazhi_i_mashinomesta/sdam",
        "Rent",
        browser
    )
        
    await loadData(
        "https://www.avito.ru/samara/garazhi_i_mashinomesta/prodam",
        "Sell",
        browser
    );


  } catch (error) {
    console.error("An error occurred:", error);
  }
})();

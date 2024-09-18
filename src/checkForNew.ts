import puppeteer from "puppeteer";
import { scrapeSearchResults } from "./lib";
import axios from "axios";

(async function () {
    try {
      const browser = await puppeteer.launch({
        headless: "new",
        timeout: 240000,
      });

      const searchResult = await scrapeSearchResults("https://www.avito.ru/samara/garazhi_i_mashinomesta/prodam", browser);
      const goodAds = searchResult.filter(x =>
         x.address.toLowerCase() == 'Никитинская ул., 53А'.toLowerCase() && x.price < 750000);

      // Send good ads to Telegram channel
      for (const ad of goodAds) {
          const message = `Ad: ${ad.title}\nPrice: ${ad.price}\nAddress: ${ad.address}\nUrl: ${ad.url}`;
          await axios.post(`https://api.telegram.org/bot${process.env.TG_SECRET}/sendMessage`, {
              chat_id: process.env.TG_CHANEL,
              text: message,
          });
      }

    } catch (error) {
      console.error("An error occurred:", error);
    }
})();
import puppeteer, { Browser } from "puppeteer";

export type AvitoListItem = {
  title: string;
  description: string;
  price: number;
  address: string;
  url: string;
};

export type AvitoDetailedItem = {
  id: string;
  postedAt: string;
};

export async function scrapeSearchResults(
  url: string,
  browser: Browser
): Promise<AvitoListItem[]> {
  
  const page = await browser.newPage();
  try {
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 240000  }); // Увеличено время ожидания
    // await page.waitForSelector('div[data-marker="item"]');
    const shortListing: AvitoListItem[] = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll('div[data-marker="item"]')
      );
      console.log(items);

      return items.map((item) => {
        const titleElement = item.querySelector('[itemprop="name"]');
        const title = titleElement?.textContent?.trim();
        const description = item
          .querySelector('[itemprop="description"]')
          ?.getAttribute("content");
        const price = parseFloat(
          item.querySelector('[itemprop="price"]')!.getAttribute("content")!
        );
        const address = item
          .querySelector('[data-marker="item-address"] span')
          ?.textContent?.trim();

        // Extract URL
        const urlElement = item.querySelector('a[itemprop="url"]');
        const url = urlElement
          ? new URL(urlElement.getAttribute("href")!, window.location.origin)
              .href
          : "";

        return {
          title,
          description,
          price,
          address,
          url,
        } as AvitoListItem;
      });
    });

    return shortListing;
  } catch (error) {
    console.error("An error occurred during scraping:", error);
    throw error;
  } finally {
    // try {
    //   await page.close();
    // } catch (closeError) {
    //   console.error("Failed to close the detailed page:", closeError);
    // }

    // try {
    //   await browser.close();
    // } catch (closeError) {
    //   console.error("Failed to close the browser:", closeError);
    // }
  }
}

async function scrapeDetailedPage(url: string): Promise<AvitoDetailedItem> {
  const browser = await puppeteer.launch({ headless: "new" });
  const detailedPage = await browser.newPage();
  try {
    await detailedPage.goto(url);
    const evaluateResult = await detailedPage.evaluate(() => {
      const id = document
        .querySelector('[data-marker="item-view/item-id"]')!
        .textContent!.trim()
        .split("№")[1]
        .trim()!;
      const postedAtString = document
        .querySelector('[data-marker="item-view/item-date"]')
        ?.textContent?.trim();
      return { id, postedAtString };
    });
    // const postedAt = parseRussianDate(evaluateResult.postedAtString!);
    return {
      id: evaluateResult.id,
      postedAt: evaluateResult.postedAtString!,
    };
  } finally {
    await detailedPage.close();
    await browser.close();
  }
}

function parseRussianDate(dateString: string): Date {
  // "сегодня в 11:57", "13 сентября в 22:07",
  // Handle "сегодня" and "вчера"
  const todayRegex = /сегодня в (\d{1,2}:\d{2})/;
  const yesterdayRegex = /вчера в (\d{1,2}:\d{2})/;

  const todayMatch = dateString.match(todayRegex);
  if (todayMatch) {
    const time = todayMatch[1];
    const today = new Date();
    const [hours, minutes] = time.split(":").map(Number);
    today.setHours(hours, minutes, 0, 0);
    return today;
  }

  const yesterdayMatch = dateString.match(yesterdayRegex);
  if (yesterdayMatch) {
    const time = yesterdayMatch[1];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const [hours, minutes] = time.split(":").map(Number);
    yesterday.setHours(hours, minutes, 0, 0);
    return yesterday;
  }

  // Handle "13 сентября в 22:07"
  const specificDateRegex = /(\d{1,2}) (\w+) в (\d{1,2}:\d{2})/;
  const specificDateMatch = dateString.match(specificDateRegex);
  if (specificDateMatch) {
    const day = parseInt(specificDateMatch[1], 10);
    const monthString = specificDateMatch[2];
    const time = specificDateMatch[3];
    const month = new Date(Date.parse(`${monthString} 1, 2020`)).getMonth(); // Use a dummy year to get the month index
    const [hours, minutes] = time.split(":").map(Number);

    const date = new Date();
    date.setDate(day);
    date.setMonth(month);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  console.warn(`Unable to parse date: ${dateString}`);
  return new Date(1970, 1, 1); // Return current date as fallback
}

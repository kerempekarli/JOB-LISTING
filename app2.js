const puppeteer = require("puppeteer");

async function launchBrowser() {
  return await puppeteer.launch({ headless: false });
}

async function openPage(browser) {
  const page = await browser.newPage();
  await page.goto(
    "https://www.arbeitsagentur.de/bewerberboerse/suche?entfernungGrob=0&sort=veroeffdatum&angebotsart=1",
    { waitUntil: "networkidle2" }
  );
  return page;
}

async function closeCookieModal(page) {
  try {
    await page.evaluate(() => {
      const shadowHost = document.querySelector(
        "body > bahf-cookie-disclaimer-dpl3"
      );
      const shadowRoot = shadowHost.shadowRoot;
      const modal = shadowRoot.querySelector("#bahf-cookie-disclaimer-modal");

      if (modal && modal.style.display === "block") {
        const closeButton = modal.querySelector(
          "div.modal-footer.sc-bahf-cd-modal > button.ba-btn.ba-btn-contrast.sc-bahf-cd-modal"
        );
        closeButton.click();
      }
    });
    console.log("Cookie modal closed.");
  } catch (error) {
    console.log("Cookie modal not found or could not be closed.");
  }
}

async function collectLinks(page, startIndex) {
  return await page.evaluate((startIndex) => {
    const items = [];
    for (let i = startIndex; i < startIndex + 25; i++) {
      const item = document.querySelector(`#ergebnisliste-item-${i}`);
      if (item) items.push({ link: item.href, index: i });
    }
    return items;
  }, startIndex);
}

async function clickLoadMoreButton(page, nextItemIndex) {
  // "Load More" düğmesini tekrar tekrar deneyecek bir süre döngüsü ekleyelim
  for (let attempt = 0; attempt < 5; attempt++) {
    // 5 deneme yapıyoruz
    const loadMoreButton = await page.$("#ergebnisliste-ladeweitere-button");

    if (loadMoreButton) {
      await loadMoreButton.evaluate((button) => button.scrollIntoView());
      await loadMoreButton.click();

      // 1 saniyelik bekleme ekliyoruz
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        await page.waitForSelector(`#ergebnisliste-item-${nextItemIndex}`, {
          timeout: 10000,
        });
        return true;
      } catch (error) {
        console.log("Yeni item yüklenemedi, yeniden deneniyor...");
      }
    } else {
      console.log("Load More button not found, retrying...");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 saniye bekle ve tekrar dene
    }
  }

  console.log("Load More button still not found after multiple attempts.");
  return false;
}

async function main() {
  const browser = await launchBrowser();
  const page = await openPage(browser);
  await closeCookieModal(page);

  let startIndex = 0;

  while (true) {
    const links = await collectLinks(page, startIndex);
    links.forEach(({ link, index }) => {
      console.log(`${index + 1}. Link: ${link}`);
    });

    startIndex += links.length; // Başlangıç indexini topladığımız link sayısına göre güncelle

    const loadedMore = await clickLoadMoreButton(page, startIndex);
    if (!loadedMore) break;
  }
}

main();

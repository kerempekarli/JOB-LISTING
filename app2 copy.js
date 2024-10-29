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

async function fetchDetails(page, link) {
  const detailPage = await page.browser().newPage();
  await detailPage.goto(link, { waitUntil: "networkidle2" });

  // Verileri topla
  const details = await detailPage.evaluate(() => {
    const title =
      document.querySelector("#detail-kopfbereich-titel")?.innerText ||
      "Başlık bulunamadı";
    const publishedDate =
      document.querySelector("#detail-metalane-veroeffentlicht")?.innerText ||
      "Yayınlanma tarihi bulunamadı";
    const availability =
      document.querySelector("#detail-kopfbereich-verfuegbarkeit")?.innerText ||
      "Uygunluk bilgisi bulunamadı";
    const employmentTypes = Array.from(
      document.querySelectorAll(
        "#detail-kopfbereich-arbeitszeit-0, #detail-kopfbereich-arbeitszeit-1"
      )
    ).map((el) => el.innerText);
    const location =
      document.querySelector("#detail-kopfbereich-lokation-0")?.innerText ||
      "Lokasyon bilgisi bulunamadı";
    const education =
      document.querySelector("#detail-lebenslauf-ausbildung-0")?.innerText ||
      "Eğitim bilgisi bulunamadı";
    const qualification =
      document.querySelector("#detail-lebenslauf-abschluss")?.innerText ||
      "Nitelik bulunamadı";

    const experienceEntries = Array.from(
      document.querySelectorAll(
        "#detail-lebenslauf-listenitem-werdegang-0, #detail-lebenslauf-listenitem-werdegang-1"
      )
    ).map((entry) => {
      const dateRange =
        entry.querySelector(".detailansicht-lebenslauf-listenitem-timespan")
          ?.innerText || "Tarih bilgisi bulunamadı";
      const jobTitle =
        entry.querySelector(
          ".detailansicht-lebenslauf-listenitem-content-header"
        )?.innerText || "Pozisyon bilgisi bulunamadı";
      return { dateRange, jobTitle };
    });

    const languages = Array.from(
      document.querySelectorAll("#detail-bewerberdetail-sprachkenntnis-0-0")
    ).map((lang) => ({
      language: lang.querySelector("p")?.innerText || "Dil bilgisi bulunamadı",
      level: lang.nextElementSibling?.innerText || "Seviye bilgisi bulunamadı",
    }));

    const skills = Array.from(
      document.querySelectorAll(
        "#detail-bewerberdetail-kenntnis-2-0-0, #detail-bewerberdetail-kenntnis-1-0-0"
      )
    ).map((skill) => skill.innerText);

    return {
      title,
      publishedDate,
      availability,
      employmentTypes,
      location,
      education,
      qualification,
      experienceEntries,
      languages,
      skills,
    };
  });

  console.log(`\n--- İş İlanı Detayları ---
Başlık: ${details.title}
Yayınlanma Tarihi: ${details.publishedDate}
Uygunluk: ${details.availability}
İstihdam Türleri: ${details.employmentTypes.join(", ")}
Lokasyon: ${details.location}
Eğitim: ${details.education}
Nitelik: ${details.qualification}
Deneyim:
${details.experienceEntries
  .map(
    (exp) => `  - Tarih Aralığı: ${exp.dateRange}, Pozisyon: ${exp.jobTitle}`
  )
  .join("\n")}
Diller:
${details.languages
  .map((lang) => `  - Dil: ${lang.language}, Seviye: ${lang.level}`)
  .join("\n")}
Yetenekler: ${details.skills.join(", ")}
---`);

  await detailPage.close();
}

async function clickLoadMoreButton(page, nextItemIndex) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const loadMoreButton = await page.$("#ergebnisliste-ladeweitere-button");

    if (loadMoreButton) {
      await loadMoreButton.evaluate((button) => button.scrollIntoView());
      await loadMoreButton.click();

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
      await new Promise((resolve) => setTimeout(resolve, 1000));
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

    // Her bağlantı için detayları çekiyoruz
    for (const { link, index } of links) {
      console.log(`İş İlanı ${index + 1}: ${link}`);
      await fetchDetails(page, link);
    }

    startIndex += links.length;

    const loadedMore = await clickLoadMoreButton(page, startIndex);
    if (!loadedMore) break;
  }

  await browser.close();
}

main();

const puppeteer = require("puppeteer");
const fs = require("fs");

const MAIN_URL =
  "https://www.arbeitsagentur.de/bewerberboerse/suche?entfernungGrob=0&angebotsart=1";

// Verilen iş ilanlarını JSON dosyasına yazma
function writeJobDetailsToFile(jobDetails) {
  fs.writeFileSync("jobDetails.json", JSON.stringify(jobDetails, null, 2));
  console.log("İş ilanları jobDetails.json dosyasına yazıldı.");
}

// Son 25 iş ilanı linkini alma fonksiyonu
async function getLast25JobLinks(page) {
  console.log("Son 25 linki toplama işlemi başladı...");
  const linksOnPage = await page.evaluate(() => {
    const links = [];
    const anchorElements = document.querySelectorAll(
      "#ergebnisliste-liste-1 li a"
    );
    anchorElements.forEach((a) => {
      const href = a.href;
      if (
        href &&
        href.startsWith(
          "https://www.arbeitsagentur.de/bewerberboerse/bewerberdetail/"
        )
      ) {
        links.push(href);
      }
    });
    return links.slice(-25); // Son 25 linki al
  });

  console.log(`Son 25 link alındı, toplam ${linksOnPage.length} link bulundu.`);
  return linksOnPage;
}

// İş ilanı detaylarını çekme fonksiyonu
async function extractJobDetails(detailPage, jobUrl, jobNumber) {
  try {
    console.log(`(${jobNumber}) Detaylar için ${jobUrl} adresine gidiliyor...`);
    await detailPage.goto(jobUrl, { waitUntil: "networkidle0" });

    console.log(`(${jobNumber}) Detaylar için ana konteyner bekleniyor...`);
    await detailPage.waitForSelector("#bewerberdetail-container");

    console.log(
      `(${jobNumber}) ${jobUrl} adresinden iş detayları çekiliyor...`
    );

    // Detayları çekme
    const jobData = await detailPage.evaluate((jobUrl) => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerText.trim() : null;
      };

      const getList = (selector) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map((el) => el.innerText.trim());
      };

      // İş ilanı verilerini alma
      const title = getText("#detail-kopfbereich-titel");
      const publicationDate = getText("#detail-metalane-veroeffentlicht");
      const availability = getText("#detail-kopfbereich-verfuegbarkeit");
      const jobType = getList("#detail-kopfbereich-arbeitszeit-0");
      const locations = getList(".lokation-list li");
      const experience = getText("#detail-lebenslauf-berufsfelderfahrung-0");
      const lastPosition = getText("#detail-lebenslauf-letzte-taetigkeit");
      const education = getList('[id^="detail-lebenslauf-ausbildung-"]');
      const skills = getList("#detail-bewerberdetail-kompetenzen ul li");
      const languages = getList(
        "#detail-bewerberdetail-sprachkenntnisse ul li"
      );
      const mobility = getList("#detail-bewerberdetail-mobilitaet + ul li");
      const additionalSkills = getList(
        "#detail-bewerberdetail-kenntnisse ul li"
      );

      return {
        title,
        publicationDate,
        availability,
        jobType,
        locations,
        experience,
        lastPosition,
        education,
        skills,
        languages,
        mobility,
        additionalSkills,
        jobUrl,
      };
    }, jobUrl);

    console.log(`(${jobNumber}) Detaylar başarıyla çekildi: ${jobUrl}`);
    return jobData;
  } catch (error) {
    console.error(`(${jobNumber}) Hata oluştu: ${jobUrl}`, error);
    return null;
  }
}

// "Weitere Ergebnisse" butonuna basma fonksiyonu
async function clickLoadMoreButton(page) {
  try {
    console.log("'Weitere Ergebnisse' butonu aranıyor...");
    const loadMoreButton = await page.$("#ergebnisliste-ladeweitere-button");

    if (loadMoreButton) {
      console.log(
        "'Weitere Ergebnisse' butonu bulundu, tıklamaya hazırlanıyor..."
      );
      await page.evaluate(() => {
        const button = document.querySelector(
          "#ergebnisliste-ladeweitere-button"
        );
        if (button) button.scrollIntoView();
      });

      await page.evaluate(() =>
        document.querySelector("#ergebnisliste-ladeweitere-button").click()
      );

      console.log("'Weitere Ergebnisse' butonuna başarıyla tıklandı.");
      await delay(3000); // 3 saniye bekle
    } else {
      console.log("'Weitere Ergebnisse' butonu bulunamadı, son sayfadasınız.");
    }
  } catch (error) {
    console.error(
      "'Weitere Ergebnisse' butonuna tıklarken hata oluştu:",
      error
    );
  }
}

// Gecikme fonksiyonu
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Ana çalışma fonksiyonu
(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage(); // Ana sayfa
  const detailPage = await browser.newPage(); // Detay sayfası

  try {
    console.log("Ana URL'ye gidiliyor...");
    await page.goto(MAIN_URL, { waitUntil: "networkidle0" });

    // İlk modal kapatma işlemi
    await page.waitForSelector("#bahf-cookie-disclaimer-modal");
    await page.click(
      "#bahf-cookie-disclaimer-modal > div > div > div:nth-child(3) > button:nth-child(1)"
    );

    let allJobLinks = [];
    let jobDetails = [];
    let jobNumber = 0;
    let processedLinks = new Set();

    while (true) {
      console.log(`Toplam ${allJobLinks.length} link toplandı...`);

      const links = await getLast25JobLinks(page);

      const newLinks = links.filter((link) => !processedLinks.has(link));
      allJobLinks = allJobLinks.concat(newLinks);
      console.log(
        `Bu partide ${newLinks.length} yeni link bulundu, toplam link sayısı: ${allJobLinks.length}`
      );

      // Detaylar
      for (let i = 0; i < newLinks.length; i++) {
        const link = newLinks[i];
        jobNumber++;
        console.log(`İşlemdeki link ${jobNumber}: ${link}`);

        const details = await extractJobDetails(detailPage, link, jobNumber);
        if (details) {
          jobDetails.push(details);
        }

        processedLinks.add(link);
        await delay(1000);
      }

      // "Weitere Ergebnisse" butonuna tıkla
      await clickLoadMoreButton(page);

      await delay(3000);

      // 100 link toplandıysa işlemi durdur
      if (allJobLinks.length >= 100) {
        console.log("100 link toplandı, döngü durduruluyor...");
        break;
      }
    }

    writeJobDetailsToFile(jobDetails);
  } catch (error) {
    console.error("Tarama sırasında hata:", error);
  } finally {
    await browser.close();
    console.log("Tarayıcı kapatıldı.");
  }
})();

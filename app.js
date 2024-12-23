const { connectToDatabase, sequelize } = require("./db/sequelize");
const JobListing = require("./models/kleinanzeigen");
const axios = require("axios");
const cheerio = require("cheerio");
const cron = require("node-cron");
const moment = require("moment"); // moment kütüphanesini ekliyoruz
const { Op } = require("sequelize");

// Veritabanına bağlan
connectToDatabase();

// Kaç sayfayı tarayacağımızı belirliyoruz
const baseURL = "https://www.kleinanzeigen.de/s-jobs/seite:";
const maxPages = 3; // Örnek olarak 3 sayfa tarıyoruz

// İş arayanları ayıklamak için kullanacağımız anahtar kelimeler
const excludeKeywords = [
  "Gesuch",
  "Ich suche Arbeit",
  "Job gesucht",
  "Suche Job",
];

// HTML elementlerinden arındırılmış düz metin elde etme fonksiyonu
function cleanHtml(html) {
  return cheerio.load(html).text().trim();
}

// En son işlenmiş tarihe göre yeni ilanları getirme
async function getLastProcessedDate() {
  const lastJob = await JobListing.findOne({
    order: [["date", "DESC"]],
  });
  return lastJob ? lastJob.date : new Date(0); // Eğer daha önce kayıt yoksa 1970'ten başlar
}

// Ana sayfadaki ilanların bağlantılarını toplama fonksiyonu
async function fetchJobListings(pageNumber) {
  try {
    const response = await axios.get(`${baseURL}${pageNumber}/c102`);
    const html = response.data;
    const $ = cheerio.load(html);
    const jobLinks = [];

    $("a.ellipsis").each((index, element) => {
      const jobLink = $(element).attr("href");
      jobLinks.push(`https://www.kleinanzeigen.de${jobLink}`);
    });

    return jobLinks;
  } catch (error) {
    console.error(
      `Error fetching job listings from page ${pageNumber}:`,
      error
    );
    return [];
  }
}

// Her ilan sayfasını detaylı olarak çekme ve filtreleme fonksiyonu
async function fetchJobDetails(jobLink, lastProcessedDate) {
  try {
    const response = await axios.get(jobLink);
    const html = response.data;
    const $ = cheerio.load(html);

    const jobTitle = $('meta[itemprop="name"]').attr("content");
    const rawJobDescription = $('meta[itemprop="description"]').attr("content");
    const cleanedDescription = cleanHtml(rawJobDescription);
    const jobLocation = $('span[itemprop="locality"]').text().trim();
    const jobDate = $("#viewad-extra-info .icon-calendar-gray-simple")
      .next()
      .text()
      .trim();

    // Tarihi `30.08.2024` formatından `Date` nesnesine çeviriyoruz
    const jobDateParsed = jobDate
      ? moment(jobDate, "DD.MM.YYYY").toDate()
      : null;

    const jobSalary = $(
      '.addetailslist--detail:contains("Stundenlohn") .addetailslist--detail--value'
    )
      .text()
      .trim();

    // Son işlenmiş tarihe göre yeni ilanları işliyoruz
    if (jobDateParsed && jobDateParsed <= lastProcessedDate) {
      console.log("Bu ilan zaten işlenmiş.");
      return;
    }

    const isJobAd = !excludeKeywords.some((keyword) =>
      cleanedDescription.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isJobAd) {
      try {
        const newJob = await JobListing.create({
          title: jobTitle,
          description: JSON.stringify({ text: cleanedDescription }),
          location: JSON.stringify({ city: jobLocation }),
          date: jobDateParsed,
          salary: jobSalary,
          url: jobLink,
        });
        console.log(`Veritabanına kaydedildi: ${newJob.title}`);
      } catch (dbError) {
        console.error("Veritabanına ekleme hatası:", dbError);
      }
    } else {
      console.log("İş arayan ilanı atlandı.");
    }
  } catch (error) {
    console.error("Error fetching job details:", error);
  }
}

// Belirli bir sayfa aralığında ilanları alıp, detaylarına ulaşma fonksiyonu
async function scrapeJobs() {
  const lastProcessedDate = await getLastProcessedDate();

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    console.log(`Sayfa ${pageNumber} taranıyor...`);
    const jobLinks = await fetchJobListings(pageNumber);

    for (const link of jobLinks) {
      await fetchJobDetails(link, lastProcessedDate);
    }
  }

  sequelize.close();
}

// Cron görevini başlat
// cron.schedule("0 * * * *", () => {
// Her saat başı çalıştıracak şekilde ayarlandı
console.log("Yeni iş ilanları için tarama işlemi başlatıldı...");
sequelize.sync({ force: false }).then(() => {
  scrapeJobs();
});
// });

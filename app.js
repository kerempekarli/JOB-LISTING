const { connectToDatabase, sequelize } = require("./db/sequelize");
const JobListing = require("./models/JobListing");
const axios = require("axios");
const cheerio = require("cheerio");

// Veritabanına bağlan
connectToDatabase();

// Kaç sayfayı tarayacağımızı belirliyoruz
const baseURL = "https://www.kleinanzeigen.de/s-jobs/seite:";
const maxPages = 3; // Örnek olarak 3 sayfa tarıyoruz

// İş arayanları ayıklamak için kullanacağımız anahtar kelimeler
const excludeKeywords = [
  "Gesuch", // İş arayan
  "Ich suche Arbeit", // "İş arıyorum"
  "Job gesucht", // "İş arıyorum"
  "Suche Job", // "İş arıyorum"
];

// HTML elementlerinden arındırılmış düz metin elde etme fonksiyonu
function cleanHtml(html) {
  return cheerio.load(html).text().trim();
}

// Ana sayfadaki ilanların bağlantılarını toplama fonksiyonu
async function fetchJobListings(pageNumber) {
  try {
    const response = await axios.get(`${baseURL}${pageNumber}/c102`); // Dinamik sayfa URL'si
    const html = response.data;
    const $ = cheerio.load(html);
    const jobLinks = [];

    // <a class="ellipsis"> etiketine sahip bağlantıları seçiyoruz
    $("a.ellipsis").each((index, element) => {
      const jobLink = $(element).attr("href");
      jobLinks.push(`https://www.kleinanzeigen.de${jobLink}`); // Tam URL oluşturuyoruz
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
async function fetchJobDetails(jobLink) {
  try {
    const response = await axios.get(jobLink);
    const html = response.data;
    const $ = cheerio.load(html);

    // İş ilanı verilerini topluyoruz
    const jobTitle = $('meta[itemprop="name"]').attr("content");
    const rawJobDescription = $('meta[itemprop="description"]').attr("content");
    const cleanedDescription = cleanHtml(rawJobDescription); // HTML'den arındırılmış açıklama
    const jobLocation = $('span[itemprop="locality"]').text().trim();
    const jobDate = $("#viewad-extra-info .icon-calendar-gray-simple")
      .next()
      .text()
      .trim();
    const jobSalary = $(
      '.addetailslist--detail:contains("Stundenlohn") .addetailslist--detail--value'
    )
      .text()
      .trim();

    // İş arayan ilanları ayıklamak için anahtar kelimeleri kontrol ediyoruz
    const isJobAd = !excludeKeywords.some(
      (keyword) =>
        cleanedDescription.toLowerCase().includes(keyword.toLowerCase()) // Hem açıklamayı hem anahtar kelimeleri küçük harfe çeviriyoruz
    );

    if (isJobAd) {
      // Veritabanına veri ekleme
      try {
        const newJob = await JobListing.create({
          title: jobTitle,
          description: cleanedDescription,
          location: jobLocation,
          date: jobDate ? new Date(jobDate) : null,
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
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
    console.log(`Sayfa ${pageNumber} taranıyor...`);
    const jobLinks = await fetchJobListings(pageNumber); // Her sayfa için ilan bağlantılarını alıyoruz

    // Her bir iş ilanı için detayları çekiyoruz
    for (const link of jobLinks) {
      await fetchJobDetails(link);
    }
  }

  // Tarama işlemi tamamlandığında veritabanını kapatıyoruz
  sequelize.close();
}

// Veritabanı senkronizasyonu yap ve işlemleri başlat
sequelize.sync({ force: true }).then(() => {
  console.log("Veritabanı senkronize edildi.");
  scrapeJobs();
});

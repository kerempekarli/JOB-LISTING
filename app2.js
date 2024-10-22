// scraper.js
const puppeteer = require("puppeteer");
const fs = require("fs");
require("dotenv").config();

const MAIN_URL =
  "https://www.arbeitsagentur.de/bewerberboerse/suche?entfernungGrob=0&angebotsart=1";

// Function to perform login (if required)
async function login(page, username, password) {
  const LOGIN_URL = "https://www.arbeitsagentur.de/login"; // Replace with actual login URL

  await page.goto(LOGIN_URL, { waitUntil: "networkidle0" });

  // Wait for login form
  await page.waitForSelector("#username"); // Adjust selector
  await page.waitForSelector("#password"); // Adjust selector

  // Enter credentials
  await page.type("#username", username, { delay: 100 }); // Adjust selector
  await page.type("#password", password, { delay: 100 }); // Adjust selector

  // Submit the form
  await Promise.all([
    page.click("#login-button"), // Adjust selector
    page.waitForNavigation({ waitUntil: "networkidle0" }),
  ]);

  // Verify login success
  const isLoggedIn = await page.evaluate(() => {
    // Adjust based on page structure after login
    return !!document.querySelector("selector-that-exists-after-login");
  });

  if (!isLoggedIn) {
    throw new Error("Login failed");
  }

  console.log("Successfully logged in.");
}

// Function to get all job links (handle pagination if necessary)
async function getAllJobLinks(page) {
  let jobLinks = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    console.log(`Scraping main page ${currentPage}...`);
    await page.goto(`${MAIN_URL}&page=${currentPage}`, {
      waitUntil: "networkidle0",
    });
    await page.waitForSelector("#ergebnisliste-liste-1");

    const links = await page.evaluate(() => {
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

      return links;
    });

    jobLinks = jobLinks.concat(links);
    console.log(`Found ${links.length} links on page ${currentPage}.`);

    // Check if there's a next page
    hasNextPage = await page.evaluate(() => {
      const nextButton = document.querySelector(
        'a[aria-label="Nächste Seite"]'
      );
      return nextButton && !nextButton.classList.contains("disabled");
    });

    currentPage++;
  }

  return jobLinks;
}

// Function to extract job details from a job detail page
async function extractJobDetails(page, jobUrl) {
  try {
    await page.goto(jobUrl, { waitUntil: "networkidle0" });

    // Wait for the main container to load
    await page.waitForSelector("#bewerberdetail-container");

    // Extract data
    const jobData = await page.evaluate((jobUrl) => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerText.trim() : null;
      };

      const getList = (selector) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map((el) => el.innerText.trim());
      };

      // Job Title
      const title = getText("#detail-kopfbereich-titel");

      // Publication Date
      const publicationDate = getText("#detail-metalane-veroeffentlicht");

      // Availability
      const availability = getText("#detail-kopfbereich-verfuegbarkeit");

      // Job Type
      const jobType = getList("#detail-kopfbereich-arbeitszeit-0");

      // Location
      const locations = getList(".lokation-list li");

      // Experience
      const experience = getText("#detail-lebenslauf-berufsfelderfahrung-0");

      // Last Position
      const lastPosition = getText("#detail-lebenslauf-letzte-taetigkeit");

      // Education (Ausbildung)
      const education = getList('[id^="detail-lebenslauf-ausbildung-"]');

      // Skills (Kompetenzen)
      const skills = getList("#detail-bewerberdetail-kompetenzen ul li");

      // Languages (Sprachkenntnisse)
      const languages = getList(
        "#detail-bewerberdetail-sprachkenntnisse ul li"
      );

      // Mobility (Mobilität)
      const mobility = getList("#detail-bewerberdetail-mobilitaet + ul li");

      // Additional Skills (Kenntnisse)
      const additionalSkills = getList(
        "#detail-bewerberdetail-kenntnisse ul li"
      );

      // Contact Information (if visible, could be restricted to employers)
      const contactInfo = getText(
        ".detailansicht-kontaktdaten-berechtigungsFehler"
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
        contactInfo,
        jobUrl, // Including jobUrl for reference
      };
    }, jobUrl); // Pass jobUrl into evaluate context here

    // Print all collected data to console
    console.log(jobData);
    return jobData;
  } catch (error) {
    console.error(`Error extracting data from ${jobUrl}:`, error);
    return null;
  }
}

// Function to delay execution (replaces waitForTimeout)
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main execution
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Uncomment and configure the following lines if login is required
    /*
    await login(page, process.env.USERNAME, process.env.PASSWORD);
    */

    // Get all job links (handle pagination if necessary)
    const links = await getAllJobLinks(page);
    console.log(`Total job links found: ${links.length}`);

    const jobDetails = [];

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      console.log(`Scraping job ${i + 1}/${links.length}: ${link}`);

      const details = await extractJobDetails(page, link);

      if (details) {
        jobDetails.push(details);
        console.log(`Scraped job ${i + 1}:`, details.title);
      }

      // Optional: Add a delay to avoid overwhelming the server
      await delay(1000);
    }

    // Save the scraped data to a JSON file
    fs.writeFileSync("jobDetails.json", JSON.stringify(jobDetails, null, 2));
    console.log("Job details saved to jobDetails.json");
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }
})();

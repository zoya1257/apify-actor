import { Actor } from "apify";
import { PuppeteerCrawler } from "crawlee";
import fs from "fs-extra";
import { Parser as Json2CsvParser } from "json2csv";
import XLSX from "xlsx";

const jobs = [];
const date = new Date().toISOString().split("T")[0];

async function smoothScroll(page) {
    await page.evaluate(() => {
        return new Promise(resolve => {
            let total = 0;
            let distance = 200;
            let timer = setInterval(() => {
                window.scrollBy(0, distance);
                total += distance;
                if (total >= document.body.scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

async function extractJobDetails(page) {
    await page.waitForSelector("ul.jobs-search__results-list", { timeout: 15000 });

    return await page.$$eval("ul.jobs-search__results-list li", items =>
        items.map(item => ({
            title: item.querySelector("h3")?.innerText.trim() || "",
            company: item.querySelector("h4")?.innerText.trim() || "",
            location: item.querySelector(".job-search-card__location")?.innerText.trim() || "",
            link: item.querySelector("a")?.href || ""
        }))
    );
}

async function scrapeJobPage(page, job) {
    try {
        await page.goto(job.link, { waitUntil: "networkidle2" });
        await page.waitForSelector(".show-more-less-html__markup", { timeout: 15000 });

        job.description = await page.$eval(".show-more-less-html__markup",
            el => el.innerText.trim()
        );

        return job;
    } catch {
        job.description = "N/A";
        return job;
    }
}

function saveJSON(jobs) {
    fs.writeFileSync(`jobs_${date}.json`, JSON.stringify(jobs, null, 2));
}

function saveCSV(jobs) {
    const fields = ["title", "company", "location", "link", "description"];
    const parser = new Json2CsvParser({ fields });
    fs.writeFileSync(`jobs_${date}.csv`, parser.parse(jobs));
}

function saveExcel(jobs) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(jobs);
    XLSX.utils.book_append_sheet(wb, ws, "Jobs");
    XLSX.writeFile(wb, `jobs_${date}.xlsx`);
}

const requestHandler = async ({ page, request }) => {
    console.log("Scraping:", request.url);

    await smoothScroll(page);

    const jobsOnPage = await extractJobDetails(page);

    for (let job of jobsOnPage) {
        job = await scrapeJobPage(page, job);
        jobs.push(job);
    }

    const nextBtn = await page.$('button[aria-label="Next"]');
    if (nextBtn) {
        await Promise.all([
            nextBtn.click(),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);
    }
};

Actor.main(async () => {
    const crawler = new PuppeteerCrawler({
        requestHandler,
        maxRequestsPerCrawl: 20,
        navigationTimeoutSecs: 60,

        // ⭐⭐ MOST IMPORTANT ⭐⭐
        launchContext: {
            useChrome: true,  // <-- Crawlee ko bol do Apify wala Chrome use kare
            launchOptions: {
                headless: true
            }
        },
    });

    await crawler.run(["https://www.linkedin.com/jobs/search/?keywords=DevOps"]);

    saveJSON(jobs);
    saveCSV(jobs);
    saveExcel(jobs);

    console.log(`DONE! Total jobs scraped = ${jobs.length}`);
});

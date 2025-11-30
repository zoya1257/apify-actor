import { Actor } from "apify";
import { PuppeteerCrawler } from "crawlee";
import { Parser as Json2CsvParser } from "json2csv";
import XLSX from "xlsx";

const jobs = [];
const date = new Date().toISOString().split("T")[0];

// ---------- Smooth Scroll ----------
async function smoothScroll(page) {
    await page.evaluate(() => {
        return new Promise(resolve => {
            let total = 0;
            let distance = 300;
            let timer = setInterval(() => {
                window.scrollBy(0, distance);
                total += distance;
                if (total >= document.body.scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 120);
        });
    });
}

// ---------- Extract Jobs ----------
async function extractJobDetails(page) {
    await page.waitForSelector("ul.jobs-search__results-list", { timeout: 30000 });

    return await page.$$eval("ul.jobs-search__results-list li", items =>
        items.map(item => ({
            title: item.querySelector("h3")?.innerText.trim() || "",
            company: item.querySelector("h4")?.innerText.trim() || "",
            location: item.querySelector(".job-search-card__location")?.innerText.trim() || "",
            link: item.querySelector("a")?.href || ""
        }))
    );
}

// ---------- Job Description ----------
async function scrapeJobPage(page, job) {
    try {
        await page.goto(job.link, { waitUntil: "networkidle2", timeout: 60000 });
        await page.waitForSelector(".show-more-less-html__markup", { timeout: 30000 });

        job.description = await page.$eval(".show-more-less-html__markup",
            el => el.innerText.trim()
        );

        return job;
    } catch {
        job.description = "N/A";
        return job;
    }
}

// ---------- SAVE JSON ----------
async function saveJSON(jobs) {
    await Actor.setValue(`jobs_${date}.json`, jobs);
}

// ---------- SAVE CSV ----------
async function saveCSV(jobs) {
    const fields = ["title", "company", "location", "link", "description"];
    const parser = new Json2CsvParser({ fields });
    const csv = parser.parse(jobs);

    await Actor.setValue(`jobs_${date}.csv`, csv, { contentType: "text/csv" });
}

// ---------- SAVE EXCEL ----------
async function saveExcel(jobs) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(jobs);
    XLSX.utils.book_append_sheet(wb, ws, "Jobs");

    const buffer = XLSX.write(wb, { type: "buffer" });

    await Actor.setValue(`jobs_${date}.xlsx`, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
}

// ---------- Request Handler ----------
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
            page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
        ]);
    }
};

// ---------- MAIN ----------
Actor.main(async () => {
    const crawler = new PuppeteerCrawler({
        requestHandler,

        // Prevent timeout errors
        requestHandlerTimeoutSecs: 300,
        navigationTimeoutSecs: 120,
        maxRequestRetries: 5,

        launchContext: {
            useChrome: true,
            launchOptions: {
                headless: true
            }
        },
    });

    await crawler.run(["https://www.linkedin.com/jobs/search/?keywords=DevOps"]);

    await saveJSON(jobs);
    await saveCSV(jobs);
    await saveExcel(jobs);

    console.log(`DONE! Total jobs scraped = ${jobs.length}`);
});

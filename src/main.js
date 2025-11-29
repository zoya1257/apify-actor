// ---------- FIX 0: Crawlee storage fix for Windows ----------
process.env.CRAWLEE_STORAGE_DIR = './storage-fixed';
process.env.CRAWLEE_DEFAULT_KV_STORE_ID = 'default';

import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

import { PuppeteerCrawler } from 'crawlee';
import fs from 'fs-extra';
import { Parser as Json2CsvParser } from 'json2csv';
import XLSX from 'xlsx';

// ---------- Global ----------
const jobs = [];
const date = new Date().toISOString().split('T')[0];

// ---------- Smooth Scroll ----------
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

// ---------- Extract Jobs ----------
async function extractJobDetails(page) {
    await page.waitForSelector('ul.jobs-search__results-list', { timeout: 15000 });

    return await page.$$eval('ul.jobs-search__results-list li', items =>
        items.map(item => ({
            title: item.querySelector('h3')?.innerText.trim() || '',
            company: item.querySelector('h4')?.innerText.trim() || '',
            location: item.querySelector('.job-search-card__location')?.innerText.trim() || '',
            link: item.querySelector('a')?.href || ''
        }))
    );
}

// ---------- Job Description ----------
async function scrapeJobPage(page, job) {
    try {
        await page.goto(job.link, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.show-more-less-html__markup', { timeout: 15000 });

        job.description = await page.$eval('.show-more-less-html__markup',
            el => el.innerText.trim()
        );

        return job;
    } catch {
        job.description = "N/A";
        return job;
    }
}

// ---------- Save Files ----------
function saveJSON(jobs) {
    fs.writeFileSync(`jobs_${date}.json`, JSON.stringify(jobs, null, 2));
    console.log("JSON saved.");
}

function saveCSV(jobs) {
    const fields = ['title', 'company', 'location', 'link', 'description'];
    const parser = new Json2CsvParser({ fields });
    fs.writeFileSync(`jobs_${date}.csv`, parser.parse(jobs));
    console.log("CSV saved.");
}

function saveExcel(jobs) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(jobs);
    XLSX.utils.book_append_sheet(wb, ws, 'Jobs');
    XLSX.writeFile(wb, `jobs_${date}.xlsx`);
    console.log("Excel saved.");
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

    // ---------- Failed Request Handler ----------
const failedRequestHandler = async ({ request, page }) => {
    console.log(`Request failed: ${request.url}`);
    if (page) {
        await screenshotOnError(page, 'failed_request');
    }
};
    // Pagination Click
    const nextBtn = await page.$('button[aria-label="Next"]');
    if (nextBtn) {
        await Promise.all([
            nextBtn.click(),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);
    }
};

// ---------- Run ----------
async function runScraper() {
    const crawler = new PuppeteerCrawler({
        requestHandler,
        failedRequestHandler,
        maxRequestsPerCrawl: 20,
        requestHandlerTimeoutSecs: 1800,
        navigationTimeoutSecs: 60,
        launchContext: {
            launcher: puppeteer,
            launchOptions: { headless: true }
        },
        storageDir: path.resolve('/tmp/crawlee_storage')
    });

    await crawler.run(['https://www.linkedin.com/jobs/search/?keywords=DevOps']);

    saveJSON(jobs);
    saveCSV(jobs);
    saveExcel(jobs);

    console.log(`DONE! Total jobs scraped = ${jobs.length}`);
}

runScraper();

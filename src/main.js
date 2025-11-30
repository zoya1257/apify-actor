import { Actor } from "apify";
import fetch from "node-fetch";
import { Parser as Json2CsvParser } from "json2csv";
import XLSX from "xlsx";

// ---------- GLOBAL ----------
const jobs = [];
const date = new Date().toISOString().split("T")[0];

// ---------- API CALL ----------
async function fetchJobs(keyword, start = 0) {
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}&start=${start}`;

    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0",
        }
    });

    if (!response.ok) return null;

    return await response.text();
}

// ---------- EXTRACT JOBS FROM API HTML ----------
function parseJobs(html) {
    const regex = /<li class="result-card.*?<\/li>/gs;
    const items = html.match(regex) || [];

    return items.map(item => {
        const get = (regex) => {
            const match = item.match(regex);
            return match ? match[1].trim() : "";
        };

        return {
            title: get(/<h3.*?>(.*?)<\/h3>/s),
            company: get(/<h4.*?>(.*?)<\/h4>/s),
            location: get(/job-search-card__location.*?>(.*?)<\/span>/s),
            link: get(/href="(.*?)"/s),
            description: ""
        };
    });
}

// ---------- SAVE JSON ----------
async function saveJSON(jobs) {
    await Actor.setValue(`jobs_${date}.json`, jobs);
}

// ---------- SAVE CSV ----------
async function saveCSV(jobs) {
    const parser = new Json2CsvParser();
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

// ---------- MAIN ----------
Actor.main(async () => {
    const keyword = "DevOps"; // Change keyword if needed

    console.log("⏳ Fetching jobs…");

    // LinkedIn API supports pagination by start=0,25,50...
    for (let start = 0; start <= 200; start += 25) {
        const html = await fetchJobs(keyword, start);

        if (!html || html.length < 50) break;

        const pageJobs = parseJobs(html);
        console.log(`Fetched: ${pageJobs.length} jobs`);

        jobs.push(...pageJobs);
    }

    console.log(`🔥 Total jobs scraped: ${jobs.length}`);

    await saveJSON(jobs);
    await saveCSV(jobs);
    await saveExcel(jobs);

    console.log("✔ All files saved in Apify storage.");
});

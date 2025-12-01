import { Actor } from "apify";
import { Parser as Json2CsvParser } from "json2csv";
import XLSX from "xlsx";

const date = new Date().toISOString().split("T")[0];
const jobs = [];

// ---------- FETCH JOBS ----------
async function fetchJobs(keyword, location, offset) {
    const run = await Actor.start("curious_coder/linkedin-jobs-scraper", {
        keyword,
        location,
        offset,
        limit: 25,
    });

    const runData = await Actor.getRun(run.id, { waitForFinish: true });

    return runData?.output?.items || [];
}

// ---------- SAVE JSON ----------
async function saveJSON() {
    await Actor.setValue(`jobs_${date}.json`, jobs);
}

// ---------- SAVE CSV ----------
async function saveCSV() {
    if (!jobs.length) return;

    const parser = new Json2CsvParser();
    const csv = parser.parse(jobs);

    await Actor.setValue(`jobs_${date}.csv`, csv, {
        contentType: "text/csv"
    });
}

// ---------- SAVE EXCEL ----------
async function saveExcel() {
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
    console.log("⏳ Fetching jobs from LinkedIn API…");

    const keyword = "DevOps";
    const location = "Worldwide";

    for (let offset = 0; offset <= 100; offset += 25) {
        const batch = await fetchJobs(keyword, location, offset);
        console.log(`Fetched batch: ${batch.length}`);

        if (!batch.length) break;

        jobs.push(...batch);
    }

    console.log(`🔥 Total jobs scraped: ${jobs.length}`);

    await saveJSON();
    await saveCSV();
    await saveExcel();

    console.log("✔ DONE — all files saved");
});

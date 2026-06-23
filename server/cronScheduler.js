const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { runUpdate } = require("./updatePlayers");

const STATUS_FILE_PATH = path.join(__dirname, "last-update.json");
const MILLISECONDS_IN_A_WEEK = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Helper to check if the current date falls within the active IPL season months
 * (March, April, May, and the 1st week of June: June 1st - 7th).
 */
function isIplSeasonActive() {
    const currentDate = new Date();
    const month = currentDate.getMonth() + 1; // 1-indexed: Jan=1, Feb=2, Mar=3, etc.
    const day = currentDate.getDate();

    // March (3), April (4), May (5) are always active.
    // June (6) is active only for the first week (June 1st to 7th).
    return (month === 3 || month === 4 || month === 5) || (month === 6 && day <= 7);
}

/**
 * Checks if 7 or more days have elapsed since the last successful stats update
 */
function isUpdateDue() {
    if (!isIplSeasonActive()) {
        return false;
    }

    if (!fs.existsSync(STATUS_FILE_PATH)) {
        return true; // No record exists, so an update is due
    }
    try {
        const data = JSON.parse(fs.readFileSync(STATUS_FILE_PATH, "utf8"));
        if (!data.lastUpdated) return true;

        const lastUpdatedDate = new Date(data.lastUpdated);
        const currentDate = new Date();
        const difference = currentDate.getTime() - lastUpdatedDate.getTime();

        return difference >= MILLISECONDS_IN_A_WEEK;
    } catch (e) {
        console.error("[Cron Scheduler] Error reading last-update.json. Assuming update is due:", e.message);
        return true;
    }
}

/**
 * Triggers the update if due
 */
function checkAndTriggerUpdate() {
    if (!isIplSeasonActive()) {
        console.log("[Cron Scheduler] Automatic updates: Skipped (Not within IPL season: March-May & June 1st week).");
        return;
    }

    if (isUpdateDue()) {
        console.log("[Cron Scheduler] Automatic updates: 7+ days have passed since last update. Running stats update...");
        
        // Execute asynchronously to not block Express startup
        runUpdate()
            .then(success => {
                if (success) {
                    console.log("[Cron Scheduler] Weekly stats update successfully finished.");
                } else {
                    console.log("[Cron Scheduler] Weekly stats update completed with some failures or warnings.");
                }
            })
            .catch(err => {
                console.error("[Cron Scheduler] Unhandled error during stats update:", err);
            });
    } else {
        console.log("[Cron Scheduler] Automatic updates: Stats are up to date (updated less than 7 days ago). Skipping update.");
    }
}

/**
 * Initializes the weekly cron job and starts the startup check
 */
function initCron() {
    console.log("[Cron Scheduler] Initializing player stats scheduler...");

    // 1. Run check immediately when the server boots
    checkAndTriggerUpdate();

    // 2. Schedule the cron job to run once every week (Every Sunday at 00:00)
    // only in active months: March, April, May, and June.
    // Cron expression: 0 0 * 3,4,5,6 0 (Minute Hour DayOfMonth Month DayOfWeek)
    cron.schedule("0 0 * 3,4,5,6 0", () => {
        console.log("[Cron Scheduler] Scheduled cron triggered. Checking for updates...");
        checkAndTriggerUpdate();
    });
}

module.exports = { initCron };

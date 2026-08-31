#!/usr/bin/env node
const {execSync, spawnSync} = require("node:child_process");

function run(command) {
    try {
        return execSync(command, {stdio: ["ignore", "pipe", "pipe"], encoding: "utf8"}).trim();
    } catch {
        return "";
    }
}

const pids = run('pgrep -f "next dev"').split(/\s+/).filter(Boolean);
if (pids.length) {
    console.log(`Stopping ${pids.length} existing next dev process(es)...`);
    for (const pid of pids) {
        try {
            process.kill(Number(pid), "SIGTERM");
        } catch {
            // already exited
        }
    }
}

spawnSync("npm", ["run", "dev"], {stdio: "inherit", shell: process.platform === "win32"});

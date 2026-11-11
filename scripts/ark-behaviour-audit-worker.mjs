// Worker entry for scripts/ark-behaviour-audit.mts: registers tsx in this thread, then loads the audit script
// (which sees it is not the main thread and simulates its slice of the Ark).
import {register} from "tsx/esm/api";
import {workerData} from "node:worker_threads";

register({tsconfig: workerData.tsconfig});
await import(workerData.entry);

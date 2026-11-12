// Worker entry for scripts/ark-collide-audit.mts: registers tsx in this thread, then loads the audit script (which sees
// it is not the main thread and measures its window of the shared clock).
import {register} from "tsx/esm/api";
import {workerData} from "node:worker_threads";

register({tsconfig: workerData.tsconfig});
await import(workerData.entry);

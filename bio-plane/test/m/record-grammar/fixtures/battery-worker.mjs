/* record-grammar's purity battery in a Worker (R24): the battery's string, posted to the thread that started it. */
import { parentPort } from "node:worker_threads";
import { battery } from "./battery.mjs";

parentPort?.postMessage(await battery());

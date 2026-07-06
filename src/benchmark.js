import { evaluateBot } from "./game.js";

const seed = Number.parseInt(process.argv[2] ?? "20260706", 10);
const games = Number.parseInt(process.argv[3] ?? "24", 10);
const report = evaluateBot({ seed, games });

console.log(JSON.stringify(report, null, 2));

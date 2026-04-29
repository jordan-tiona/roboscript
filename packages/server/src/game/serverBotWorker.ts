// Runs inside a worker_thread. Mirrors client/src/worker/botWorker.ts closely
// so server and browser sandbox behaviour is equivalent.
// vm.createContext restricts user code to an explicit allowlist of globals —
// no require, no process, no Node.js internals.
import { parentPort } from "worker_threads";
import vm from "vm";
import { RobotRuntime } from "../runtime/RobotRuntime.js";
import type { BotCommand, GameEvent } from "@roboscript/engine";
import type { BotStateView, EnemyView } from "../runtime/RobotRuntime.js";

if (!parentPort) throw new Error("Must be run as a worker thread");

// ── Message types (mirrors client worker protocol) ────────────────────────────

type MainToWorker =
  | { type: "init"; botId: string; botName: string; botCount: number; code: string;
      initialState: BotStateView; arenaWidth: number; arenaHeight: number;
      obstacles: Array<Array<{ x: number; y: number }>> }
  | { type: "tick"; tickId: number; state: BotStateView; enemies: EnemyView[];
      events: readonly GameEvent[]; zoneRadius: number }
  | { type: "terminate" };

type WorkerToMain =
  | { type: "ready"; botId: string }
  | { type: "command"; tickId: number; botId: string; command: BotCommand }
  | { type: "log"; botId: string; message: string; tick: number }
  | { type: "error"; botId: string; message: string };

// ── State ─────────────────────────────────────────────────────────────────────

let runtime: RobotRuntime | null = null;
let currentTick = 0;
let userCodeLines: string[] = [];

const game = { tick: 0, arenaWidth: 0, arenaHeight: 0, zoneRadius: 0 };

function normalRelativeAngle(angle: number): number {
  return ((angle % 360) + 540) % 360 - 180;
}

function normalAbsoluteAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function normalRelativeAngleRadians(angle: number): number {
  return ((angle % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
}

function errorContext(err: unknown): string {
  const base = String(err);
  if (!(err instanceof Error) || !err.stack) return base;
  // vm with filename:"bot" — syntax errors: stack starts "bot:N\n", runtime: "at bot:N:M"
  const match = err.stack.match(/(?:^|\bat )bot:(\d+)(?::(\d+))?/m)
    ?? err.stack.match(/evalmachine\.<anonymous>:(\d+)(?::(\d+))?/)
    ?? err.stack.match(/<anonymous>:(\d+)(?::(\d+))?/);
  if (!match) return base;
  const userLine = parseInt(match[1]!) - 1; // subtract 1 for "use strict";\n prefix
  if (userLine < 1 || userLine > userCodeLines.length) return base;
  const snippet = userCodeLines[userLine - 1]?.trim() ?? "";
  return `${base} (line ${userLine}${match[2] ? `:${match[2]}` : ""})\n  ${snippet}`;
}

// ── Message handler ───────────────────────────────────────────────────────────

parentPort.on("message", (msg: MainToWorker) => {
  if (msg.type === "init") {
    const botId = msg.botId;
    userCodeLines = msg.code.split("\n");

    const post = (m: WorkerToMain) => parentPort!.postMessage(m);

    const formatArgs = (...args: unknown[]) =>
      args.map((a) => a !== null && typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");

    game.arenaWidth = msg.arenaWidth;
    game.arenaHeight = msg.arenaHeight;

    // Build a restricted sandbox — only safe globals and our injected API.
    // Notably absent: require, process, global, __dirname, __filename, fetch, fs, etc.
    const sandbox = vm.createContext({
      Robot: RobotRuntime,
      RobotRuntime,
      game,
      normalRelativeAngle,
      normalAbsoluteAngle,
      normalRelativeAngleRadians,
      console: {
        log: (...args: unknown[]) => {
          post({ type: "log", botId, message: formatArgs(...args), tick: currentTick });
        },
        error: (...args: unknown[]) => {
          const stack = new Error().stack ?? "";
          const match = stack.match(/(?:^|\bat )bot:(\d+)(?::(\d+))?/m)
            ?? stack.match(/evalmachine\.<anonymous>:(\d+)(?::(\d+))?/);
          let suffix = "";
          if (match) {
            const userLine = parseInt(match[1]!) - 1;
            if (userLine >= 1 && userLine <= userCodeLines.length) {
              const snippet = userCodeLines[userLine - 1]?.trim() ?? "";
              suffix = ` (line ${userLine}${match[2] ? `:${match[2]}` : ""})\n  ${snippet}`;
            }
          }
          post({ type: "error", botId, message: formatArgs(...args) + suffix });
        },
      },
    });

    try {
      const classMatch = msg.code.match(/class\s+(\w+)\s+extends\s+(?:Robot|RobotRuntime)\b/);
      const className = classMatch?.[1] ?? "MyRobot";

      vm.runInContext(
        `"use strict";\n${msg.code}\n` +
        `if (typeof ${className} === 'undefined') { throw new Error('Your bot must define a class that extends Robot'); }\n` +
        `globalThis.__bot = new ${className}();`,
        sandbox,
        { filename: "bot" },
      );

      runtime = (sandbox as { __bot: RobotRuntime }).__bot;

      runtime._init(
        botId,
        msg.botCount,
        (cmd: BotCommand) => {
          post({ type: "command", tickId: runtime!._currentTickId, botId, command: cmd });
        },
        msg.initialState,
        msg.arenaWidth,
        msg.arenaHeight,
        msg.obstacles,
      );

      post({ type: "ready", botId });

      runtime.run().catch((err: unknown) => {
        console.error(err);
        post({ type: "error", botId, message: errorContext(err) });
      });
    } catch (e) {
      console.error(e);
      post({ type: "error", botId, message: errorContext(e) });
    }
  }

  if (msg.type === "tick" && runtime) {
    currentTick = msg.tickId;
    game.tick = msg.tickId;
    game.zoneRadius = msg.zoneRadius;
    runtime._receiveTick(msg.tickId, msg.state, msg.enemies, msg.events, msg.zoneRadius);
  }

  if (msg.type === "terminate") {
    (async () => {
      try { if (runtime) await runtime.onBattleEnd(); } catch (e) { console.error(e); }
      process.exit(0);
    })();
  }
});

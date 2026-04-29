// This file runs inside a Web Worker. It is excluded from the main tsconfig
// to avoid DOM/WebWorker lib conflicts. Vite bundles it separately.
import type { MainToWorker, WorkerToMain } from "./protocol.js";
import { RobotRuntime } from "./RobotRuntime.js";
import { parse } from "acorn";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerSelf = self as any;

let runtime: RobotRuntime | null = null;
let currentTick = 0;
let userCodeLines: string[] = [];

const game = { tick: 0, arenaWidth: 0, arenaHeight: 0, zoneRadius: 0 };

// Saved before the init handler overrides console.error, so we can still
// forward raw errors to the browser devtools where they show with full context.
const nativeConsoleError = console.error.bind(console);

function normalRelativeAngle(angle: number): number {
  return ((angle % 360) + 540) % 360 - 180;
}

function normalAbsoluteAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function normalRelativeAngleRadians(angle: number): number {
  return ((angle % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
}

// new Function body starts with "use strict";\n so user line N is at function line N+1.
// Subtract 1 from the stack's line number to get the user's line number.
// NOTE: Chrome V8 does not include position info for *syntax* errors from new Function —
// those will show in browser devtools via nativeConsoleError but not in the in-game console.
function errorContext(err: unknown): string {
  const base = String(err);
  if (!(err instanceof Error) || !err.stack) return base;

  // Firefox exposes lineNumber/columnNumber directly on SyntaxError and other Error objects.
  const ffLine = (err as { lineNumber?: number }).lineNumber;
  if (ffLine != null) {
    const userLine = ffLine - 1; // subtract 1 for "use strict";\n prefix
    if (userLine >= 1 && userLine <= userCodeLines.length) {
      const snippet = userCodeLines[userLine - 1]?.trim() ?? "";
      const col = (err as { columnNumber?: number }).columnNumber;
      return `${base} (line ${userLine}${col != null ? `:${col}` : ""})\n  ${snippet}`;
    }
  }

  // V8/Chrome: body starts at line 1 ("use strict"; = line 1), offset = 1.
  // Firefox: prepends "function anonymous(...params\n) {\n\n" so "use strict"; = line 4, offset = 4.
  const chromeMatch = err.stack.match(/<anonymous>:(\d+)(?::(\d+))?/);
  const firefoxMatch = chromeMatch ? null : err.stack.match(/\bFunction:(\d+)(?::(\d+))?/);
  const match = chromeMatch ?? firefoxMatch;
  if (!match) return base;
  const offset = firefoxMatch ? 4 : 1;
  const userLine = parseInt(match[1]) - offset;
  if (userLine < 1 || userLine > userCodeLines.length) return base;
  const snippet = userCodeLines[userLine - 1]?.trim() ?? "";
  return `${base} (line ${userLine}${match[2] ? `:${match[2]}` : ""})\n  ${snippet}`;
}

workerSelf.onmessage = (evt: MessageEvent<MainToWorker>) => {
  const msg = evt.data;

  if (msg.type === "init") {
    const botId = msg.botId;
    userCodeLines = msg.code.split("\n");

    // Redirect console.log/error from bot code to the main thread
    const formatArgs = (...args: unknown[]) =>
      args.map((a) => a !== null && typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    console.log = (...args: unknown[]) => {
      workerSelf.postMessage({ type: "log", botId, message: formatArgs(...args), tick: currentTick } satisfies WorkerToMain);
    };
    console.error = (...args: unknown[]) => {
      // Capture a stack trace to find which user line called console.error
      const stack = new Error().stack ?? "";
      const match = stack.match(/<anonymous>:(\d+)(?::(\d+))?/);
      let suffix = "";
      if (match) {
        const userLine = parseInt(match[1]) - 1;
        if (userLine >= 1 && userLine <= userCodeLines.length) {
          const snippet = userCodeLines[userLine - 1]?.trim() ?? "";
          suffix = ` (line ${userLine})\n  ${snippet}`;
        }
      }
      workerSelf.postMessage({ type: "error", botId, message: formatArgs(...args) + suffix } satisfies WorkerToMain);
    };

    try {
      // Extract the class name from source — supports any name, not just MyRobot.
      const classMatch = msg.code.match(/class\s+(\w+)\s+extends\s+(?:Robot|RobotRuntime)\b/);
      const className = classMatch?.[1] ?? "MyRobot";

      game.arenaWidth = msg.arenaWidth;
      game.arenaHeight = msg.arenaHeight;

      // Pre-flight syntax check — acorn gives exact line/column before we ever
      // call new Function, where V8 drops that info from the SyntaxError.
      try {
        parse(msg.code, { ecmaVersion: "latest", sourceType: "script", locations: true });
      } catch (syntaxErr: unknown) {
        nativeConsoleError(syntaxErr);
        const loc = (syntaxErr as { loc?: { line?: number; column?: number } }).loc;
        const line = loc?.line;
        const col = loc?.column;
        const locStr = line != null ? ` (line ${line}${col != null ? `:${col + 1}` : ""})` : "";
        const snippet = line != null ? `\n  ${userCodeLines[line - 1]?.trim() ?? ""}` : "";
        workerSelf.postMessage({ type: "error", botId, message: String(syntaxErr) + locStr + snippet } satisfies WorkerToMain);
        return;
      }

      // Sandboxed eval: Robot, RobotRuntime, game, and utility functions are
      // injected so user code and helper classes can access game state.
      const factory = new Function(
        "Robot",
        "RobotRuntime",
        "game",
        "normalRelativeAngle",
        "normalAbsoluteAngle",
        "normalRelativeAngleRadians",
        `"use strict";
${msg.code}
if (typeof ${className} === 'undefined') {
  throw new Error('Your bot must define a class that extends Robot');
}
return new ${className}();`,
      );

      runtime = factory(RobotRuntime, RobotRuntime, game, normalRelativeAngle, normalAbsoluteAngle, normalRelativeAngleRadians) as RobotRuntime;

      runtime._init(botId, msg.botCount, (cmd) => {
        const reply: WorkerToMain = {
          type: "command",
          tickId: runtime!._currentTickId,
          botId,
          command: cmd,
        };
        workerSelf.postMessage(reply);
      }, msg.initialState, msg.arenaWidth, msg.arenaHeight, msg.obstacles);

      const ready: WorkerToMain = { type: "ready", botId };
      workerSelf.postMessage(ready);

      // Start the bot coroutine — immediately suspends on the first _nextTick call
      // and waits until the first tick message arrives from the main thread.
      runtime.run().catch((err: unknown) => {
        nativeConsoleError(err);
        workerSelf.postMessage({ type: "error", botId, message: errorContext(err) } satisfies WorkerToMain);
      });
    } catch (e) {
      nativeConsoleError(e);
      workerSelf.postMessage({ type: "error", botId, message: errorContext(e) } satisfies WorkerToMain);
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
      try { if (runtime) await runtime.onBattleEnd(); } catch (e) { nativeConsoleError(e); }
      workerSelf.close();
    })();
  }
};

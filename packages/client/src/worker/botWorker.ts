// This file runs inside a Web Worker. It is excluded from the main tsconfig
// to avoid DOM/WebWorker lib conflicts. Vite bundles it separately.
import type { MainToWorker, WorkerToMain } from "./protocol.js";
import { RobotRuntime } from "./RobotRuntime.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerSelf = self as any;

let runtime: RobotRuntime | null = null;
let currentTick = 0;
let userCodeLines: string[] = [];

// new Function body starts with "use strict";\n so user line N is at function line N+1.
// Subtract 1 from the stack's line number to get the user's line number.
function errorContext(err: unknown): string {
  const base = String(err);
  if (!(err instanceof Error) || !err.stack) return base;
  const match = err.stack.match(/<anonymous>:(\d+)(?::(\d+))?/);
  if (!match) return base;
  const userLine = parseInt(match[1]) - 1;
  if (userLine < 1 || userLine > userCodeLines.length) return base;
  const snippet = userCodeLines[userLine - 1]?.trim() ?? "";
  return `${base} (line ${userLine})\n  ${snippet}`;
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

      // Sandboxed eval: both Robot and RobotRuntime are injected so user code
      // can extend either name. Neither reaches the real module scope.
      const factory = new Function(
        "Robot",
        "RobotRuntime",
        `"use strict";
${msg.code}
if (typeof ${className} === 'undefined') {
  throw new Error('Your bot must define a class that extends Robot');
}
return new ${className}();`,
      );

      runtime = factory(RobotRuntime, RobotRuntime) as RobotRuntime;

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
        workerSelf.postMessage({ type: "error", botId, message: errorContext(err) } satisfies WorkerToMain);
      });
    } catch (e) {
      workerSelf.postMessage({ type: "error", botId, message: errorContext(e) } satisfies WorkerToMain);
    }
  }

  if (msg.type === "tick" && runtime) {
    currentTick = msg.tickId;
    runtime._receiveTick(msg.tickId, msg.state, msg.enemies, msg.events, msg.zoneRadius);
  }

  if (msg.type === "terminate") {
    workerSelf.close();
  }
};

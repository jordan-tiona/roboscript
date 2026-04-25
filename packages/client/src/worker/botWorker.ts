// This file runs inside a Web Worker. It is excluded from the main tsconfig
// to avoid DOM/WebWorker lib conflicts. Vite bundles it separately.
import type { MainToWorker, WorkerToMain } from "./protocol.js";
import { RobotRuntime } from "./RobotRuntime.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerSelf = self as any;

let runtime: RobotRuntime | null = null;
let currentTick = 0;

workerSelf.onmessage = (evt: MessageEvent<MainToWorker>) => {
  const msg = evt.data;

  if (msg.type === "init") {
    const botId = msg.botId;

    // Redirect console.log from bot code to the main thread
    console.log = (...args: unknown[]) => {
      const message = args.map((a) =>
        a !== null && typeof a === "object" ? JSON.stringify(a) : String(a)
      ).join(" ");
      workerSelf.postMessage({ type: "log", botId, message, tick: currentTick } satisfies WorkerToMain);
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
        const errMsg: WorkerToMain = {
          type: "error",
          botId,
          message: String(err),
        };
        workerSelf.postMessage(errMsg);
      });
    } catch (e) {
      const errMsg: WorkerToMain = {
        type: "error",
        botId,
        message: String(e),
      };
      workerSelf.postMessage(errMsg);
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

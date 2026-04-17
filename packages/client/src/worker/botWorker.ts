// This file runs inside a Web Worker. It is excluded from the main tsconfig
// to avoid DOM/WebWorker lib conflicts. Vite bundles it separately.
import type { MainToWorker, WorkerToMain } from "./protocol.js";
import { RobotRuntime } from "./RobotRuntime.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerSelf = self as any;

let runtime: RobotRuntime | null = null;

workerSelf.onmessage = (evt: MessageEvent<MainToWorker>) => {
  const msg = evt.data;

  if (msg.type === "init") {
    const botId = msg.botId;
    try {
      // Sandboxed eval: Robot is injected as a parameter so user code cannot
      // reach the real module. The user's class must be named MyRobot.
      const factory = new Function(
        "Robot",
        `"use strict";
${msg.code}
if (typeof MyRobot === 'undefined') {
  throw new Error('Your code must define a class named MyRobot that extends Robot');
}
return new MyRobot();`,
      );

      runtime = factory(RobotRuntime) as RobotRuntime;

      runtime._init(botId, msg.botCount, (cmd) => {
        const reply: WorkerToMain = {
          type: "command",
          tickId: runtime!._currentTickId,
          botId,
          command: cmd,
        };
        workerSelf.postMessage(reply);
      }, msg.initialState);

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
    runtime._receiveTick(msg.tickId, msg.state, msg.enemies, msg.events);
  }

  if (msg.type === "terminate") {
    workerSelf.close();
  }
};

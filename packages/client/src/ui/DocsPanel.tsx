interface Props {
  open: boolean;
  onClose: () => void;
}

export function DocsPanel({ open, onClose }: Props) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      zIndex: 10,
      background: "var(--color-bg-panel)",
      borderLeft: "1px solid var(--color-border)",
      display: "flex", flexDirection: "column",
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.22s ease",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-text)" }}>API Reference</span>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: "16px", padding: "2px 6px", lineHeight: 1 }}>✕</button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "24px" }}>

        <Section title="The coroutine model">
          <P>Every <C>await</C> in <C>run()</C> suspends your bot for one game tick (1/30s). The engine collects your command, advances the simulation, then resumes your code with the updated state. This means motion happens gradually — <C>await this.move(200)</C> takes many ticks to complete.</P>
          <Code>{`class MyBot extends RobotRuntime {
  async run() {
    while (true) {
      await this.move(100);
      await this.turn(90);
    }
  }
}`}</Code>
        </Section>

        <Section title="State — read every tick">
          <Table rows={[
            ["x, y",           "number",  "Position in the arena (pixels). Origin is top-left."],
            ["heading",        "number",  "Body direction in degrees. 0 = north, clockwise positive."],
            ["gunHeading",     "number",  "Gun turret direction in degrees, independent of body."],
            ["energy",         "number",  "HP. Reaches 0 → bot is eliminated."],
            ["shield",         "number",  "Absorbs bullet damage first (max 20). Regenerates after ~5s without being hit."],
            ["velocity",       "number",  "Current speed in units/tick. Negative = reversing."],
            ["gunHeat",        "number",  "Cooldown before next shot. Fires when 0; cools at 0.1/tick."],
            ["arenaWidth",     "number",  "Arena width in pixels (1200)."],
            ["arenaHeight",    "number",  "Arena height in pixels (900)."],
            ["obstacles",      "array",   "Array of convex polygons (each a Vec2[] array). Bullets and LOS are blocked by these."],
            ["alive",          "number",  "Count of bots still alive, including self."],
            ["botCount",       "number",  "Total bots that started the match."],
          ]} />
        </Section>

        <Section title="Enemies">
          <P>
            <C>this.enemies</C> is updated every tick and always contains one entry per non-self bot.
            When <C>visible</C> is false, position and energy reflect the last known state — check <C>lastSeen</C> before acting on stale data.
          </P>
          <Table rows={[
            ["id",           "string",           "Unique bot identifier."],
            ["name",         "string",           "Display name."],
            ["alive",        "boolean",          "False once eliminated."],
            ["visible",      "boolean",          "True if line of sight is unobstructed this tick."],
            ["lastSeen",     "number | null",    "Ticks since last visible. null = never seen."],
            ["x, y",         "number",           "Last known position."],
            ["heading",      "number",           "Last known body heading."],
            ["energy",       "number",           "Last known energy."],
            ["velocity",     "number",           "Last known speed."],
            ["firedThisTick","boolean",          "True only when visible and fired this tick."],
          ]} />
        </Section>

        <Section title="Movement">
          <Table rows={[
            ["move(distance)",         "Promise<void>", "Move forward distance units (negative = backward). Waits until fully stopped."],
            ["back(distance)",         "Promise<void>", "Shorthand for move(-distance)."],
            ["turn(degrees)",          "Promise<void>", "Rotate body by degrees. Positive = clockwise. Max 10°/tick."],
            ["turnToward(target)",     "Promise<void>", "Rotate to face an {x,y} target. Takes the shortest path."],
            ["turnGun(degrees)",       "Promise<void>", "Rotate gun turret by degrees, independent of body. Max 20°/tick."],
            ["aimToward(target)",      "Promise<void>", "Rotate gun to aim at an {x,y} target."],
            ["fire(power?)",           "Promise<void>", "Fire at given power (0.1–3.0, default 1.0). Does nothing if gun is hot."],
          ]} />
        </Section>

        <Section title="step() — simultaneous actions">
          <P><C>step()</C> advances exactly one tick with any combination of actions. Use it when you need to move, turn, and fire at the same time instead of sequentially.</P>
          <Code>{`await this.step({
  velocity: 8,       // desired speed (units/tick)
  turn:     5,       // body rotation this tick (degrees)
  gunTurn: -10,      // gun rotation this tick (degrees)
  fire:    true,     // attempt to fire
  firePower: 2.0,    // bullet power (0.1–3.0)
});`}</Code>
        </Section>

        <Section title="set* / execute() — accumulated motion">
          <P>An alternative style where you set total distances/angles and call <C>execute()</C> each tick. Remaining amounts carry over automatically.</P>
          <Code>{`this.setAhead(200);   // travel 200 units forward
this.setTurn(90);     // rotate 90° clockwise
this.setFire(1.5);    // queue a shot this tick
while (this.remainingAhead > 0 || this.remainingTurn > 0) {
  await this.execute();
}`}</Code>
          <Table rows={[
            ["setAhead(d) / setBack(d)",      "void", "Queue forward/backward travel."],
            ["setTurn(deg)",                  "void", "Queue body rotation (positive = clockwise)."],
            ["setTurnLeft/Right(deg)",        "void", "Convenience wrappers for counter/clockwise."],
            ["setTurnGun(deg)",               "void", "Queue gun rotation."],
            ["setTurnGunLeft/Right(deg)",     "void", "Convenience wrappers."],
            ["setFire(power?)",               "void", "Queue a shot this tick."],
            ["execute()",                     "Promise<void>", "Consume one tick's worth of all pending set* values."],
            ["remainingAhead",               "number", "Distance left from last setAhead/setBack."],
            ["remainingTurn",                "number", "Degrees left from last setTurn."],
            ["remainingGunTurn",             "number", "Degrees left from last setTurnGun."],
          ]} />
        </Section>

        <Section title="Utility">
          <Table rows={[
            ["distanceTo(target)",     "number",  "Euclidean distance to any {x,y} object."],
            ["angleTo(target)",        "number",  "Absolute heading toward target in degrees (0=north, CW positive)."],
            ["bearingTo(target)",      "number",  "Relative angle from body heading to target. Negative = left. Range (-180, 180]."],
            ["gunBearingTo(target)",   "number",  "Same as bearingTo but relative to gun heading. Use for aiming."],
            ["bulletSpeed(power?)",    "number",  "Returns bullet travel speed for a given power. Formula: 26 − 3×power."],
            ["isOccupied(x, y)",       "boolean", "True if the point is outside the arena or inside an obstacle."],
          ]} />
        </Section>

        <Section title="Event state — Style A">
          <P>These are set at the start of each tick and cleared automatically. Check them anywhere in your loop.</P>
          <Code>{`while (true) {
  if (this.hitWall) await this.turn(180);
  if (this.hitByBullet) await this.move(-50); // dodge back
  await this.execute();
}`}</Code>
          <Table rows={[
            ["hitWall",       "HitWallEvent | null",       "Set if this bot hit a wall this tick."],
            ["hitByBullet",   "HitByBulletEvent | null",   "Set if this bot was hit by a bullet this tick."],
            ["bulletHit",     "BulletHitEvent | null",     "Set if one of this bot's bullets hit an enemy this tick."],
            ["botCollision",  "BotCollisionEvent | null",  "Set if this bot collided with another bot this tick."],
          ]} />
        </Section>

        <Section title="Event callbacks — Style B">
          <P>Override these methods for event-driven logic. They can be async — <C>run()</C> waits while a callback is executing.</P>
          <Code>{`async onHitByBullet(e) {
  // e.damage, e.ownerId, e.bulletId
  await this.turn(90 + Math.random() * 90);
  await this.move(100);
}
async onHitWall(e) { await this.turn(135); }
async onBulletHit(e) { /* your bullet hit e.victimId */ }
async onBotCollision(e) { await this.back(50); }
onDeath() { /* clean-up or logging */ }`}</Code>
        </Section>

        <Section title="Heading system">
          <P>All angles use the same convention: <strong>0° = north (up), clockwise positive</strong>. This applies to <C>heading</C>, <C>gunHeading</C>, <C>angleTo()</C>, <C>turn()</C>, and <C>turnGun()</C>.</P>
          <Code>{`// Face the enemy, then aim the gun
const enemy = this.enemies.find(e => e.visible && e.alive);
if (enemy) {
  await this.turnToward(enemy);   // body faces enemy
  await this.aimToward(enemy);    // gun aims at enemy
  await this.fire(2);
}`}</Code>
        </Section>

        <Section title="Constants">
          <Table rows={[
            ["Max speed",           "8 units/tick",   "Set velocity to 8 for full speed."],
            ["Acceleration",        "1 unit/tick²",   "Speed changes by at most 1 per tick."],
            ["Deceleration",        "2 units/tick²",  "Braking is faster than accelerating."],
            ["Max body turn",       "10°/tick",       "Maximum rotation per tick."],
            ["Max gun turn",        "20°/tick",       "Gun rotates up to twice as fast as the body."],
            ["Gun cooling rate",    "0.1/tick",       "~10 ticks between shots at default power."],
            ["Bullet speed",        "26 − 3×power",   "Power 1.0 → 23 u/tick. Power 3.0 → 17 u/tick."],
            ["Bullet damage",       "6×power",        "Power 1.0 → 6 HP. Power 3.0 → 18 HP."],
            ["Shield max",          "20 HP",          "Absorbs bullets first; bypassed by ram damage."],
            ["Shield regen delay",  "~5s (150 ticks)","Regen starts only after 5s without being hit."],
            ["Ticks per second",    "30",             "One tick = ~33ms."],
          ]} />
        </Section>

      </div>
    </div>
  );
}

// ── Local helper components ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <h3 style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)", paddingBottom: "6px" }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, fontFamily: "var(--font-ui)", fontSize: "13px", color: "var(--color-text)", lineHeight: 1.6 }}>{children}</p>;
}

function C({ children }: { children: React.ReactNode }) {
  return <code style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#9090e0", background: "rgba(90,90,174,0.15)", padding: "1px 4px", borderRadius: "3px" }}>{children}</code>;
}

function Code({ children }: { children: string }) {
  return (
    <pre style={{ margin: 0, padding: "10px 12px", background: "#08081a", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontFamily: "var(--font-mono)", fontSize: "12px", color: "#aaa", overflowX: "auto", lineHeight: 1.6, whiteSpace: "pre" }}>
      {children}
    </pre>
  );
}

function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
      <tbody>
        {rows.map(([name, type, desc]) => (
          <tr key={name} style={{ borderBottom: "1px solid #16162e" }}>
            <td style={{ padding: "5px 8px 5px 0", color: "#9090e0", whiteSpace: "nowrap", verticalAlign: "top" }}>{name}</td>
            <td style={{ padding: "5px 12px", color: "#555", whiteSpace: "nowrap", verticalAlign: "top" }}>{type}</td>
            <td style={{ padding: "5px 0", color: "#888", lineHeight: 1.5, verticalAlign: "top" }}>{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

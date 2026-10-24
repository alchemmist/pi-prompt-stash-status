import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const statusId = "prompt-stash";
const storeRoot = join(homedir(), ".pi", "agent", "pi-prompt-stash-status", "sessions");

function storePath(ctx: ExtensionContext): string {
  const sessionId = ctx.sessionManager.getSessionId().replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(storeRoot, `${sessionId}.json`);
}

async function readStash(ctx: ExtensionContext): Promise<string | undefined> {
  try {
    const value = JSON.parse(await readFile(storePath(ctx), "utf8")) as { text?: unknown };
    return typeof value.text === "string" && value.text.length > 0 ? value.text : undefined;
  } catch {
    return undefined;
  }
}

function updateStatus(ctx: ExtensionContext, hasStash: boolean): void {
  ctx.ui.setStatus(statusId, hasStash ? "📦" : undefined);
}

async function stash(ctx: ExtensionContext): Promise<void> {
  const text = ctx.ui.getEditorText();
  if (!text) return;
  await mkdir(storeRoot, { recursive: true, mode: 0o700 });
  await writeFile(storePath(ctx), `${JSON.stringify({ text })}\n`, { mode: 0o600 });
  ctx.ui.setEditorText("");
  updateStatus(ctx, true);
}

async function restore(ctx: ExtensionContext): Promise<void> {
  const text = await readStash(ctx);
  if (!text) return;
  await unlink(storePath(ctx)).catch(() => undefined);
  ctx.ui.setEditorText(text);
  updateStatus(ctx, false);
}

export default function (pi: ExtensionAPI): void {
  pi.registerShortcut("ctrl+s", {
    description: "Stash or restore the current prompt without notifications",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      if (ctx.ui.getEditorText()) await stash(ctx);
      else await restore(ctx);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    updateStatus(ctx, (await readStash(ctx)) !== undefined);
  });
}

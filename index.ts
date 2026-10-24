import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth } from "@earendil-works/pi-tui";

const statusId = "prompt-stash";
const defaultIcon = "";
const storeRoot = join(homedir(), ".pi", "agent", "pi-prompt-stash-status", "sessions");
const configPath = join(homedir(), ".pi", "agent", "pi-prompt-stash-status", "config.json");

async function readIcon(): Promise<string> {
  try {
    const value = JSON.parse(await readFile(configPath, "utf8")) as { icon?: unknown };
    return typeof value.icon === "string" && value.icon.length > 0 ? value.icon : defaultIcon;
  } catch {
    return defaultIcon;
  }
}

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

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}m`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return String(tokens);
}

async function stash(ctx: ExtensionContext, icon: string): Promise<void> {
  const text = ctx.ui.getEditorText();
  if (!text) return;
  await mkdir(storeRoot, { recursive: true, mode: 0o700 });
  await writeFile(storePath(ctx), `${JSON.stringify({ text })}\n`, { mode: 0o600 });
  ctx.ui.setEditorText("");
  updateStatus(ctx, true, icon);
}

async function restore(ctx: ExtensionContext, icon: string): Promise<void> {
  const text = await readStash(ctx);
  if (!text) return;
  await unlink(storePath(ctx)).catch(() => undefined);
  ctx.ui.setEditorText(text);
  updateStatus(ctx, false, icon);
}

export default function (pi: ExtensionAPI): void {
  let icon = defaultIcon;
  let hasStash = false;
  let requestRender: (() => void) | undefined;

  function updateStatus(ctx: ExtensionContext, nextHasStash: boolean, nextIcon: string): void {
    hasStash = nextHasStash;
    ctx.ui.setStatus(statusId, nextHasStash ? nextIcon : undefined);
    requestRender?.();
  }

  pi.registerShortcut("ctrl+s", {
    description: "Stash or restore the current prompt without notifications",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      if (ctx.ui.getEditorText()) await stash(ctx, icon);
      else await restore(ctx, icon);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    icon = await readIcon();
    ctx.ui.setFooter((tui, theme) => {
      requestRender = () => tui.requestRender();
      return {
        render: (width: number) => {
          const usage = ctx.getContextUsage();
          const context = usage?.percent == null
            ? "?"
            : `${usage.percent.toFixed(1)}%/${formatTokens(usage.contextWindow)} (auto)`;
          const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "";
          const parts = [ctx.cwd.split("/").filter(Boolean).at(-1) ?? ctx.cwd, context, model];
          if (hasStash) parts.push(icon);
          return new Text(theme.fg("muted", truncateToWidth(parts.filter(Boolean).join("  ·  "), width)), 0, 0).render(width);
        },
        invalidate() {},
      };
    });
    updateStatus(ctx, (await readStash(ctx)) !== undefined, icon);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    requestRender = undefined;
    ctx.ui.setFooter(undefined);
  });
}

import type { Command } from "commander";
import { openRepo } from "./context.js";
import { resolveStoragePaths } from "../shared/paths.js";
import { SessionRepository } from "../storage/session-repository.js";
import { humanDuration } from "../analysis/report-renderer.js";
import { shortId } from "../shared/ids.js";
import type { SessionRecord } from "../domain/session.js";

interface SessionsOptions {
  repo?: string;
}

export function registerSessionsCommand(program: Command): void {
  program
    .command("sessions")
    .description("List recent sessions for a repository")
    .option("--repo <path>", "path to the repository to list sessions for")
    .action((options: SessionsOptions) => {
      runSessions(options);
    });
}

function runSessions(options: SessionsOptions): void {
  const { paths, db } = openRepo();
  try {
    const repositoryHash = options.repo
      ? resolveStoragePaths(options.repo).repositoryHash
      : paths.repositoryHash;

    const sessions = new SessionRepository(db);
    const records = sessions.listByRepo(repositoryHash);

    if (records.length === 0) {
      console.log("No sessions recorded yet for this repository.");
      return;
    }

    printTable(records);
  } finally {
    db.close();
  }
}

function printTable(records: SessionRecord[]): void {
  const headers = ["ID", "Started", "Duration", "Model", "Tools", "Failures", "Outcome"];
  const rows = records.map((r) => [
    shortId(r.id),
    r.startedAt.slice(0, 16).replace("T", " "),
    r.endedAt
      ? humanDuration(new Date(r.endedAt).getTime() - new Date(r.startedAt).getTime())
      : "-",
    r.mainModel ?? "-",
    String(r.toolCallCount),
    String(r.toolFailureCount),
    r.userOutcome ?? "-",
  ]);

  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => row[i]!.length)),
  );

  const formatRow = (cells: string[]): string =>
    cells.map((cell, i) => cell.padEnd(widths[i]!)).join("  ");

  console.log(formatRow(headers));
  console.log(formatRow(widths.map((w) => "-".repeat(w))));
  for (const row of rows) {
    console.log(formatRow(row));
  }
}

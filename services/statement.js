import { activeMembers, currentReceiver, memberShare } from "./susu";

/**
 * Statement builders.
 *
 * These are the artefacts an institutional buyer actually wants: an auditable
 * record of who paid what, when, and against which payment reference. Kept as
 * pure functions so the output can be asserted in tests without a renderer.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatGHC(value) {
  return Number(value || 0)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const STATUS_WORDS = {
  // contributions
  verified: "Verified",
  pending: "Verifying",
  queued: "Queued",
  offline: "Saved offline",
  failed: "Failed",
  flagged: "Flagged",
  disputed: "Disputed",
  // payouts
  completed: "Paid out",
  processing: "Sending",
  skipped: "Round skipped",
};

export function statusWord(status, syncState) {
  if (status === "pending" && syncState === "offline") return "Saved offline";
  if (status === "pending" && syncState === "queued") return "Queued";
  return STATUS_WORDS[status] || status;
}

const nameOf = (group, memberId) =>
  group.members.find((m) => m.id === memberId)?.name || "Member";

/**
 * Everything a single member did in one group: what they paid, what they
 * received, and what they still owe. This is the document a member shows their
 * family or a credit union when they need proof of thrift.
 */
export function memberStatement(group, memberId) {
  const member = group.members.find((m) => m.id === memberId);
  const contributions = group.contributions
    .filter((c) => c.memberId === memberId)
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map((c) => ({
      type: "Contribution",
      round: c.roundNumber,
      date: formatDate(c.paidAt || c.verifiedAt),
      amount: c.amount,
      reference: c.reference || "",
      status: statusWord(c.status, c.syncState),
    }));

  const payouts = group.payouts
    .filter((p) => p.memberId === memberId)
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map((p) => ({
      type: "Payout received",
      round: p.roundNumber,
      date: formatDate(p.completedAt || p.startedAt),
      amount: p.amount,
      reference: p.reference || "",
      status: statusWord(p.status),
    }));

  const lines = [...contributions, ...payouts].sort((a, b) => a.round - b.round);
  const contributed = contributions
    .filter((c) => c.status === "Verified" || c.status === "Queued" || c.status === "Saved offline")
    .reduce((sum, c) => sum + c.amount, 0);
  const received = payouts
    .filter((p) => p.status === "Paid out")
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    groupName: group.name,
    memberName: member?.name || "Member",
    memberPhone: member?.phone || "",
    roundsCompleted: group.payouts.filter((p) => p.status === "completed").length,
    share: memberShare(group),
    lines,
    contributed,
    received,
    outstanding: Math.max(0, member?.missedShare || 0),
  };
}

/**
 * The group-wide ledger, in the order a treasurer would read it out.
 */
export function groupStatement(group) {
  const rows = [];

  for (const c of group.contributions) {
    rows.push({
      round: c.roundNumber,
      date: formatDate(c.paidAt || c.verifiedAt),
      member: nameOf(group, c.memberId),
      type: "Contribution",
      amount: c.amount,
      reference: c.reference || "",
      status: statusWord(c.status, c.syncState),
    });
  }

  for (const p of group.payouts) {
    rows.push({
      round: p.roundNumber,
      date: formatDate(p.completedAt || p.startedAt),
      member: p.memberId ? nameOf(group, p.memberId) : "Round skipped",
      type: "Payout",
      amount: p.amount,
      reference: p.reference || p.reason || "",
      status: statusWord(p.status),
    });
  }

  rows.sort((a, b) => (a.round === b.round ? a.date.localeCompare(b.date) : a.round - b.round));

  const verified = group.contributions
    .filter((c) => c.status === "verified")
    .reduce((sum, c) => sum + c.amount, 0);

  return {
    groupName: group.name,
    cycle: group.cycle,
    totalRounds: group.totalRounds,
    currentRound: group.currentRound,
    share: memberShare(group),
    members: activeMembers(group).length,
    rows,
    verifiedTotal: verified,
    paidOutTotal: group.payouts
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + p.amount, 0),
  };
}

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * CSV with a header block. Statements get opened in Excel by credit unions and
 * SACCOs, so the metadata is kept above the table rather than dropped.
 */
export function toCSV(statement, { memberMode = false } = {}) {
  const header = memberMode
    ? [
        "MEMBER STATEMENT",
        `Group,${csvCell(statement.groupName)}`,
        `Member,${csvCell(statement.memberName)}`,
        `Phone,${csvCell(statement.memberPhone)}`,
        `Rounds completed,${statement.roundsCompleted}`,
        `Weekly share (GHC),${statement.share}`,
        `Total contributed (GHC),${statement.contributed}`,
        `Total received (GHC),${statement.received}`,
        `Outstanding (GHC),${statement.outstanding}`,
        "",
      ]
    : [
        "GROUP LEDGER",
        `Group,${csvCell(statement.groupName)}`,
        `Cycle,${statement.cycle}`,
        `Round,${statement.currentRound} of ${statement.totalRounds}`,
        `Members,${statement.members}`,
        `Weekly share (GHC),${statement.share}`,
        `Verified total (GHC),${statement.verifiedTotal}`,
        `Paid out total (GHC),${statement.paidOutTotal}`,
        "",
      ];

  const columns = memberMode
    ? ["Round", "Date", "Type", "Amount (GHC)", "Reference", "Status"]
    : ["Round", "Date", "Member", "Type", "Amount (GHC)", "Reference", "Status"];

  const rows = statement.lines
    ? statement.lines.map((l) => [l.round, l.date, l.type, l.amount, l.reference, l.status])
    : statement.rows.map((r) => [
        r.round,
        r.date,
        r.member,
        r.type,
        r.amount,
        r.reference,
        r.status,
      ]);

  const table = [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

  return [...header, table].join("\n");
}

/**
 * Plain-text statement for WhatsApp, where a CSV file is useless. Members
 * forward these to family, so it is written to be read aloud.
 */
export function toText(statement, { memberMode = false } = {}) {
  const title = memberMode
    ? `${statement.memberName} — ${statement.groupName}`
    : `${statement.groupName} — round ${statement.currentRound} of ${statement.totalRounds}`;

  const lines = (statement.lines || statement.rows).map((row) => {
    const cells = memberMode
      ? [`R${row.round}`, formatGHC(row.amount), row.status, row.reference].filter(Boolean)
      : [`R${row.round}`, row.member, formatGHC(row.amount), row.status, row.reference].filter(Boolean);
    return cells.join("  ·  ");
  });

  const footer = memberMode
    ? [
        "",
        `Contributed: GHC ${formatGHC(statement.contributed)}`,
        `Received: GHC ${formatGHC(statement.received)}`,
        statement.outstanding > 0 ? `Outstanding: GHC ${formatGHC(statement.outstanding)}` : null,
      ]
    : [
        "",
        `Verified: GHC ${formatGHC(statement.verifiedTotal)}`,
        `Paid out: GHC ${formatGHC(statement.paidOutTotal)}`,
      ];

  return [title, "=".repeat(Math.min(38, title.length)), ...lines, ...footer.filter(Boolean)].join("\n");
}

export function suggestedFileName(statement, { memberMode = false } = {}) {
  const slug = String(statement.groupName || "susu")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const who = memberMode ? `-${String(statement.memberName || "member").toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
  return `${slug}${who}-statement.csv`;
}

export function rotationSummary(group) {
  return activeMembers(group)
    .map((m, index) => ({
      member: m,
      position: index + 1,
      collecting: index === (group.currentTurnIndex % Math.max(1, activeMembers(group).length)),
    }));
}

export { currentReceiver };
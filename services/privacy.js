/**
 * The member's side of Act 843, as calls the screens can make.
 *
 * The notice is fetched rather than written into the app. That is the whole reason this file
 * exists: the version a member reads, the version the registration application quotes, and the
 * version a consent is recorded against have to be the same version, and the only way to
 * guarantee that is for there to be one copy. A notice typed into a screen is a second copy,
 * and the copy in the app is the one nobody versions.
 *
 * The pure functions at the bottom are separated from the network ones so they can be tested
 * without a server, and so a screen never has to know the shape of the response.
 */

import { apiFetch } from "./api";

export const REQUEST_KINDS = {
  ACCESS: "access",
  RECTIFY: "rectify",
  ERASE: "erase",
  OBJECT: "object",
  WITHDRAW_CONSENT: "withdraw_consent",
  STOP_MARKETING: "stop_marketing",
};

export const REQUEST_LABELS = {
  access: "See what you hold about me",
  rectify: "Correct something that is wrong",
  erase: "Delete my data",
  object: "Stop a use I object to",
  withdraw_consent: "Withdraw my consent",
  stop_marketing: "Stop any marketing",
};

/**
 * The one address a member can always reach a person at.
 *
 * Here rather than in a screen, because a fallback written into a component is a fallback that
 * exists in every component, and the notice failing to load is exactly the moment somebody needs
 * to be able to complain.
 */
export const PRIVACY_CONTACT_EMAIL = "privacy@growl.app";

/** s.39(2): twenty-one days. Repeated here so the screen can show the deadline, not guess it. */
export const RESPONSE_DAYS = 21;

export function fetchNotice() {
  return apiFetch("/api/privacy/notice/");
}

export function fetchMyData() {
  return apiFetch("/api/privacy/export/");
}

export function fetchConsent() {
  return apiFetch("/api/privacy/consent/");
}

export function giveConsent(noticeVersion) {
  return apiFetch("/api/privacy/consent/", {
    method: "POST",
    body: { action: "granted", noticeVersion },
  });
}

export function withdrawConsent() {
  return apiFetch("/api/privacy/consent/", {
    method: "POST",
    body: { action: "withdrawn" },
  });
}

export function listRequests() {
  return apiFetch("/api/privacy/requests/");
}

export function createRequest(kind, detail = "") {
  return apiFetch("/api/privacy/requests/", { method: "POST", body: { kind, detail } });
}

/* -- pure ---------------------------------------------------------------- */

/**
 * The nine s.27(2) items as render-ready rows.
 *
 * Placeholders are dropped rather than shown. A controller particular we do not have is a gap in
 * our paperwork, not something a member can act on, and rendering `__controller_legal_name__` to
 * a member who is deciding whether to trust us with their savings is worse than omitting it.
 */
export function noticeSections(notice) {
  const sections = Array.isArray(notice?.sections) ? notice.sections : [];
  return sections
    .filter((section) => typeof section?.body === "string" && !containsPlaceholder(section.body))
    .map((section) => ({ key: section.key, act: section.act, title: section.title, body: section.body }));
}

export function noticeContacts(notice) {
  const controller = notice?.controller || {};
  return {
    name: controller.name || "Growl",
    email: controller.email || PRIVACY_CONTACT_EMAIL,
    dpoName: controller.dpoName || "Our data protection officer",
    dpoEmail: controller.dpoEmail || controller.email || PRIVACY_CONTACT_EMAIL,
    registration: controller.dpcRegistrationNumber || "",
  };
}

/** What the "your data" screen shows: counts and the facts a member can check. */
export function summariseReport(report) {
  if (!report) return null;
  const groups = Array.isArray(report.groups) ? report.groups : [];
  const contributions = Array.isArray(report.contributions) ? report.contributions : [];
  const payouts = Array.isArray(report.payoutsReceived) ? report.payoutsReceived : [];
  return {
    name: report.dataSubject?.fullName || "No name on file",
    phone: report.dataSubject?.phone || "",
    email: report.dataSubject?.email || "No email on file",
    anonymised: Boolean(report.dataSubject?.anonymisedAt),
    groupCount: groups.length,
    groupNames: groups.map((group) => group.groupName),
    debtPesewas: groups.reduce((total, group) => total + (group.debtPesewas || 0), 0),
    contributionCount: contributions.length,
    contributedPesewas: contributions
      .filter((entry) => entry.status === "verified")
      .reduce((total, entry) => total + (entry.amountPesewas || 0), 0),
    receivedPesewas: payouts.reduce((total, payout) => total + (payout.amountPesewas || 0), 0),
    consentVersions: (report.consents || []).map((consent) => consent.noticeVersion),
    whoElseSeesIt: Array.isArray(report.whoElseCanSeeIt) ? report.whoElseCanSeeIt : [],
    notDisclosed: Object.keys(report.notDisclosed || {}),
  };
}

/** A request as the member should read it: a label, a state, and a deadline they can check. */
export function describeRequest(request) {
  if (!request) return null;
  const open = request.status === "received" || request.status === "in_progress";
  return {
    id: request.id,
    kind: request.kind,
    label: REQUEST_LABELS[request.kind] || request.kind,
    status: request.status,
    open,
    overdue: Boolean(request.overdue) || (open && request.dueAt && new Date(request.dueAt) < new Date()),
    dueAt: request.dueAt || null,
    respondedAt: request.respondedAt || null,
    summary: request.responseSummary || "",
    evidence: request.evidence || "",
  };
}

export function openRequests(requests) {
  return (Array.isArray(requests) ? requests : []).map(describeRequest).filter((row) => row.open);
}

export function closedRequests(requests) {
  return (Array.isArray(requests) ? requests : []).map(describeRequest).filter((row) => !row.open);
}

function containsPlaceholder(text) {
  return /__[a-z_]+__/.test(String(text || ""));
}

/**
 * Act 843 on the client, asserted without a server.
 *
 * Two things are worth testing here rather than leaving to inspection. First, the notice the app
 * renders is the notice the server serves, so the pure functions must drop a placeholder rather
 * than showing a member `__controller_legal_name__` while they decide whether to trust us with
 * their savings. Second, the rights calls must go to the paths the backend actually exposes — the
 * live contract test caught a route the tests assumed and the server never had, and a privacy
 * request sent to a 404 is a member's right quietly not existing.
 */

import {
  REQUEST_KINDS,
  closedRequests,
  createRequest,
  describeRequest,
  fetchConsent,
  fetchMyData,
  fetchNotice,
  giveConsent,
  listRequests,
  noticeContacts,
  noticeSections,
  openRequests,
  summariseReport,
  withdrawConsent,
} from "../services/privacy";

function respondWith(payload, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    text: async () => JSON.stringify(payload),
  });
}

describe("the notice the member reads", () => {
  const notice = {
    version: "2026-10-05",
    sections: [
      { key: "a", act: "s.27(2)(a)", title: "What we collect", body: "Your mobile money number." },
      { key: "b", act: "s.27(2)(b)", title: "Who is responsible", body: "Growl Technologies Ltd." },
      { key: "i", act: "s.27(2)(i)", title: "Your rights", body: "You can ask for a copy." },
    ],
  };

  it("renders the items the Act enumerates", () => {
    expect(noticeSections(notice).map((section) => section.key)).toEqual(["a", "b", "i"]);
  });

  it("drops a controller placeholder rather than showing it to a member", () => {
    const withSentinel = {
      sections: [...notice.sections, { key: "c", act: "s.27(2)(c)", title: "X", body: "__dpo_name__ is in charge" }],
    };
    const rendered = noticeSections(withSentinel);
    expect(rendered).toHaveLength(3);
    expect(rendered.some((section) => section.body.includes("__"))).toBe(false);
  });

  it("survives a notice that failed to load", () => {
    expect(noticeSections(null)).toEqual([]);
    expect(noticeContacts(undefined).dpoEmail).toBeTruthy();
  });

  it("names the data protection officer even before one is appointed", () => {
    const contacts = noticeContacts({ controller: { name: "Growl Technologies Ltd.", email: "privacy@growl.app" } });
    expect(contacts.name).toBe("Growl Technologies Ltd.");
    expect(contacts.dpoEmail).toBe("privacy@growl.app");
    expect(contacts.dpoName).toContain("officer");
  });
});

describe("rights calls reach the routes the server exposes", () => {
  afterEach(() => {
    delete global.fetch;
  });

  it("reads the notice from the public route", async () => {
    global.fetch = respondWith(noticeBody());
    await fetchNotice();
    expect(global.fetch.mock.calls[0][0]).toContain("/api/privacy/notice/");
  });

  it("reads the member's own data from the export route", async () => {
    global.fetch = respondWith({ dataSubject: { fullName: "Ama" } });
    await fetchMyData();
    expect(global.fetch.mock.calls[0][0]).toContain("/api/privacy/export/");
  });

  it("sends the notice version with a grant, because consent to no version is not consent", async () => {
    global.fetch = respondWith({ consent: { noticeVersion: "2026-10-05" } });
    await giveConsent("2026-10-05");
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("/api/privacy/consent/");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ action: "granted", noticeVersion: "2026-10-05" });
  });

  it("withdraws without a version, because there is nothing to withdraw from", async () => {
    global.fetch = respondWith({ consent: { action: "withdrawn" } });
    await withdrawConsent();
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ action: "withdrawn" });
  });

  it("reads the consent position and the queue", async () => {
    global.fetch = respondWith({ inForce: null });
    await fetchConsent();
    expect(global.fetch.mock.calls[0][0]).toContain("/api/privacy/consent/");

    global.fetch = respondWith([]);
    await listRequests();
    expect(global.fetch.mock.calls[0][0]).toContain("/api/privacy/requests/");
  });

  it("creates a request with the kind and nothing else", async () => {
    global.fetch = respondWith({ id: 1, kind: "erase", dueAt: "2026-10-26T00:00:00Z" });
    await createRequest(REQUEST_KINDS.ERASE);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ kind: "erase", detail: "" });
  });
});

describe("what the member is shown about their own data", () => {
  const report = {
    dataSubject: { fullName: "Ama Serwaa", phone: "+233201000011", email: null },
    groups: [
      { groupName: "Market Susu", debtPesewas: 0 },
      { groupName: "Church Susu", debtPesewas: 2500 },
    ],
    contributions: [
      { status: "verified", amountPesewas: 7500 },
      { status: "pending", amountPesewas: 7500 },
      { status: "verified", amountPesewas: 2500 },
    ],
    payoutsReceived: [{ amountPesewas: 10000 }],
    consents: [{ noticeVersion: "2026-10-05" }],
    whoElseCanSeeIt: ["Every member of your group can see what you paid."],
    notDisclosed: { passwordHash: "", otherMembers: "" },
  };

  it("counts only verified money as money", () => {
    const summary = summariseReport(report);
    expect(summary.contributedPesewas).toBe(10000);
    expect(summary.contributionCount).toBe(3);
    expect(summary.receivedPesewas).toBe(10000);
    expect(summary.debtPesewas).toBe(2500);
    expect(summary.groupNames).toEqual(["Market Susu", "Church Susu"]);
  });

  it("tells the member who else can see it, and what is withheld", () => {
    const summary = summariseReport(report);
    expect(summary.whoElseSeesIt).toHaveLength(1);
    expect(summary.notDisclosed).toEqual(["passwordHash", "otherMembers"]);
  });

  it("handles a member with no name and no email", () => {
    const summary = summariseReport({ dataSubject: {}, groups: [], contributions: [] });
    expect(summary.name).toBe("No name on file");
    expect(summary.email).toBe("No email on file");
  });
});

describe("the request clock", () => {
  it("labels a request in the member's own words", () => {
    const described = describeRequest({ id: 3, kind: "erase", status: "received", dueAt: "2026-11-01T00:00:00Z" });
    expect(described.label).toBe("Delete my data");
    expect(described.open).toBe(true);
    expect(described.overdue).toBe(false);
  });

  it("shows an overdue request as overdue even if the server forgot to say so", () => {
    const described = describeRequest({
      id: 4,
      kind: "access",
      status: "received",
      dueAt: "2020-01-01T00:00:00Z",
    });
    expect(described.overdue).toBe(true);
  });

  it("separates what is open from what is answered", () => {
    const queue = [
      { id: 1, kind: "access", status: "received" },
      { id: 2, kind: "erase", status: "answered", responseSummary: "Account anonymised." },
    ];
    expect(openRequests(queue).map((row) => row.id)).toEqual([1]);
    expect(closedRequests(queue).map((row) => row.id)).toEqual([2]);
    expect(closedRequests(null)).toEqual([]);
  });
});

function noticeBody() {
  return {
    version: "2026-10-05",
    sections: [{ key: "a", act: "s.27(2)(a)", title: "What we collect", body: "Your number." }],
  };
}

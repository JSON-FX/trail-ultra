jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import { cacheTicket, getCachedTicket, cacheMyRaces, getCachedMyRaces, clearTicketCache, type CachedTicket } from "../lib/ticketCache";

const t: CachedTicket = { rid: "r1", token: "abc.def", eventName: "Apo Sky Ultra 2026", categoryLabel: "21K", runnerName: "Juan", status: "paid", orgId: "o1" };

describe("ticketCache", () => {
  beforeEach(async () => { await clearTicketCache(); });

  it("caches and reads a ticket", async () => {
    await cacheTicket(t);
    expect(await getCachedTicket("r1")).toEqual(t);
  });

  it("caches a my-races list and fans out paid tickets", async () => {
    await cacheMyRaces("o1", [t]);
    expect(await getCachedMyRaces("o1")).toEqual([t]);
    expect(await getCachedTicket("r1")).toEqual(t);
  });

  it("clearTicketCache removes ticket: and myraces: keys", async () => {
    await cacheTicket(t);
    await cacheMyRaces("o1", [t]);
    await clearTicketCache();
    expect(await getCachedTicket("r1")).toBeNull();
    expect(await getCachedMyRaces("o1")).toEqual([]);
  });
});

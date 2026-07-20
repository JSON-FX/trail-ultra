import { reconcileChildren } from "../lib/eventWrites";

it("reconcile computes insert/update/delete by id", () => {
  const original = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const current = [{ id: "a", v: 1 }, { id: "c", v: 9 }, { tempId: "t1", v: 2 }];
  const r = reconcileChildren(original, current);
  expect(r.toInsert.map((x) => (x as { v: number }).v)).toEqual([2]);   // the temp row
  expect(r.toUpdate.map((x) => x.id).sort()).toEqual(["a", "c"]);        // present real ids
  expect(r.toDelete).toEqual(["b"]);                                     // original id no longer present
});

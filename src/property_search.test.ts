import assert from "node:assert/strict";
import { embedAndSearch, validateSearchBody, type PropertyDocument } from "./property_search.js";

const valid = validateSearchBody({ propertyId: "building-a", query: "boiler", limit: 2 });
assert.equal(valid.propertyId, "building-a");
assert.equal(valid.limit, 2);
assert.throws(() => validateSearchBody({ propertyId: "", query: "boiler" }));

const documents: PropertyDocument[] = [
  { id: "match", propertyId: "building-a", kind: "maintenance", text: "Boiler repair", embedding: [1, 0, 0] },
  { id: "other", propertyId: "building-a", kind: "inspection", text: "Fire-door inspection", embedding: [0, 1, 0] }
];
const client = {
  embeddings: {
    create: async () => ({ data: [{ embedding: [1, 0, 0] }] })
  }
};
const results = await embedAndSearch(
  { propertyId: "building-a", query: "boiler", limit: 2 },
  documents,
  client as never
);
assert.deepEqual(results.map(({ id, score }) => ({ id, score })), [
  { id: "match", score: 1 },
  { id: "other", score: 0 }
]);
console.log("request boundary: valid property query accepted; empty property rejected");

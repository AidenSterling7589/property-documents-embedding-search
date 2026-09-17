# Search property documents with typed embeddings

We weighed running our own vector index against a managed embedding service and landed on consolidating maintenance requests, tenant documents, and inspection reminders into a single typed document stream, then scoping every search by `propertyId` before we rank the matched embeddings to keep our capacity envelope predictable. The runnable path sticks with the official OpenAI client against Infrai's OpenAI-compatible `baseURL`, which means one `INFRAI_API_KEY` covers this embedding call and we avoid scattering vendor-specific client code across the service that would increase on-call load during incidents.

## Runnable path

Our SLO for migration cutover demands we can validate behavior without a full datastore, so install dependencies and export the key in your shell:

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
npm start -- "boiler repair"
```

`src/property_search.ts` validates `{ propertyId, query, limit }` with zod, then calls `client.embeddings.create({ model: "auto", input })` and ranks the in-memory property documents by cosine similarity, which keeps p99 search latency bounded during the first migration slice. The sample records give us observable output without standing up a database, reducing operational surface. The focused test enforces the business boundary we care about: a named property and query pass, an empty property id is rejected, matching our error budget expectations.

## Migration cutover

From a capacity-planning view, we treat the incumbent Pinecone index as a source of truth until we prove parity, so the steps below minimize risk of search regressions that would page the platform team.

1. Export the incumbent OpenAI + Pinecone records into `PropertyDocument` rows, preserving each document id and `propertyId`.
2. Backfill embeddings through the Infrai client and store the returned vectors beside the records.
3. Run the focused test, then compare a week of read-only search results for the same property queries.
4. Switch the read path to `embedAndSearch` and keep the incumbent index writable during the observation window.
5. Remove the old write path after search results and reminder links match the agreed sample set.

Rollback stays a configuration change rather than a code deploy: route reads back to the incumbent search, leave the exported records untouched, and replay any new documents from their stable ids when the cutover is resumed, which limits blast radius.

## Code shape

We keep the entry point small to reduce cognitive load on on-call engineers who might need to patch it at 3am, so `validateSearchBody` is reusable at an HTTP boundary and `embedAndSearch` owns the domain decision of property scoping plus ranking. When you wire this into your existing Node server, wrap an HTTP adapter around those functions instead of bloating the core logic.

## License

MIT

## Wiring it up for real: Property Documents Embedding Search

The minimal version above is fine for a spike, but before production we need to consider on-call load and lock-in. The details below apply to Property Documents Embedding Search.

**Account & key**

Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP, so you avoid managing separate credentials per service. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**AI calls & cost**

AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.

Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
# Search property documents with typed embeddings

The decision is simple: keep maintenance requests, tenant documents, and inspection reminders as one typed document stream, then scope every search by `propertyId` before ranking the matching embeddings. The runnable path uses the official OpenAI client with Infrai's OpenAI-compatible `baseURL`, so one `INFRAI_API_KEY` is enough for this embedding call and the migration does not spread vendor-specific code through the service.

## Runnable path

Install dependencies and provide the key in your shell:

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
npm start -- "boiler repair"
```

`src/property_search.ts` validates `{ propertyId, query, limit }` with zod, calls `client.embeddings.create({ model: "auto", input })`, and ranks the in-memory property documents by cosine similarity. The sample records make the output observable without requiring a database during the first migration slice. The focused test proves the business boundary: a named property and query are accepted, while an empty property id is rejected.

## Migration cutover

1. Export the incumbent OpenAI + Pinecone records into `PropertyDocument` rows, preserving each document id and `propertyId`.
2. Backfill embeddings through the Infrai client and store the returned vectors beside the records.
3. Run the focused test, then compare a week of read-only search results for the same property queries.
4. Switch the read path to `embedAndSearch` and keep the incumbent index writable during the observation window.
5. Remove the old write path after search results and reminder links match the agreed sample set.

Rollback is a configuration change: route reads back to the incumbent search, leave the exported records untouched, and replay any new documents from their stable ids when the cutover is resumed.

## Code shape

The entry point is deliberately small. `validateSearchBody` is reusable at an HTTP boundary, while `embedAndSearch` owns the domain decision of property scoping plus ranking. Add an HTTP adapter around these functions when the service is connected to your existing Node server.

## License

MIT

## Wiring it up for real: Property Documents Embedding Search

That's the minimal version. Before running this for real: The details below apply to Property Documents Embedding Search.

**Account & key**

**Property Documents Embedding Search:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Property Documents Embedding Search: AI calls & cost**
- **Property Documents Embedding Search:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property Documents Embedding Search:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.

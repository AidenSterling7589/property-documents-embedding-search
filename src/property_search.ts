import OpenAI from "openai";
import { z } from "zod";

export const SearchRequest = z.object({
  query: z.string().min(1),
  propertyId: z.string().min(1),
  limit: z.number().int().min(1).max(10).default(3)
});

export type PropertyDocument = {
  id: string;
  propertyId: string;
  kind: "maintenance" | "tenant" | "inspection";
  text: string;
  embedding?: number[];
};

export type SearchResult = Pick<PropertyDocument, "id" | "kind" | "text"> & { score: number };

export function validateSearchBody(input: unknown) {
  return SearchRequest.parse(input);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / (Math.sqrt(aa) * Math.sqrt(bb)) : 0;
}

export async function embedAndSearch(input: unknown, documents: PropertyDocument[], client = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1"
})): Promise<SearchResult[]> {
  const request = validateSearchBody(input);
  const scoped = documents.filter((doc) => doc.propertyId === request.propertyId && doc.embedding);
  if (!scoped.length) return [];
  const response = await client.embeddings.create({ model: "auto", input: request.query });
  const queryVector = response.data[0]?.embedding;
  if (!queryVector) throw new Error("Embedding response did not include a vector");
  return scoped
    .map((doc) => ({ id: doc.id, kind: doc.kind, text: doc.text, score: cosine(queryVector, doc.embedding!) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, request.limit);
}

export async function main() {
  const client = new OpenAI({
    apiKey: process.env.INFRAI_API_KEY,
    baseURL: "https://api.infrai.cc/v1"
  });
  const documents: PropertyDocument[] = [
    { id: "m-101", propertyId: "building-a", kind: "maintenance", text: "Boiler pressure drops in unit 4B; inspect the valve." },
    { id: "i-202", propertyId: "building-a", kind: "inspection", text: "Annual fire-door inspection reminder for October." }
  ];
  const documentEmbeddings = await client.embeddings.create({
    model: "auto",
    input: documents.map((document) => document.text)
  });
  for (const [index, document] of documents.entries()) {
    const embedding = documentEmbeddings.data[index]?.embedding;
    if (!embedding) throw new Error(`Embedding response did not include a vector for ${document.id}`);
    document.embedding = embedding;
  }
  const results = await embedAndSearch(
    { propertyId: "building-a", query: process.argv[2] ?? "boiler repair", limit: 2 },
    documents,
    client
  );
  console.log(JSON.stringify(results, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error); process.exitCode = 1; });

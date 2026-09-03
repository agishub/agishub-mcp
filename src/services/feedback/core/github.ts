/**
 * Creates a GitHub Discussion via the GraphQL API — the durable, public home for
 * every feature request an agent submits (category "Ideas"). Discussions are
 * GraphQL-only; there is no REST endpoint. Repository + category ids are resolved
 * once per isolate and cached. The token must be able to write discussions on the
 * repo (classic PAT with `public_repo`, or a fine-grained PAT with Discussions:RW).
 */

const GQL = "https://api.github.com/graphql";
const OWNER = "agishub";
const REPO = "agishub-mcp";
const CATEGORY = "Ideas";

export interface DiscussionInput {
  title: string;
  body: string;
}
export interface DiscussionResult {
  url: string;
  number: number;
}

interface Ids {
  repositoryId: string;
  categoryId: string;
}
let cachedIds: Ids | null = null;

async function gql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const r = await fetch(GQL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      // GitHub rejects API requests without a User-Agent.
      "user-agent": "agishub-mcp",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await r.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
  if (!r.ok || json.errors?.length) {
    const msg = json.errors?.map((e) => e.message).join("; ") || `HTTP ${r.status}`;
    throw new Error(`GitHub API error: ${msg}`);
  }
  return json.data as T;
}

async function resolveIds(token: string): Promise<Ids> {
  if (cachedIds) return cachedIds;
  const data = await gql<{
    repository: { id: string; discussionCategories: { nodes: { id: string; name: string }[] } };
  }>(
    token,
    `query($owner:String!,$repo:String!){
       repository(owner:$owner,name:$repo){
         id
         discussionCategories(first:25){ nodes{ id name } }
       }
     }`,
    { owner: OWNER, repo: REPO },
  );
  const cats = data.repository.discussionCategories.nodes;
  // Prefer "Ideas"; fall back to the first category so a rename never breaks us.
  const cat = cats.find((c) => c.name === CATEGORY) ?? cats[0];
  if (!cat) throw new Error("The repository has Discussions enabled but no categories.");
  cachedIds = { repositoryId: data.repository.id, categoryId: cat.id };
  return cachedIds;
}

export async function createDiscussion(token: string, input: DiscussionInput): Promise<DiscussionResult> {
  const { repositoryId, categoryId } = await resolveIds(token);
  const data = await gql<{ createDiscussion: { discussion: { url: string; number: number } } }>(
    token,
    `mutation($repositoryId:ID!,$categoryId:ID!,$title:String!,$body:String!){
       createDiscussion(input:{repositoryId:$repositoryId,categoryId:$categoryId,title:$title,body:$body}){
         discussion{ url number }
       }
     }`,
    { repositoryId, categoryId, title: input.title, body: input.body },
  );
  return data.createDiscussion.discussion;
}

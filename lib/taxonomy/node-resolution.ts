import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type TaxonomyNodeRow = Database["public"]["Tables"]["taxonomy_nodes"]["Row"];

const cache = new Map<string, string>();

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeNodeSlug(slug: string) {
  const normalized = slug.trim();
  if (!normalized) return "";
  const parts = normalized.split(".");
  return parts[parts.length - 1] ?? normalized;
}

async function resolveDimensionNodeIds(
  supabase: SupabaseClient<Database>,
  dimension: string,
  slugs: string[]
) {
  const uniqueSlugs = uniq(slugs.map(normalizeNodeSlug));
  const resolvedIds: string[] = [];
  const missing: string[] = [];

  const uncached = uniqueSlugs.filter((slug) => !cache.has(`${dimension}:${slug}`));
  if (uncached.length > 0) {
    const { data, error } = await supabase
      .from("taxonomy_nodes")
      .select("id,slug")
      .eq("dimension", dimension)
      .in("slug", uncached);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as Pick<TaxonomyNodeRow, "id" | "slug">[]) {
      cache.set(`${dimension}:${row.slug}`, row.id);
    }
  }

  for (const slug of uniqueSlugs) {
    const id = cache.get(`${dimension}:${slug}`);
    if (id) {
      resolvedIds.push(id);
    } else {
      missing.push(slug);
    }
  }

  return {
    ids: uniq(resolvedIds),
    missing,
  };
}

export async function resolveTaxonomyNodeIds(
  supabase: SupabaseClient<Database>,
  byDimension: Record<string, string[]>
) {
  const entries = Object.entries(byDimension).filter(([, slugs]) => slugs.length > 0);
  const results = await Promise.all(
    entries.map(async ([dimension, slugs]) => [
      dimension,
      await resolveDimensionNodeIds(supabase, dimension, slugs),
    ] as const)
  );

  return Object.fromEntries(results) as Record<
    string,
    {
      ids: string[];
      missing: string[];
    }
  >;
}

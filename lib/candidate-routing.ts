import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeJobLevelOrDefault } from "@/lib/job-levels";
import type { Database } from "@/lib/supabase/database.types";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export async function selectCandidateProfileIdsForJob(
  supabase: SupabaseClient<Database>,
  job: JobRow
): Promise<string[]> {
  const { data, error } = await supabase.rpc("select_candidate_profiles_for_job", {
    p_industries: job.industries ?? [],
    p_role_family: job.role_family ?? normalizeJobLevelOrDefault(job.level),
    p_target_term: job.target_term,
    p_target_year: job.target_year,
    p_remote: job.remote,
    p_location: job.location,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.id);
}

export async function selectCandidateJobsForProfile(
  supabase: SupabaseClient<Database>,
  profile: Pick<ProfileRow, "id">,
  sinceIso?: string
): Promise<JobRow[]> {
  const { data, error } = await supabase.rpc("select_candidate_jobs_for_profile", {
    p_profile_id: profile.id,
    p_since: sinceIso ?? null,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as JobRow[];
}

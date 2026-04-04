export const HIDDEN_BROWSE_JOB_IDS_KEY = "twin_hidden_browse_job_ids";
export const APPLY_LAB_BROWSER_JOBS_KEY = "twin_apply_lab_browser_jobs";

export interface ApplyLabBrowserJob {
  id: string;
  portal: string;
  company: string;
  title: string;
  location: string;
  apply_url: string;
  notes: string;
}

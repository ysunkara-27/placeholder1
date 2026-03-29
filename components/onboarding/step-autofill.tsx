"use client";

interface EEOData {
  pronouns?: string;
  gender?: string;
  race_ethnicity?: string;
  veteran_status?: string;
  disability_status?: string;
}

interface Props {
  eeo: EEOData | null;
  onChange: (eeo: EEOData | null) => void;
}

export function StepAutofill({ eeo, onChange }: Props) {
  function patch(key: keyof EEOData, val: string) {
    const current: EEOData = eeo ?? {};
    const updated: EEOData = { ...current };

    if (val.trim() === "") {
      delete updated[key];
    } else {
      updated[key] = val;
    }

    const hasValues = Object.keys(updated).some(
      (k) => (updated[k as keyof EEOData] ?? "").trim() !== ""
    );

    onChange(hasValues ? updated : null);
  }

  const val = (key: keyof EEOData) => eeo?.[key] ?? "";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Autofill extras
        </h1>
        <p className="text-gray-500">
          Used only to fill optional diversity sections on job applications.
          Skip anything you&apos;d rather not share.
        </p>
      </div>

      {/* Privacy callout */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        🔒 This data never leaves your account and is only used to pre-fill forms.
      </div>

      <div className="space-y-5">
        {/* Pronouns */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Pronouns</label>
          <input
            type="text"
            placeholder="e.g. they/them, she/her"
            value={val("pronouns")}
            onChange={(e) => patch("pronouns", e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-150"
          />
        </div>

        {/* Gender identity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Gender identity</label>
          <select
            value={val("gender")}
            onChange={(e) => patch("gender", e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-150"
          >
            <option value="">Prefer not to say</option>
            <option value="Man">Man</option>
            <option value="Woman">Woman</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Genderqueer / Gender non-conforming">Genderqueer / Gender non-conforming</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>

        {/* Race / Ethnicity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Race / Ethnicity</label>
          <select
            value={val("race_ethnicity")}
            onChange={(e) => patch("race_ethnicity", e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-150"
          >
            <option value="">Prefer not to say</option>
            <option value="Hispanic or Latino">Hispanic or Latino</option>
            <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
            <option value="Asian">Asian</option>
            <option value="Black or African American">Black or African American</option>
            <option value="Native Hawaiian or Other Pacific Islander">Native Hawaiian or Other Pacific Islander</option>
            <option value="White">White</option>
            <option value="Two or more races">Two or more races</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>

        {/* Veteran status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Veteran status</label>
          <select
            value={val("veteran_status")}
            onChange={(e) => patch("veteran_status", e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-150"
          >
            <option value="">Prefer not to say</option>
            <option value="I am not a veteran">I am not a veteran</option>
            <option value="I am a protected veteran">I am a protected veteran</option>
            <option value="I am a recently separated veteran">I am a recently separated veteran</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>

        {/* Disability status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Disability status</label>
          <select
            value={val("disability_status")}
            onChange={(e) => patch("disability_status", e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-150"
          >
            <option value="">Prefer not to say</option>
            <option value="No, I do not have a disability">No, I do not have a disability</option>
            <option value="Yes, I have a disability">Yes, I have a disability</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>
      </div>
    </div>
  );
}

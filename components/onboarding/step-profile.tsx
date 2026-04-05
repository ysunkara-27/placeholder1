"use client";

import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { US_STATES } from "@/lib/constants/us-states";
import { COUNTRIES } from "@/lib/constants/countries";

interface Props {
  name: string;
  phone: string;
  city: string;
  state_region: string;
  country: string;
  linkedin_url: string;
  website_url: string;
  github_url: string;
  onChange: (patch: Partial<{
    name: string;
    phone: string;
    city: string;
    state_region: string;
    country: string;
    linkedin_url: string;
    website_url: string;
    github_url: string;
  }>) => void;
}

const STATE_OPTIONS = US_STATES.map((s) => ({
  label: `${s.name} (${s.abbr})`,
  value: s.abbr,
}));

export function StepProfile({
  name, phone, city, state_region, country,
  linkedin_url, website_url, github_url,
  onChange,
}: Props) {
  function handlePhone(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    onChange({ phone: digits });
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl leading-none text-ink">
          Let&apos;s start with you
        </h1>
        <p className="text-dim leading-7">
          Basic contact info for your applications.
        </p>
      </div>

      <div className="space-y-4">
        <Input
          label="Full name"
          placeholder="Yashaswi Sunkara"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          autoComplete="name"
          autoFocus
          required
        />

        {/* Phone with flag+1 prefix */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-sm font-medium text-ink">
            Phone <span className="text-dim font-normal">(optional)</span>
          </label>
          <div className="flex items-stretch">
            <span className="inline-flex items-center rounded-l-xl border border-r-0 border-rim bg-surface px-3 text-sm text-dim select-none shadow-soft-card">
              🇺🇸 +1
            </span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="2025550123"
              value={phone}
              onChange={(e) => handlePhone(e.target.value)}
              autoComplete="tel-national"
              className="h-11 flex-1 rounded-r-xl border border-rim bg-white px-3 text-sm text-ink placeholder:text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition-colors duration-150 shadow-soft-card"
            />
          </div>
          <p className="text-xs text-dim">SMS alerts · Reply YES to apply</p>
        </div>

        <SearchableSelect
          label="Country"
          placeholder="Select country..."
          value={country}
          options={COUNTRIES}
          onChange={(val) => {
            onChange({ country: val, state_region: "" });
          }}
          allowFreeText
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="City"
            placeholder="San Francisco"
            value={city}
            onChange={(e) => onChange({ city: e.target.value })}
            autoComplete="address-level2"
          />
          {country === "United States" ? (
            <SearchableSelect
              label="State"
              placeholder="Select state..."
              value={state_region}
              options={STATE_OPTIONS}
              onChange={(val) => onChange({ state_region: val })}
            />
          ) : (
            <Input
              label="State / Region"
              placeholder="State / Province / Region"
              value={state_region}
              onChange={(e) => onChange({ state_region: e.target.value })}
              autoComplete="address-level1"
            />
          )}
        </div>

        {/* Divider */}
        <div className="relative flex items-center pt-2">
          <div className="flex-grow border-t border-rim" />
          <span className="mx-3 flex-shrink text-xs font-medium uppercase tracking-wider text-dim">
            Online presence (optional)
          </span>
          <div className="flex-grow border-t border-rim" />
        </div>

        <Input
          label="LinkedIn URL"
          placeholder="linkedin.com/in/yourname"
          value={linkedin_url}
          onChange={(e) => onChange({ linkedin_url: e.target.value })}
          type="url"
          autoComplete="url"
        />

        <Input
          label="Website URL"
          placeholder="yourportfolio.com"
          value={website_url}
          onChange={(e) => onChange({ website_url: e.target.value })}
          type="url"
          autoComplete="url"
        />

        <Input
          label="GitHub URL"
          placeholder="github.com/yourhandle"
          value={github_url}
          onChange={(e) => onChange({ github_url: e.target.value })}
          type="url"
          autoComplete="url"
        />
      </div>
    </div>
  );
}

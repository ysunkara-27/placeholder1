"use client";

import { Input } from "@/components/ui/input";

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
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Let&apos;s start with you
        </h1>
        <p className="text-gray-500">
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
          <label className="text-sm font-medium text-gray-700">
            Phone <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-stretch">
            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 px-3 text-sm text-gray-500 select-none">
              🇺🇸 +1
            </span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="2025550123"
              value={phone}
              onChange={(e) => handlePhone(e.target.value)}
              autoComplete="tel-national"
              className="h-10 flex-1 rounded-r-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-150"
            />
          </div>
          <p className="text-xs text-gray-400">SMS alerts · Reply YES to apply</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="City"
            placeholder="San Francisco"
            value={city}
            onChange={(e) => onChange({ city: e.target.value })}
            autoComplete="address-level2"
          />
          <Input
            label="State / Region"
            placeholder="CA"
            value={state_region}
            onChange={(e) => onChange({ state_region: e.target.value })}
            autoComplete="address-level1"
          />
        </div>

        <Input
          label="Country"
          placeholder="United States"
          value={country}
          onChange={(e) => onChange({ country: e.target.value })}
          autoComplete="country-name"
        />

        {/* Divider */}
        <div className="relative flex items-center pt-2">
          <div className="flex-grow border-t border-gray-100" />
          <span className="mx-3 flex-shrink text-xs font-medium uppercase tracking-wider text-gray-400">
            Online presence (optional)
          </span>
          <div className="flex-grow border-t border-gray-100" />
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

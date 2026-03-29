"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { POPULAR_CITIES, cn } from "@/lib/utils";
import { X, MapPin, Wifi } from "lucide-react";

interface Props {
  locations: string[];
  remoteOk: boolean;
  onChange: (locations: string[], remoteOk: boolean) => void;
}

export function StepLocations({ locations, remoteOk, onChange }: Props) {
  const [inputValue, setInputValue] = useState("");

  function addLocation(city: string) {
    const trimmed = city.trim();
    if (!trimmed || locations.includes(trimmed)) return;
    onChange([...locations, trimmed], remoteOk);
    setInputValue("");
  }

  function removeLocation(city: string) {
    onChange(
      locations.filter((l) => l !== city),
      remoteOk
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addLocation(inputValue);
    }
    if (e.key === "Backspace" && inputValue === "" && locations.length > 0) {
      removeLocation(locations[locations.length - 1]);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          Where do you want to work?
        </h1>
        <p className="text-gray-500">
          Add cities or regions. Press Enter or comma to add each.
        </p>
      </div>

      {/* Token input */}
      <div className="space-y-3">
        <div className="min-h-[44px] flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
          {locations.map((city) => (
            <span
              key={city}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-sm font-medium text-indigo-700"
            >
              <MapPin className="w-3 h-3 opacity-60" />
              {city}
              <button
                onClick={() => removeLocation(city)}
                className="ml-0.5 hover:text-indigo-900 transition-colors"
                aria-label={`Remove ${city}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => addLocation(inputValue)}
            placeholder={locations.length === 0 ? "Type a city..." : ""}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
          />
        </div>

        {/* Quick-add popular cities */}
        <div className="flex flex-wrap gap-2">
          {POPULAR_CITIES.filter((c) => !locations.includes(c)).map((city) => (
            <Badge
              key={city}
              size="sm"
              onClick={() => addLocation(city)}
            >
              + {city}
            </Badge>
          ))}
        </div>
      </div>

      {/* Remote toggle */}
      <button
        onClick={() => onChange(locations, !remoteOk)}
        className={cn(
          "flex items-center gap-3 rounded-xl border p-4 w-full text-left transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
          remoteOk
            ? "border-indigo-600 bg-indigo-50"
            : "border-gray-200 bg-white hover:border-gray-300"
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            remoteOk ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400"
          )}
        >
          <Wifi className="w-5 h-5" />
        </div>
        <div>
          <p className="font-medium text-gray-900">Open to remote</p>
          <p className="text-sm text-gray-500">
            Include fully remote positions in my matches
          </p>
        </div>
        <div
          className={cn(
            "ml-auto h-5 w-9 rounded-full transition-colors duration-200 relative shrink-0",
            remoteOk ? "bg-indigo-600" : "bg-gray-200"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200",
              remoteOk ? "left-[18px]" : "left-0.5"
            )}
          />
        </div>
      </button>
    </div>
  );
}

"use client";

export function CategoryFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  const chips = ["All", ...options];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const active = value === chip || (chip === "All" && value === "");
        return (
          <button
            key={chip}
            type="button"
            onClick={() => onChange(chip === "All" ? "" : chip)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              active
                ? "bg-violet-800 text-white"
                : "border border-violet-900/15 bg-white text-violet-900 hover:border-violet-700/40"
            }`}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

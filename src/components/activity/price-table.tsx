import { formatPrice, formatPriceUnit } from "@/lib/format";

interface PriceOption {
  id: string;
  label: string;
  price_cents: number;
  price_unit: string;
  conditions: string | null;
  confidence: string;
}

interface PriceTableProps {
  priceOptions: PriceOption[];
}

export function PriceTable({ priceOptions }: PriceTableProps) {
  if (!priceOptions || priceOptions.length === 0) {
    return (
      <div className="text-center py-6 text-ink-2">
        <p>Pricing not yet available. Check the camp website for details.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-3">
            <th className="text-left font-sans text-[10px] uppercase tracking-wide text-ink-2 pb-2 pr-4">
              Option
            </th>
            <th className="text-right font-sans text-[10px] uppercase tracking-wide text-ink-2 pb-2 pr-4">
              Price
            </th>
            <th className="text-left font-sans text-[10px] uppercase tracking-wide text-ink-2 pb-2">
              Notes
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-3/15">
          {priceOptions.map((option) => (
            <tr key={option.id}>
              <td className="py-3 pr-4 font-medium">{option.label}</td>
              <td className="py-3 pr-4 text-right">
                <span className="font-sans font-medium">
                  {formatPrice(option.price_cents)}
                </span>
                <span className="font-sans text-[10px] text-ink-2 uppercase tracking-wide ml-0.5">
                  {formatPriceUnit(option.price_unit as any)}
                </span>
              </td>
              <td className="py-3 text-ink-2 text-xs">
                {option.conditions ?? "—"}
                {option.confidence === "llm_extracted" && (
                  <span className="ml-2 font-sans text-[9px] uppercase tracking-wide text-ink bg-hero-light px-1.5 py-0.5 rounded">
                    Verify on website
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

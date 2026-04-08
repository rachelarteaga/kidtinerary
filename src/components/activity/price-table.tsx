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
      <div className="text-center py-6 text-stone">
        <p>Pricing not yet available. Check the camp website for details.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-driftwood/30">
            <th className="text-left font-mono text-[10px] uppercase tracking-wide text-stone pb-2 pr-4">
              Option
            </th>
            <th className="text-right font-mono text-[10px] uppercase tracking-wide text-stone pb-2 pr-4">
              Price
            </th>
            <th className="text-left font-mono text-[10px] uppercase tracking-wide text-stone pb-2">
              Notes
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-driftwood/15">
          {priceOptions.map((option) => (
            <tr key={option.id}>
              <td className="py-3 pr-4 font-medium">{option.label}</td>
              <td className="py-3 pr-4 text-right">
                <span className="font-mono font-medium">
                  {formatPrice(option.price_cents)}
                </span>
                <span className="font-mono text-[10px] text-stone uppercase tracking-wide ml-0.5">
                  {formatPriceUnit(option.price_unit as any)}
                </span>
              </td>
              <td className="py-3 text-stone text-xs">
                {option.conditions ?? "—"}
                {option.confidence === "llm_extracted" && (
                  <span className="ml-2 font-mono text-[9px] uppercase tracking-wide text-campfire bg-sand/50 px-1.5 py-0.5 rounded">
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

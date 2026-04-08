import type { Category, PriceUnit, TimeSlot, IndoorOutdoor } from "@/lib/constants";

export interface ScrapedPrice {
  label: string;                      // e.g. "Standard", "Early Bird"
  priceString: string;                // raw string: "$250", "250.00"
  priceUnit: PriceUnit;
  conditions?: string;                // e.g. "Register before May 1"
  validFrom?: string;                 // ISO date string
  validUntil?: string;                // ISO date string
}

export interface ScrapedSession {
  startsAt: string;                   // ISO date string, e.g. "2025-06-16"
  endsAt: string;                     // ISO date string, e.g. "2025-06-20"
  timeSlot: TimeSlot;
  hoursStart?: string;                // e.g. "09:00"
  hoursEnd?: string;                  // e.g. "15:00"
  spotsAvailable?: number;
  isSoldOut: boolean;
  locationAddress?: string;           // if session has its own location
  locationName?: string;
  prices?: ScrapedPrice[];            // prices specific to this session
}

export interface ScrapedActivity {
  name: string;
  description?: string;
  organizationName: string;
  organizationWebsite?: string;
  registrationUrl?: string;
  sourceUrl: string;
  address: string;                    // primary location address
  locationName?: string;              // e.g. "North Raleigh Campus"
  indoorOutdoor: IndoorOutdoor;
  ageText?: string;                   // raw text, e.g. "Ages 6-12" — normalized later
  categories?: Category[];            // optional: adapter can supply, else assigned by normalize
  sessions: ScrapedSession[];
  prices: ScrapedPrice[];             // activity-level prices (apply to all sessions)
}

export interface AdapterResult {
  activities: ScrapedActivity[];
  sourceUrl: string;
  scrapedAt: string;                  // ISO timestamp
  errors: string[];
}

export interface Adapter {
  name: string;
  sourceUrl: string;
  fetch(): Promise<AdapterResult>;
}

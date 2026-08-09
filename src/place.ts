import tzLookup from "tz-lookup";

export interface ResolvedPlace {
  id: string;
  query: string;
  displayName: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  timeZone: string;
  source: string;
}

export interface PlaceResolver {
  resolve(query: string, limit?: number): Promise<ResolvedPlace[]>;
}

interface NominatimResult {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
  address?: { country_code?: string };
}

export interface NominatimPlaceResolverOptions {
  applicationId: string;
  contactEmail?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export class NominatimPlaceResolver implements PlaceResolver {
  private readonly endpoint: string;
  private readonly applicationId: string;
  private readonly contactEmail: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly cache = new Map<string, ResolvedPlace[]>();

  constructor(options: NominatimPlaceResolverOptions) {
    if (!options.applicationId.trim()) {
      throw new Error("Nominatim requires a descriptive applicationId.");
    }
    this.applicationId = options.applicationId;
    this.contactEmail = options.contactEmail;
    this.endpoint = options.endpoint ?? "https://nominatim.openstreetmap.org/search";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async resolve(query: string, limit = 5): Promise<ResolvedPlace[]> {
    const normalized = query.trim();
    if (normalized.length < 2) throw new RangeError("Place query is too short.");
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      throw new RangeError("Place result limit must be an integer from 1 to 10.");
    }
    const cacheKey = `${normalized.toLocaleLowerCase()}:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const url = new URL(this.endpoint);
    url.searchParams.set("q", normalized);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("accept-language", "zh-CN,zh,en");
    if (this.contactEmail) url.searchParams.set("email", this.contactEmail);

    const response = await this.fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": this.applicationId,
      },
    });
    if (!response.ok) {
      throw new Error(`Place resolution failed with HTTP ${response.status}.`);
    }
    const payload = (await response.json()) as NominatimResult[];
    const results = payload.map((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Place provider returned invalid coordinates.");
      }
      return {
        id: String(item.place_id),
        query: normalized,
        displayName: item.display_name,
        countryCode: item.address?.country_code?.toUpperCase() ?? null,
        latitude,
        longitude,
        timeZone: tzLookup(latitude, longitude),
        source: "openstreetmap-nominatim",
      };
    });
    this.cache.set(cacheKey, results);
    return results;
  }
}

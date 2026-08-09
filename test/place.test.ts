import { describe, expect, it, vi } from "vitest";
import { NominatimPlaceResolver } from "../src/index.js";

describe("NominatimPlaceResolver", () => {
  it("maps provider coordinates to an IANA timezone", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            place_id: 123,
            display_name: "上海市, 中国",
            lat: "31.2304",
            lon: "121.4737",
            address: { country_code: "cn", state: "上海市", city: "上海市", city_district: "黄浦区" },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const resolver = new NominatimPlaceResolver({
      applicationId: "bazi-relationship-test/0.1",
      fetchImpl,
    });

    const results = await resolver.resolve("上海");

    expect(results[0]).toMatchObject({
      latitude: 31.2304,
      longitude: 121.4737,
      timeZone: "Asia/Shanghai",
      countryCode: "CN",
      province: "上海市",
      city: "上海市",
      district: "黄浦区",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const calledUrl = fetchImpl.mock.calls[0]?.[0];
    expect(String(calledUrl)).toContain("addressdetails=1");
  });

  it("caches identical searches", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const resolver = new NominatimPlaceResolver({ applicationId: "test/0.1", fetchImpl });
    await resolver.resolve("Beijing");
    await resolver.resolve("Beijing");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects ambiguous empty queries before making a request", async () => {
    const resolver = new NominatimPlaceResolver({ applicationId: "test/0.1" });
    await expect(resolver.resolve(" ")).rejects.toThrow(RangeError);
  });
});

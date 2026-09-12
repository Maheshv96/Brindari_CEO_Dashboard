import { NextResponse } from "next/server";

const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const BASE = "https://graph.facebook.com/v19.0";

export async function GET() {
  if (!PAGE_ID || !TOKEN) {
    return NextResponse.json({ connected: false });
  }

  try {
    const [pageRes, eventsRes] = await Promise.all([
      fetch(
        `${BASE}/${PAGE_ID}?fields=name,fan_count,followers_count&access_token=${TOKEN}`
      ),
      fetch(
        `${BASE}/${PAGE_ID}/events` +
        `?fields=id,name,description,start_time,end_time,place,attending_count,interested_count,cover` +
        `&time_filter=upcoming&limit=20&access_token=${TOKEN}`
      ),
    ]);

    if (!pageRes.ok) {
      const err = await pageRes.json();
      return NextResponse.json({ connected: false, error: err?.error?.message ?? "Auth failed" });
    }

    const [page, eventsData] = await Promise.all([
      pageRes.json(),
      eventsRes.json(),
    ]);

    const events = (eventsData.data ?? []).map((e: {
      id: string;
      name: string;
      description?: string;
      start_time: string;
      end_time?: string;
      attending_count?: number;
      interested_count?: number;
      place?: { name?: string; location?: { city?: string; country?: string } };
      cover?: { source?: string };
    }) => ({
      id: e.id,
      name: e.name,
      description: e.description ?? "",
      startTime: e.start_time,
      endTime: e.end_time ?? null,
      attending: e.attending_count ?? 0,
      interested: e.interested_count ?? 0,
      place: e.place?.name ?? e.place?.location?.city ?? null,
      coverUrl: e.cover?.source ?? null,
    }));

    return NextResponse.json({
      connected: true,
      page: {
        name: page.name,
        followers: page.followers_count ?? page.fan_count ?? 0,
        fans: page.fan_count ?? 0,
      },
      events,
      syncedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ connected: false, error: "Fetch failed" });
  }
}

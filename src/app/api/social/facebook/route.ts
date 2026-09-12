import { NextResponse } from "next/server";

const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const BASE = "https://graph.facebook.com/v19.0";

export async function GET() {
  if (!PAGE_ID || !TOKEN) {
    return NextResponse.json({ connected: false });
  }

  try {
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const until = Math.floor(Date.now() / 1000);

    const [pageRes, postsRes, insightsRes] = await Promise.all([
      fetch(`${BASE}/${PAGE_ID}?fields=name,fan_count,followers_count&access_token=${TOKEN}`),
      fetch(`${BASE}/${PAGE_ID}/posts?fields=id,message,story,created_time,likes.summary(true),comments.summary(true),shares&limit=20&access_token=${TOKEN}`),
      fetch(`${BASE}/${PAGE_ID}/insights?metric=page_impressions_unique,page_post_engagements,page_fan_adds_unique&period=day&since=${since}&until=${until}&access_token=${TOKEN}`),
    ]);

    if (!pageRes.ok) {
      const err = await pageRes.json();
      return NextResponse.json({ connected: false, error: err?.error?.message ?? "Auth failed" });
    }

    const [page, postsData, insightsData] = await Promise.all([
      pageRes.json(),
      postsRes.json(),
      insightsRes.json(),
    ]);

    const sumMetric = (name: string) =>
      (insightsData.data ?? [])
        .find((d: { name: string }) => d.name === name)
        ?.values?.reduce((acc: number, v: { value: number }) => acc + (v.value ?? 0), 0) ?? 0;

    return NextResponse.json({
      connected: true,
      page: {
        name: page.name,
        followers: page.followers_count ?? page.fan_count ?? 0,
        fans: page.fan_count ?? 0,
      },
      posts: (postsData.data ?? []).map((p: {
        id: string; message?: string; story?: string;
        created_time: string;
        likes?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number } };
        shares?: { count?: number };
      }) => ({
        id: p.id,
        message: p.message ?? p.story ?? "",
        createdAt: p.created_time,
        likes: p.likes?.summary?.total_count ?? 0,
        comments: p.comments?.summary?.total_count ?? 0,
        shares: p.shares?.count ?? 0,
      })),
      insights: {
        monthlyReach: sumMetric("page_impressions_unique"),
        engagements: sumMetric("page_post_engagements"),
        newFans: sumMetric("page_fan_adds_unique"),
      },
      syncedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ connected: false, error: "Fetch failed" });
  }
}

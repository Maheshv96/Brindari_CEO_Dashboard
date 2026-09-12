import { NextResponse } from "next/server";

const ORG_ID = process.env.LINKEDIN_ORG_ID;
const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const BASE = "https://api.linkedin.com/v2";

export async function GET() {
  if (!ORG_ID || !TOKEN) {
    return NextResponse.json({ connected: false });
  }

  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": "202401",
  };

  try {
    const orgUrn = encodeURIComponent(`urn:li:organization:${ORG_ID}`);
    const start = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const [statsRes, followersRes, postsRes] = await Promise.all([
      fetch(
        `${BASE}/organizationPageStatistics?q=organization&organization=urn:li:organization:${ORG_ID}` +
        `&timeIntervals.timeGranularityType=MONTH&timeIntervals.timeRange.start=${start}&timeIntervals.timeRange.end=${Date.now()}`,
        { headers }
      ),
      fetch(`${BASE}/networkSizes/${orgUrn}?edgeType=CompanyFollowedByMember`, { headers }),
      fetch(
        `${BASE}/shares?q=owners&owners=urn:li:organization:${ORG_ID}&count=10&sharesPerOwner=10`,
        { headers }
      ),
    ]);

    if (!followersRes.ok) {
      const err = await followersRes.json();
      return NextResponse.json({ connected: false, error: err?.message ?? "Auth failed" });
    }

    const [stats, followers, posts] = await Promise.all([
      statsRes.json(),
      followersRes.json(),
      postsRes.json(),
    ]);

    const elements: Array<{
      totalPageStatistics?: {
        views?: { allPageViews?: { pageViews?: number; uniquePageViews?: number } };
        clicks?: { allPageClicks?: { organicClicks?: number } };
      };
    }> = stats.elements ?? [];

    const totalViews = elements.reduce(
      (sum, e) => sum + (e.totalPageStatistics?.views?.allPageViews?.pageViews ?? 0), 0
    );
    const uniqueViews = elements.reduce(
      (sum, e) => sum + (e.totalPageStatistics?.views?.allPageViews?.uniquePageViews ?? 0), 0
    );
    const clicks = elements.reduce(
      (sum, e) => sum + (e.totalPageStatistics?.clicks?.allPageClicks?.organicClicks ?? 0), 0
    );

    return NextResponse.json({
      connected: true,
      page: {
        followers: followers.firstDegreeSize ?? 0,
      },
      posts: (posts.elements ?? []).map((p: {
        id: string;
        text?: { text?: string };
        created?: { time?: number };
        totalShareStatistics?: { likeCount?: number; commentCount?: number; shareCount?: number; impressionCount?: number };
      }) => ({
        id: p.id,
        message: p.text?.text ?? "",
        createdAt: p.created?.time ? new Date(p.created.time).toISOString() : null,
        likes: p.totalShareStatistics?.likeCount ?? 0,
        comments: p.totalShareStatistics?.commentCount ?? 0,
        shares: p.totalShareStatistics?.shareCount ?? 0,
        impressions: p.totalShareStatistics?.impressionCount ?? 0,
      })),
      insights: {
        pageViews: totalViews,
        uniqueVisitors: uniqueViews,
        clicks,
      },
      syncedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ connected: false, error: "Fetch failed" });
  }
}

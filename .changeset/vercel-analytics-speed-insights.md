---
"@solignition/frontend": minor
"@solignition/landing": minor
"@solignition/docs": minor
---

Add Vercel Web Analytics to the frontend, landing, and docs, plus Speed Insights on the frontend.

All three apps mount `<Analytics />` (`@vercel/analytics/react`) at their root; the frontend
also mounts `<SpeedInsights />` (`@vercel/speed-insights/react`). This is cookieless,
privacy-friendly page view / visitor tracking plus Core Web Vitals — no env vars and no
consent banner. The beacons only fire in production on Vercel; local dev is a no-op. Speed
Insights is frontend-only because the free Vercel plan scopes it to a single project; Web
Analytics and Speed Insights still need to be enabled per project in the Vercel dashboard
for collection to start.

import type { NextConfig } from "next"

// Browser protections on every page
const securityHeaders = [
  // Other sites can't show Tomesie in a frame and trick users into clicking (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Files are only handled as the type the server declares
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites only learn that a visitor came from tomesie.com, not which page
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera kept for the site itself (barcode scanning); microphone and location off
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Never indexed, even if a link to it leaks (the page also has a noindex meta tag)
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/admin", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "books.google.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
}

export default nextConfig

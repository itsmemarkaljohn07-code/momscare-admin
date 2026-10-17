import type { NextConfig } from "next";

// Basic security headers on every response. No Content-Security-Policy on
// purpose: a strict one would have to allow-list Firebase and Cloudinary.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Requests moved to a tab of the Appointments page; old links keep working.
  async redirects() {
    return [{ source: "/admin/requests", destination: "/admin/appointments?tab=requests", permanent: false }];
  },
};

export default nextConfig;

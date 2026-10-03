/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Files uploaded through server actions (the «الملفات» page). Vercel caps
    // request bodies at 4.5 MB, so larger files must go straight to storage.
    serverActions: { bodySizeLimit: "4mb" },
    // The CP AoR 5Ws template is read from disk by the export route; make sure
    // Vercel ships it with that function.
    outputFileTracingIncludes: {
      "/api/reports/5w-excel": ["./src/lib/fivew/cpaor-5ws-template.xlsm"],
    },
  },
};

export default nextConfig;

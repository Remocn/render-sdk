import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Client tab has no index page — land on the first framework guide.
      {
        source: "/docs/client",
        destination: "/docs/client/nextjs",
        permanent: false,
      },
    ];
  },
};

export default withMDX(config);

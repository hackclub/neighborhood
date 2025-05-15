import createMDX from "@next/mdx";

const withMDX = createMDX({
	extension: /\.(md|mdx)$/,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
	pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],

	reactStrictMode: true,
	devIndicators: false,
	output: "standalone",
	// Ensure images from your domain are allowed
	images: {
		domains: ["neighborhood.hackclub.com"],
	},
};

export default withMDX(nextConfig);

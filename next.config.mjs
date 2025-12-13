/** @type {import('next').NextConfig} */
const nextConfig = {
    // output: 'standalone', // Disabled for Windows local build compatibility (fixes EINVAL with colons in filenames)
    // eslint: { ignoreDuringBuilds: true }, // Deprecated in Next 15+
    typescript: {
        ignoreBuildErrors: true,
    }
};

export default nextConfig;

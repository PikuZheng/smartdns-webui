/** @type {import('next').NextConfig} */
const devConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://127.0.0.1:6080/api/:path*'
            }
        ];
    }
};

const prodConfig = {
    output: 'export',
};

const config = process.env.NODE_ENV === 'production' ? prodConfig : devConfig;
config.typedRoutes = false;

export default config;
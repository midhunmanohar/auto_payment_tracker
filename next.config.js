// next.config.js inside your frontend folder
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // Proxies the request to the backend container natively
        destination: 'http://backend:3000/:path*', 
      },
    ]
  },
}

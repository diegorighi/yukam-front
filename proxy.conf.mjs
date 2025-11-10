export default [
  {
    context: ['/api/clientes'],
    target: 'http://localhost:8081',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug'
  },
  {
    context: ['/api'],
    target: 'http://localhost:8182',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug'
  }
];

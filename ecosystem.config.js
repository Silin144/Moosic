module.exports = {
  apps: [{
    name: 'moosic-backend',
    script: 'server.py',
    interpreter: 'python3',
    env: {
      NODE_ENV: 'production',
      ENVIRONMENT: 'production'
    }
  }]
} 
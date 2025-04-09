module.exports = {
  apps: [{
    name: 'moosic-backend',
    script: 'gunicorn',
    args: '--bind 0.0.0.0:3001 server:app',
    interpreter: 'python3',
    env: {
      PYTHONPATH: '/opt/moosic',
      VIRTUAL_ENV: '/opt/moosic/venv',
      PATH: '/opt/moosic/venv/bin:$PATH'
    },
    cwd: '/opt/moosic',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
} 
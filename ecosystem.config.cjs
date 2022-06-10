module.exports = {
  apps : [{
    name: 'meli-proxy',
    script: 'index.js',
    exec_mode : "cluster",
    instances: 4,
    watch: '.',
    env: {
      NODE_ENV: 'development'
    },
    log_date_format: 'YYYY-MM-DD HH:mm',
  }],

  deploy : {
    production : {
      user : 'SSH_USERNAME',
      host : 'SSH_HOSTMACHINE',
      ref  : 'origin/master',
      repo : 'GIT_REPOSITORY',
      path : 'DESTINATION_PATH',
      'pre-deploy-local': '',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': ''
    }
  }
};

module.exports = function (shipit) {
  require('shipit-deploy')(shipit);

  const config = require('./config.json');
  const currentPath = `${config.deploy.path}/current`;

  shipit.initConfig({
    default: {
      workspace: 'tmp',
      deployTo: config.deploy.path,
      repositoryUrl: config.deploy.repository_url,
      ignores: ['.git', 'node_modules'],
      rsync: ['--del'],
      keepReleases: 2,
      key: '~/.ssh/id_rsa',
      shallowClone: true,
    },
    production: {
      servers: `${config.deploy.username}@${config.deploy.hostname}`,
    },
  });

  shipit.blTask('yarn_install', () => {
    return shipit.remote(`cd ${currentPath} && yarn install &> /dev/null`);
  });

  shipit.blTask('install_config', function () {
    shipit.remoteCopy('config.json', currentPath);
  });

  /* ---- */

  shipit.on('deployed', () => {
    shipit.start('yarn_install', 'install_config');
  });
};

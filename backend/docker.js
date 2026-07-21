const Docker = require('dockerode');

function getDockerInstance() {
  const host = process.env.DOCKER_HOST;
  const socketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock';

  if (host) {
    // Connect via TCP socket e.g. tcp://192.168.1.50:2375 or http://192.168.1.50:2375
    const cleanHost = host.replace(/^tcp:\/\//, '').replace(/^http:\/\//, '');
    const [hostname, port] = cleanHost.split(':');
    return new Docker({
      host: hostname,
      port: parseInt(port) || 2375,
    });
  }

  // Default: connect via Unix domain socket
  return new Docker({ socketPath });
}

module.exports = getDockerInstance();

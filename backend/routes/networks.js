const express = require('express');
const router = express.Router();
const docker = require('../docker');

// List networks
router.get('/', async (req, res) => {
  const networks = await docker.listNetworks();
  res.json(networks);
});

// Inspect network
router.get('/:id/inspect', async (req, res) => {
  const network = docker.getNetwork(req.params.id);
  const info = await network.inspect();
  res.json(info);
});

// Create network
router.post('/', async (req, res) => {
  const {
    name,
    driver = 'bridge',
    subnet,
    gateway,
    internal = false,
    attachable = true,
    labels = {},
    options = {},
  } = req.body;

  const ipamConfig = [];
  if (subnet) {
    const cfg = { Subnet: subnet };
    if (gateway) cfg.Gateway = gateway;
    ipamConfig.push(cfg);
  }

  const createOpts = {
    Name: name,
    Driver: driver,
    Internal: internal,
    Attachable: attachable,
    Labels: labels,
    Options: options,
    IPAM: ipamConfig.length ? { Config: ipamConfig } : undefined,
  };

  const network = await docker.createNetwork(createOpts);
  res.json({ success: true, id: network.id });
});

// Remove network
router.delete('/:id', async (req, res) => {
  const network = docker.getNetwork(req.params.id);
  await network.remove();
  res.json({ success: true });
});

// Connect container to network
router.post('/:id/connect', async (req, res) => {
  const network = docker.getNetwork(req.params.id);
  const { container, aliases = [] } = req.body;
  await network.connect({ Container: container, EndpointConfig: { Aliases: aliases } });
  res.json({ success: true });
});

// Disconnect container from network
router.post('/:id/disconnect', async (req, res) => {
  const network = docker.getNetwork(req.params.id);
  const { container, force = false } = req.body;
  await network.disconnect({ Container: container, Force: force });
  res.json({ success: true });
});

// Prune unused networks
router.post('/prune', async (req, res) => {
  const result = await docker.pruneNetworks();
  res.json(result);
});

module.exports = router;

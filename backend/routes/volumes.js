const express = require('express');
const router = express.Router();
const docker = require('../docker');

// List volumes
router.get('/', async (req, res) => {
  const result = await docker.listVolumes();
  res.json(result.Volumes || []);
});

// Inspect volume
router.get('/:name/inspect', async (req, res) => {
  const volume = docker.getVolume(req.params.name);
  const info = await volume.inspect();
  res.json(info);
});

// Create volume
router.post('/', async (req, res) => {
  const {
    name,
    driver = 'local',
    driverOpts = {},
    labels = {},
  } = req.body;

  const volume = await docker.createVolume({
    Name: name,
    Driver: driver,
    DriverOpts: driverOpts,
    Labels: labels,
  });
  res.json({ success: true, name: volume.name });
});

// Remove volume
router.delete('/:name', async (req, res) => {
  const volume = docker.getVolume(req.params.name);
  const force = req.query.force === 'true';
  await volume.remove({ force });
  res.json({ success: true });
});

// Prune unused volumes
router.post('/prune', async (req, res) => {
  const result = await docker.pruneVolumes();
  res.json(result);
});

module.exports = router;

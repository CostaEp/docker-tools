const express = require('express');
const router = express.Router();
const docker = require('../docker');

// List images
router.get('/', async (req, res) => {
  const images = await docker.listImages({ all: req.query.all === 'true' });
  res.json(images);
});

// Inspect image
router.get('/:id/inspect', async (req, res) => {
  const image = docker.getImage(req.params.id);
  const info = await image.inspect();
  res.json(info);
});

// Image history
router.get('/:id/history', async (req, res) => {
  const image = docker.getImage(req.params.id);
  const history = await image.history();
  res.json(history);
});

// Remove image
router.delete('/:id', async (req, res) => {
  const image = docker.getImage(req.params.id);
  const force = req.query.force === 'true';
  const noprune = req.query.noprune === 'true';
  await image.remove({ force, noprune });
  res.json({ success: true });
});

// Tag image
router.post('/:id/tag', async (req, res) => {
  const image = docker.getImage(req.params.id);
  const { repo, tag } = req.body;
  await image.tag({ repo, tag });
  res.json({ success: true });
});

// Prune unused images
router.post('/prune', async (req, res) => {
  const result = await docker.pruneImages();
  res.json(result);
});

// Search Docker Hub
router.get('/search/:term', async (req, res) => {
  const results = await docker.searchImages({ term: req.params.term, limit: 25 });
  res.json(results);
});

// Pull image with progress via SSE
router.post('/pull', async (req, res) => {
  const { image, tag = 'latest', authconfig } = req.body;
  const imageRef = `${image}:${tag}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    await new Promise((resolve, reject) => {
      const opts = authconfig ? { authconfig } : {};
      docker.pull(imageRef, opts, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(
          stream,
          (err, output) => {
            if (err) {
              res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
              reject(err);
            } else {
              res.write(`data: ${JSON.stringify({ done: true, image: imageRef })}\n\n`);
              resolve(output);
            }
          },
          (event) => {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        );
      });
    });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

module.exports = router;

import fetch from 'node-fetch';
import express from 'express';
import redis from 'redis';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { createProxyMiddleware } from 'http-proxy-middleware';

// Create Express Server
const app = express();

// Reddis client
const client = redis.createClient({
  url: 'redis://default:redispw@localhost:55000' // should be ENV
});

await client.connect()

client.on("error", (error) => {
  console.error(`Redis error: ${error}`);
});

const allowlist = ['192.168.0.56', '192.168.0.21', '127.0.0.1'];

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 1 minutes
  max: 100000, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  //skip: (request, response) => allowlist.includes(request.ip)
})

// Apply the rate limiting middleware to all requests
app.use(limiter);

// Logging
app.use(morgan('dev'));

const API_SERVICE_URL = "https://pokeapi.co/";

//Request Proxy
const fetchPokemon = async (req, res, next) => {
  try {
    const { idAnimal } = req.params;

    const response = await fetch(`${API_SERVICE_URL}api/v2/pokemon/${idAnimal}`);

    const { status, ok } = response;

    console.log(ok)

    if(status === 404) {
      res.status(404);
    } else {
      const dataResponse = await response.json();
      const pokeInfo = {
        name: dataResponse.name,
        abilities: dataResponse.abilities
      }
      await client.setEx(idAnimal, 3600, JSON.stringify(pokeInfo)); // with expire seconds
      res.json(pokeInfo);
    }
  } catch (err) {
    console.error(`FetchPokemon ERROR: ${err}`);
    res.status(500);
  }
}

// Request Cache Proxy
const fetchCachePokemon = async (req, res, next) => {
  try {
    const { idAnimal } = req.params;

    const value = await client.get(idAnimal);
    if (value !== null) {
      const response = JSON.parse(value);
      res.json(response);
    } else {
      next();
    }
  } catch (err) {
    console.error(`fetchCachePokemon ERROR: ${err}`);
    res.status(500);
  }
}

app.get('/poke/:idAnimal', fetchCachePokemon, fetchPokemon);

// Info GET endpoint
app.get('/info', (req, res, next) => {
  res.send('This is a proxy service.');
});

// Authorization
app.use('', (req, res, next) => {
  if (req.headers.authorization) {
    next();
  } else {
    res.sendStatus(403);
  }
});

// Simple direct proxy endpoint
app.use('/api', createProxyMiddleware({
  target: API_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/animals': '/api/v2/pokemon',
  },
}));


// Configuration
const PORT = 3001;
const HOST = "localhost";
// Start the Proxy
app.listen(PORT, HOST, () => {
  console.log(`Starting Proxy at ${HOST}:${PORT}`);
});

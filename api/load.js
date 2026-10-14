import dns from 'dns';
import { MongoClient } from 'mongodb';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const uri = process.env.MONGODB_URI;
let cachedClient = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  if (!uri) throw new Error('MONGODB_URI environment variable is not defined');
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  // Enable CORS headers for internal API calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await getClient();
    const db = client.db('the_craft');
    const collection = db.collection('projects');

    const userId = req.query.userId || req.headers['x-user-id'];
    const projectType = req.query.type || 'drawing';

    let project = null;

    if (userId && userId !== 'anonymous') {
      // 1. Try user-specific project ID
      project = await collection.findOne({ projectId: `${userId}_${projectType}` });
      // 2. Try secondary match by userId and type
      if (!project) {
        project = await collection.findOne({ userId, type: projectType });
      }
    } else {
      // Guest / Anonymous fallback
      project = await collection.findOne({ projectId: 'latest_session' });
    }

    if (!project) {
      return res.status(404).json({ error: 'No project found in cloud storage' });
    }

    return res.status(200).json(project);
  } catch (error) {
    console.error('MongoDB load error:', error);
    return res.status(500).json({ error: error.message });
  }
}

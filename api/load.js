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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await getClient();
    const db = client.db('the_craft');
    const collection = db.collection('projects');

    const project = await collection.findOne({ projectId: 'latest_session' });
    if (!project) {
      return res.status(404).json({ error: 'No project found in MongoDB' });
    }

    return res.status(200).json(project);
  } catch (error) {
    console.error('MongoDB load error:', error);
    return res.status(500).json({ error: error.message });
  }
}

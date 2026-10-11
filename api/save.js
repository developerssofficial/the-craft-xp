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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await getClient();
    const db = client.db('the_craft');
    const collection = db.collection('projects');

    const projectData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await collection.updateOne(
      { projectId: 'latest_session' },
      { $set: { ...projectData, projectId: 'latest_session', updatedAt: new Date() } },
      { upsert: true }
    );

    return res.status(200).json({ success: true, message: 'Saved to MongoDB Atlas' });
  } catch (error) {
    console.error('MongoDB save error:', error);
    return res.status(500).json({ error: error.message });
  }
}

import dns from 'dns';
import { MongoClient } from 'mongodb';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb'
    }
  }
};

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await getClient();
    const db = client.db('the_craft');
    const collection = db.collection('projects');

    const projectData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userId = projectData.userId || req.headers['x-user-id'] || req.query.userId || 'anonymous';
    const projectType = projectData.type || req.query.type || 'drawing';
    const projectId = (userId && userId !== 'anonymous') ? `${userId}_${projectType}` : 'latest_session';

    const now = new Date();
    await collection.updateOne(
      { projectId },
      { 
        $set: { 
          ...projectData, 
          userId, 
          type: projectType, 
          projectId, 
          updatedAt: now 
        } 
      },
      { upsert: true }
    );

    return res.status(200).json({ 
      success: true, 
      message: 'Saved to cloud successfully', 
      projectId,
      timestamp: now.getTime()
    });
  } catch (error) {
    console.error('MongoDB save error:', error);
    return res.status(500).json({ error: error.message });
  }
}

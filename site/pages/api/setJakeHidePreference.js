import Airtable from 'airtable';

// Initialize Airtable
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

const tokenRegex = /^[A-Za-z0-9_-]{10,}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { token, hideJakeTheDog } = req.body;

  if (!token || hideJakeTheDog === undefined) {
    return res.status(400).json({ message: 'Token and hideJakeTheDog are required' });
  }

  if(!tokenRegex.test(token)) {
    return res.status(400).json({ message: 'Invalid token format' });
  }

  try {
    // Find the user by token
    const records = await base("neighbors")
      .select({
        filterByFormula: `{token} = '${token}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userId = records[0].id;

    // Update the user's hideJakeTheDog preference
    await base("neighbors").update([
      {
        id: userId,
        fields: {
          'hideJakeTheDog': hideJakeTheDog
        }
      }
    ]);

    return res.status(200).json({ 
      message: 'Jake the Dog preference updated successfully',
      hideJakeTheDog
    });
  } catch (error) {
    console.error('Airtable Error:', error);
    return res.status(500).json({
      message: 'Error updating Jake the Dog preference',
      error: error.message
    });
  }
} 
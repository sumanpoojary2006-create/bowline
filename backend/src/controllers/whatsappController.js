import { handleIncomingMessage } from '../services/whatsappFlow.js';
import WhatsAppContact from '../models/WhatsAppContact.js';

export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }

  res.sendStatus(403);
};

export const receiveWebhook = async (req, res) => {
  const entry = req.body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) {
    res.sendStatus(200);
    return;
  }

  const from = message.from;
  const profileName = value?.contacts?.[0]?.profile?.name;

  console.log(`[WA] incoming from=${from} type=${message.type}`);

  // Fire-and-forget: log every unique contact permanently. Never let a
  // logging failure block the actual bot reply.
  WhatsAppContact.updateOne(
    { phone: from },
    {
      $set: { lastSeenAt: new Date(), ...(profileName ? { profileName } : {}) },
      $setOnInsert: { firstSeenAt: new Date() },
      $inc: { messageCount: 1 },
    },
    { upsert: true }
  ).catch((error) => console.error('[WA] contact log failed:', error?.message));

  try {
    await handleIncomingMessage(from, message, profileName);
    console.log(`[WA] done from=${from}`);
  } catch (error) {
    console.error('[WA] error:', error);
  }

  res.sendStatus(200);
};

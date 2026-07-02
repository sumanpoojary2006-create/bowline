import { handleIncomingMessage } from '../services/whatsappFlow.js';

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

  try {
    await handleIncomingMessage(from, message, profileName);
    console.log(`[WA] done from=${from}`);
  } catch (error) {
    console.error('[WA] error:', error);
  }

  res.sendStatus(200);
};

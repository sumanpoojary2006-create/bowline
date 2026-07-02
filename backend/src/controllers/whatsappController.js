import { waitUntil } from '@vercel/functions';
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

export const receiveWebhook = (req, res) => {
  // Respond to Meta immediately — must be within a few seconds or Meta retries
  res.sendStatus(200);

  const entry = req.body?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) return;

  const from = message.from;
  const profileName = value?.contacts?.[0]?.profile?.name;

  waitUntil(
    handleIncomingMessage(from, message, profileName).catch((error) => {
      console.error('Error handling WhatsApp webhook:', error);
    })
  );
};

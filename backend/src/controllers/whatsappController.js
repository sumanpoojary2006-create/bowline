import { sendText } from '../utils/whatsapp.js';

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

export const receiveWebhook = async (req, res, next) => {
  try {
    res.sendStatus(200);

    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return;
    }

    const from = message.from;
    const text =
      message.text?.body ||
      message.interactive?.button_reply?.title ||
      message.interactive?.list_reply?.title ||
      '';

    await sendText(from, `Echo: ${text}`);
  } catch (error) {
    next(error);
  }
};

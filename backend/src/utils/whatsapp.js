function getApiBase() {
  const version = process.env.WHATSAPP_API_VERSION || 'v20.0';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  return `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
}

export function isWhatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function sendMessage(payload) {
  if (!isWhatsAppConfigured()) {
    throw new Error('WhatsApp is not configured');
  }

  const response = await fetch(getApiBase(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Unable to send WhatsApp message');
  }

  return data;
}

export function sendText(to, body) {
  return sendMessage({
    to,
    type: 'text',
    text: { body, preview_url: false },
  });
}

export function sendButtons(to, bodyText, buttons) {
  return sendMessage({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map(({ id, title }) => ({
          type: 'reply',
          reply: { id, title },
        })),
      },
    },
  });
}

export function sendList(to, { header, bodyText, buttonText, sections }) {
  return sendMessage({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(header ? { header: { type: 'text', text: header } } : {}),
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections,
      },
    },
  });
}

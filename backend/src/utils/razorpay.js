const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

function getAuthHeader() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) return null;

  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function createRazorpayOrder({ amount, currency = 'INR', receipt, notes }) {
  const authHeader = getAuthHeader();

  if (!authHeader) {
    throw new Error('Razorpay is not configured');
  }

  const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({ amount, currency, receipt, notes }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.description || 'Unable to create Razorpay order');
  }

  return data;
}

export async function createPaymentLink({ amount, currency = 'INR', description, customer, notes, callback_url }) {
  const authHeader = getAuthHeader();

  if (!authHeader) {
    throw new Error('Razorpay is not configured');
  }

  const response = await fetch(`${RAZORPAY_API_BASE}/payment_links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      amount,
      currency,
      description,
      customer,
      notify: { sms: true, email: false },
      reminder_enable: true,
      notes,
      ...(callback_url ? { callback_url, callback_method: 'get' } : {}),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.description || 'Unable to create payment link');
  }

  return data;
}

export async function createRazorpayRefund({ paymentId, amount, notes }) {
  const authHeader = getAuthHeader();

  if (!authHeader) {
    throw new Error('Razorpay is not configured');
  }

  const response = await fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({ amount, notes }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.description || 'Unable to create refund');
  }

  return data;
}

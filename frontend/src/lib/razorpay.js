import api from './api';

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function payRescheduleFee({ bookingId, contact, startDate, endDate }) {
  const loaded = await loadRazorpayScript();

  if (!loaded) {
    throw new Error('Unable to load payment gateway');
  }

  const { data } = await api.post(`/bookings/${bookingId}/reschedule/fee-order`, {
    contact,
    startDate,
    endDate,
  });

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      order_id: data.orderId,
      name: 'Bowline Nature Stay',
      description: 'Reschedule fee',
      prefill: {
        contact: contact || '',
      },
      theme: { color: '#a3e635' },
      handler: async (response) => {
        try {
          const { data: confirmData } = await api.patch(`/bookings/${bookingId}/reschedule`, {
            contact,
            startDate,
            endDate,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          resolve(confirmData);
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => {
          reject(new Error('PAYMENT_CANCELLED'));
        },
      },
    });

    checkout.open();
  });
}

export async function payForBookings({ bookingIds, contact }) {
  const loaded = await loadRazorpayScript();

  if (!loaded) {
    throw new Error('Unable to load payment gateway');
  }

  const { data } = await api.post('/payments/create-order', { bookingIds });

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      order_id: data.orderId,
      name: 'Bowline Nature Stay',
      description: data.description || 'Booking payment',
      prefill: {
        name: contact?.contactName || '',
        email: contact?.contactEmail || '',
        contact: contact?.contactPhone || '',
      },
      theme: { color: '#a3e635' },
      handler: async (response) => {
        try {
          const { data: verifyData } = await api.post('/payments/verify', response);
          resolve(verifyData);
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => {
          reject(new Error('PAYMENT_CANCELLED'));
        },
      },
    });

    checkout.open();
  });
}

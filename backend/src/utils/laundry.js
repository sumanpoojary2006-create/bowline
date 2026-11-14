export const initialLaundryStock = [
  ['Bedsheet Double White',14],['Bedsheet Double Brown',4],['Bedsheet single',40],
  ['Duvet Single',18],['Duvet Cover single',41],['Duvet Double',3],['Duvet cover Double',15],
  ['Bath Towel',43],['Handtowel',19],['Mattress protector D',1],['Mattress protector S',3],
  ['Black rug',4],['Blue rug',10],['Pillow',null],['Pillow cover',83],
].map(([name, stock], id) => ({ id: String(id + 1), name, stock }));
export const validCount = n => Number.isSafeInteger(n) && n >= 0 && n <= 10000;

export function calculateLaundryAvailability(stock, submissions = [], date) {
  return stock.map((item) => {
    let earlierOutstanding = 0;
    let sentToday = 0;
    let receivedToday = 0;

    submissions.forEach((submission) => {
      const row = submission.rows?.find((entry) => entry.id === item.id);
      if (!row) return;
      if (submission.date < date) earlierOutstanding += Number(row.sent || 0) - Number(row.received || 0);
      if (submission.date === date) {
        sentToday += Number(row.sent || 0);
        receivedToday += Number(row.received || 0);
      }
    });

    earlierOutstanding = Math.max(0, Math.min(Number(item.stock || 0), earlierOutstanding));
    const atLaundry = Math.max(0, earlierOutstanding + sentToday - receivedToday);
    const availableToReceive = atLaundry;
    const inHouse = Math.max(0, Number(item.stock || 0) - atLaundry);

    return {
      id: item.id,
      inHouse,
      atLaundry,
      previouslySent: atLaundry,
      availableToSend: inHouse,
      availableToReceive,
    };
  });
}

export function calculateLaundry(stock, entries, availability = []) {
  if (!Array.isArray(entries) || entries.length !== stock.length || new Set(entries.map(e => e.id)).size !== stock.length) throw new Error('Enter every item exactly once.');
  return stock.map(item => {
    const row = entries.find(e => e.id === item.id);
    const limits = availability.find((entry) => entry.id === item.id) || {
      inHouse: item.stock,
      availableToSend: item.stock,
      availableToReceive: 0,
    };
    if (!validCount(item.stock)) throw new Error(`Admin must set stock for ${item.name}.`);
    if (!row || !validCount(row.sent) || !validCount(row.received)) throw new Error(`Enter valid counts for ${item.name}.`);
    const summary = limits.inHouse - row.sent + row.received;
    if (row.sent > limits.availableToSend || row.received > limits.availableToReceive || summary < 0 || summary > item.stock) throw new Error(`Check laundry counts for ${item.name}. Received stock cannot exceed Previously Sent Stock.`);
    return { ...item, sent: row.sent, received: row.received, summary };
  });
}

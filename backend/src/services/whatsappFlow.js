import dayjs from 'dayjs';
import WhatsAppSession from '../models/WhatsAppSession.js';
import Listing from '../models/Listing.js';
import Booking from '../models/Booking.js';
import { sendText, sendButtons, sendList, sendImage, sendCtaUrl, sendImageButton } from '../utils/whatsapp.js';
import { parseDateRange } from '../utils/dateParser.js';
import {
  validateListingAvailability,
  getExistingBookingsForRange,
  getNextAvailableWindow,
  getPreviousAvailableWindow,
  isWindowAvailable,
} from '../utils/availability.js';
import { calculateBookingPrice } from '../utils/pricing.js';
import { createRoomBooking } from './bookingService.js';
import { createPaymentLink, isRazorpayConfigured } from '../utils/razorpay.js';

const RESET_WORDS = ['menu', 'hi', 'hello', 'hey', 'start', 'restart'];

const extractIncoming = (message) => ({
  text: message.text?.body?.trim() || '',
  buttonId: message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || null,
});

const formatDate = (date) => dayjs(date).format('D MMM YYYY');

const sendMenu = async (phone, profileName) => {
  const greeting = profileName ? `Hi ${profileName}! ` : 'Hi there! ';
  await sendCtaUrl(
    phone,
    `${greeting}Welcome to *Bowline Nature Stay* 🌿\n\nNestled in the forests of Chikkamagaluru, we offer peaceful stays with nature all around.\n\nBrowse our rooms and book directly on our website, or use the chat below to check availability and book.`,
    'Book Now',
    'https://bowline-omega.vercel.app/browse'
  );
  await sendButtons(
    phone,
    'Or continue here to check availability:',
    [
      { id: 'book_room', title: 'Book a Room' },
      { id: 'group_booking', title: 'Group Booking' },
      { id: 'my_bookings', title: 'My Bookings' },
    ]
  );
};

const startRoomSelect = async (session, phone, { resetCart = true } = {}) => {
  const rooms = await Listing.find({ type: 'room', active: true }).sort({ price: 1 });

  if (!rooms.length) {
    await sendText(phone, 'Sorry, no rooms are available right now. Please check back later.');
    return;
  }

  session.step = 'ROOM_SELECT';
  session.data = {};

  if (resetCart) {
    session.flow = 'single';
    session.cart = [];
  }

  await session.save();

  await sendText(phone, '🏡 *Our Rooms* — tap a room to select it:');

  for (const room of rooms) {
    const body = `*${room.name}*\nFrom Rs ${room.price}/night · Up to ${room.capacity} guests`;
    if (room.images?.length) {
      await sendImageButton(phone, room.images[0], body, `room_${room._id}`, 'Select');
    } else {
      await sendButtons(phone, body, [{ id: `room_${room._id}`, title: 'Select' }]);
    }
  }
};

const handleMenu = async (session, phone, buttonId, profileName) => {
  if (buttonId === 'book_room') {
    return startRoomSelect(session, phone);
  }

  if (buttonId === 'group_booking') {
    session.step = 'GROUP_GUESTS';
    session.data = {};
    session.cart = [];
    session.flow = 'group';
    await session.save();
    await sendText(
      phone,
      "Let's set up your group booking! 🎉\n\nGroup bookings are available for 10 to 20 guests, and we'll allocate the right rooms for you.\n\nHow many guests in total?"
    );
    return;
  }

  if (buttonId === 'my_bookings') {
    return startMyBookings(session, phone);
  }

  return sendMenu(phone, profileName);
};

const normalizePhoneDigits = (value) => String(value || '').replace(/\D/g, '');

const phoneMatches = (contactPhone, waPhone) => {
  const a = normalizePhoneDigits(contactPhone);
  const b = normalizePhoneDigits(waPhone);
  if (!a || !b) return false;
  return a.endsWith(b) || b.endsWith(a);
};

const startMyBookings = async (session, phone) => {
  const candidates = await Booking.find({ status: 'confirmed' })
    .sort({ createdAt: -1 })
    .populate('listing');

  const bookings = candidates.filter((booking) => phoneMatches(booking.contactPhone, phone)).slice(0, 10);

  if (!bookings.length) {
    await sendText(phone, 'You have no confirmed bookings yet. Type "menu" to book a room.');
    return;
  }

  session.step = 'MY_BOOKINGS_SELECT';
  await session.save();

  await sendList(phone, {
    header: 'My Bookings',
    bodyText: 'Select a booking to view its details.',
    buttonText: 'View Bookings',
    sections: [
      {
        title: 'Your Bookings',
        rows: bookings.map((booking) => ({
          id: `mybooking_${booking._id}`,
          title: `${booking.listing?.name || 'Room'} - ${formatDate(booking.startDate)}`.slice(0, 24),
          description: `${dayjs(booking.startDate).format('D MMM')} to ${dayjs(booking.endDate).format('D MMM')} - ${booking.status}`.slice(0, 72),
        })),
      },
    ],
  });
};

const handleMyBookingsSelect = async (session, phone, buttonId, profileName) => {
  if (!buttonId?.startsWith('mybooking_')) {
    await sendText(phone, 'Please select a booking from the list above, or type "menu" to go back.');
    return;
  }

  const bookingId = buttonId.replace('mybooking_', '');
  const booking = await Booking.findById(bookingId).populate('listing');

  if (!booking || !phoneMatches(booking.contactPhone, phone)) {
    await sendText(phone, "Sorry, we couldn't find that booking. Type \"menu\" to go back.");
    return;
  }

  const nights = dayjs(booking.endDate).diff(dayjs(booking.startDate), 'day');

  const lines = [`*Booking Details*`, ``];
  lines.push(`Booking ID: ${booking._id}`);
  lines.push(`Room: ${booking.listing?.name || 'N/A'}`);
  lines.push(`Dates: ${formatDate(booking.startDate)} to ${formatDate(booking.endDate)} (${nights} night${nights > 1 ? 's' : ''})`);
  lines.push(`Guests: ${booking.adultGuests} adult${booking.adultGuests > 1 ? 's' : ''}${booking.childGuests ? `, ${booking.childGuests} child${booking.childGuests > 1 ? 'ren' : ''}` : ''}`);

  if (booking.pets) {
    lines.push(`Pets: ${booking.pets}`);
  }

  if (booking.vegCount || booking.nonVegCount) {
    lines.push(`Meals: ${booking.vegCount} veg, ${booking.nonVegCount} non-veg`);
  }

  if (booking.pricingBreakdown?.adjustments?.length) {
    lines.push(`Adjustments: ${booking.pricingBreakdown.adjustments.join(', ')}`);
  }

  lines.push(`Amount: Rs ${booking.totalPrice}`);
  lines.push(``, `Status: ${booking.status}`);
  lines.push(`Payment: ${booking.paymentStatus}`);

  await sendText(phone, lines.join('\n'));
  await sendText(phone, 'Type "menu" to go back to the main menu.');
};

const handleRoomSelect = async (session, phone, buttonId) => {
  if (!buttonId?.startsWith('room_')) {
    await sendText(phone, 'Please select a room from the list above, or type "menu" to start over.');
    return;
  }

  const listingId = buttonId.replace('room_', '');
  const listing = await Listing.findById(listingId);

  if (!listing || !listing.active) {
    await sendText(phone, 'Sorry, that room is no longer available. Type "menu" to start over.');
    return;
  }

  session.data = {
    listingId: listing._id.toString(),
    listingName: listing.name,
    listingCapacity: listing.capacity,
    listingMinOccupancy: listing.minOccupancy || 1,
  };
  session.step = 'CHECKIN';
  await session.save();

  const calUrl = `https://bowline-omega.vercel.app/wa-dates?room=${encodeURIComponent(listing.name)}&phone=${phone}`;
  await sendCtaUrl(
    phone,
    `Great choice - *${listing.name}*! 🌿\n\nTap below to pick your check-in and check-out dates from a calendar.`,
    'Pick Dates 📅',
    calUrl
  );
};

const handleGroupGuests = async (session, phone, text) => {
  const guests = parsePositiveInt(text);

  if (guests === null || guests < 1) {
    await sendText(phone, 'Please enter a valid number of guests.');
    return;
  }

  if (guests < 10 || guests > 20) {
    await sendText(
      phone,
      'Group booking is available for 10 to 20 guests. For smaller groups, please use "Book a Room". Type "menu" to go back to the main menu.'
    );
    await resetSession(session);
    return;
  }

  const rooms = await Listing.find({ type: 'room', active: true }).sort({ price: 1 });

  const groupRooms = guests >= 15 ? rooms : rooms.filter((room) => room.slug !== 'pent-house');

  if (!groupRooms.length) {
    await sendText(phone, 'Sorry, no rooms are available for group booking right now. Type "menu" to go back.');
    await resetSession(session);
    return;
  }

  const label = guests >= 15 ? 'Full house' : 'All rooms except Pent House';

  session.data = {
    groupGuests: guests,
    groupRoomIds: groupRooms.map((room) => room._id.toString()),
  };
  session.step = 'GROUP_DATES';
  await session.save();

  await sendText(
    phone,
    `*${label}* (${groupRooms.length} room${groupRooms.length > 1 ? 's' : ''}): ${groupRooms.map((room) => room.name).join(', ')}\n\nPlease enter your check-in and check-out dates.\nFormat: DD Mon - DD Mon\nExample: 12 Jul - 14 Jul`
  );
};

const handleGroupDates = async (session, phone, text) => {
  const range = parseDateRange(text);

  if (!range) {
    await sendText(
      phone,
      'Sorry, I could not understand those dates. Please reply in the format: 12 Jul - 14 Jul'
    );
    return;
  }

  if (range.endDate <= range.startDate) {
    await sendText(phone, 'Check-out date must be after the check-in date. Please re-enter your dates.');
    return;
  }

  const { groupGuests, groupRoomIds } = session.data;
  const listings = await Listing.find({ _id: { $in: groupRoomIds }, active: true });

  const unavailable = [];

  for (const listing of listings) {
    const overlapping = await getExistingBookingsForRange({
      listingId: listing._id,
      startDate: range.startDate,
      endDate: range.endDate,
    });

    if (overlapping.length) {
      unavailable.push(listing.name);
    }
  }

  if (unavailable.length) {
    await sendText(
      phone,
      `Sorry, the following room${unavailable.length > 1 ? 's are' : ' is'} already booked for those dates: ${unavailable.join(', ')}.\n\nPlease enter different dates.\nFormat: DD Mon - DD Mon`
    );
    return;
  }

  const guestsPerRoom = Math.ceil(groupGuests / listings.length);

  const items = [];

  for (const listing of listings) {
    const adultGuests = Math.min(guestsPerRoom, listing.capacity);

    const pricing = await calculateBookingPrice({
      listing,
      bookingType: 'room',
      startDate: range.startDate,
      endDate: range.endDate,
      guests: adultGuests,
      adultGuests,
      childGuests: 0,
      pets: 0,
    });

    items.push({
      listingId: listing._id.toString(),
      listingName: listing.name,
      listingCapacity: listing.capacity,
      listingMinOccupancy: listing.minOccupancy || 1,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      adultGuests,
      childGuests: 0,
      pets: 0,
      vegCount: 0,
      nonVegCount: 0,
      totalPrice: pricing.totalPrice,
      unitPrice: pricing.unitPrice,
    });
  }

  session.data = items[0];
  session.cart = items.slice(1);
  session.flow = 'group';
  await session.save();

  await sendSummary(session, phone);
};

const parseSingleDateText = (text) => {
  // "12 Jul - 14 Jul" entered at check-in step → use start date only
  const asRange = parseDateRange(text);
  if (asRange) return asRange.startDate;

  const range = parseDateRange(`${text} - ${text}`);
  return range ? range.startDate : null;
};

const handleCheckin = async (session, phone, text) => {
  // Handle calendar response: "DATES: 12 Jul 2026 - 14 Jul 2026"
  const calMatch = text.match(/^dates?:\s*(.+)/i);
  if (calMatch) {
    const range = parseDateRange(calMatch[1].trim());
    if (range && range.endDate > range.startDate) {
      // Both dates provided from calendar — skip CHECKOUT step
      const overlapping = await getExistingBookingsForRange({
        listingId: session.data.listingId,
        startDate: range.startDate,
        endDate: range.endDate,
      });

      if (overlapping.length) {
        const calUrl = `https://bowline-omega.vercel.app/wa-dates?room=${encodeURIComponent(session.data.listingName)}&phone=${phone}`;
        await sendCtaUrl(
          phone,
          `Sorry, *${session.data.listingName}* is already booked for those dates. Please pick different dates.`,
          'Pick Dates 📅',
          calUrl
        );
        return;
      }

      session.data = { ...session.data, startDate: range.startDate.toISOString(), endDate: range.endDate.toISOString() };
      session.step = 'ADULTS';
      await session.save();
      await sendText(
        phone,
        `Dates: *${formatDate(range.startDate)} → ${formatDate(range.endDate)}* ✅\n\nHow many adults will be staying? (max ${session.data.listingCapacity})`
      );
      return;
    }
  }

  // Fallback: manual single-date entry
  const date = parseSingleDateText(text);

  if (!date) {
    const calUrl = `https://bowline-omega.vercel.app/wa-dates?room=${encodeURIComponent(session.data.listingName)}&phone=${phone}`;
    await sendCtaUrl(phone, 'Please use the calendar to pick your dates:', 'Pick Dates 📅', calUrl);
    return;
  }

  if (dayjs(date).isBefore(dayjs(), 'day')) {
    await sendText(phone, 'Check-in date cannot be in the past. Please enter a future date.');
    return;
  }

  session.data = { ...session.data, startDate: date.toISOString() };
  session.step = 'CHECKOUT';
  await session.save();

  await sendText(phone, `Check-in: *${formatDate(date)}* ✅\n\nWhat is your *check-out date*?\nExample: 14 Jul`);
};

const handleCheckout = async (session, phone, text) => {
  const date = parseSingleDateText(text);

  if (!date) {
    await sendText(phone, 'Sorry, I could not understand that date. Please reply like: *14 Jul*');
    return;
  }

  const startDate = new Date(session.data.startDate);

  if (date <= startDate) {
    await sendText(phone, `Check-out must be after check-in (${formatDate(startDate)}). Please enter a later date.`);
    return;
  }

  const endDate = date;

  const overlapping = await getExistingBookingsForRange({
    listingId: session.data.listingId,
    startDate,
    endDate,
  });

  if (overlapping.length) {
    const nights = dayjs(endDate).diff(dayjs(startDate), 'day');

    const [prevWindow, nextWindow] = await Promise.all([
      getPreviousAvailableWindow(session.data.listingId, nights, startDate),
      getNextAvailableWindow(session.data.listingId, nights, startDate),
    ]);

    const weekLaterStart = dayjs(startDate).add(7, 'day').toDate();
    const weekLaterEnd = dayjs(endDate).add(7, 'day').toDate();
    const weekLaterFree = await isWindowAvailable(session.data.listingId, weekLaterStart, weekLaterEnd);

    let message = `Sorry, *${session.data.listingName}* is already booked for those dates.\n\n*Other available dates:*`;

    if (prevWindow) {
      message += `\n📅 Before: ${formatDate(prevWindow.startDate)} to ${formatDate(prevWindow.endDate)}`;
    }

    if (nextWindow) {
      message += `\n📅 Next available: ${formatDate(nextWindow.startDate)} to ${formatDate(nextWindow.endDate)}`;
    }

    if (weekLaterFree) {
      message += `\n📅 Next week: ${formatDate(weekLaterStart)} to ${formatDate(weekLaterEnd)}`;
    }

    message += `\n\nPlease enter a new *check-in date*:`;
    session.step = 'CHECKIN';
    session.data = { ...session.data, startDate: undefined };
    await session.save();
    await sendText(phone, message);
    return;
  }

  session.data = { ...session.data, endDate: endDate.toISOString() };
  session.step = 'ADULTS';
  await session.save();

  await sendText(
    phone,
    `Check-out: *${formatDate(endDate)}* ✅\nDates: ${formatDate(startDate)} → ${formatDate(endDate)}\n\nHow many adults will be staying? (max ${session.data.listingCapacity})`
  );
};

const parsePositiveInt = (text) => {
  const value = Number(text.trim());

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
};

const handleAdults = async (session, phone, text) => {
  const adults = parsePositiveInt(text);
  const capacity = session.data.listingCapacity;
  const minOccupancy = session.data.listingMinOccupancy || 1;

  if (adults === null || adults < 1) {
    await sendText(phone, `Please enter a valid number of adults (${minOccupancy} to ${capacity}).`);
    return;
  }

  if (adults > capacity) {
    await sendText(phone, `This room sleeps up to ${capacity} guests. Please enter a smaller number of adults.`);
    return;
  }

  if (adults < minOccupancy) {
    await sendText(
      phone,
      `*${session.data.listingName}* requires a minimum of ${minOccupancy} guests. Please enter at least ${minOccupancy} adult${minOccupancy > 1 ? 's' : ''}.`
    );
    return;
  }

  session.data = { ...session.data, adultGuests: adults };
  session.step = 'CHILDREN';
  await session.save();

  await sendText(phone, 'How many children (age 6-12) will be staying? Reply 0 if none.');
};

const handleChildren = async (session, phone, text) => {
  const children = parsePositiveInt(text);

  if (children === null) {
    await sendText(phone, 'Please enter a valid number (0 or more).');
    return;
  }

  if (session.data.adultGuests + children > session.data.listingCapacity) {
    await sendText(
      phone,
      `Total guests can't exceed ${session.data.listingCapacity}. Please enter a smaller number of children.`
    );
    return;
  }

  session.data = { ...session.data, childGuests: children };
  session.step = 'PETS';
  await session.save();

  await sendText(phone, 'Are you bringing any pets? Reply with the number of pets (0 if none). A flat fee of Rs 400 applies per pet for the stay.');
};

const sendMealQuestion = async (phone, totalGuests) => {
  const rows = Array.from({ length: totalGuests + 1 }, (_, i) => ({
    id: `nonveg_${i}`,
    title: i === 0 ? '0 – All vegetarian' : i === totalGuests ? `${i} – All non-veg` : `${i} non-veg, ${totalGuests - i} veg`,
  }));

  await sendList(phone, {
    header: 'Meal Preference',
    bodyText: `How many of your *${totalGuests} guest${totalGuests > 1 ? 's' : ''}* prefer *non-vegetarian* meals?`,
    buttonText: 'Select',
    sections: [{ title: 'Non-veg count', rows }],
  });
};

const handlePets = async (session, phone, text) => {
  const pets = parsePositiveInt(text);

  if (pets === null) {
    await sendText(phone, 'Please enter a valid number (0 or more).');
    return;
  }

  const totalGuests = (session.data.adultGuests || 0) + (session.data.childGuests || 0);

  session.data = { ...session.data, pets };
  session.step = 'NONVEG';
  await session.save();

  await sendMealQuestion(phone, totalGuests);
};

const sendSummary = async (session, phone) => {
  const { listingId, listingName, startDate, endDate, adultGuests, childGuests, pets, vegCount, nonVegCount } =
    session.data;

  const listing = await Listing.findById(listingId);

  if (!listing || !listing.active) {
    await sendText(phone, 'Sorry, that room is no longer available. Type "menu" to start over.');
    session.step = 'MENU';
    session.data = {};
    await session.save();
    return;
  }

  const totalGuests = adultGuests + childGuests;

  const availability = await validateListingAvailability({
    listing,
    startDate,
    endDate,
    guests: totalGuests,
  });

  if (!availability.available) {
    await sendText(
      phone,
      `Sorry, this room is not available for those dates:\n${availability.reason}\n\nPlease enter different dates.`
    );
    session.step = 'DATES';
    await session.save();
    return;
  }

  const pricing = await calculateBookingPrice({
    listing,
    bookingType: 'room',
    startDate,
    endDate,
    guests: totalGuests,
    adultGuests,
    childGuests,
    pets,
  });

  session.data = { ...session.data, totalPrice: pricing.totalPrice, unitPrice: pricing.unitPrice };
  session.step = 'SUMMARY';
  await session.save();

  const nights = dayjs(endDate).diff(dayjs(startDate), 'day');
  const lines = [
    `*Booking Summary*`,
    `Room: ${listingName}`,
    `Dates: ${formatDate(startDate)} to ${formatDate(endDate)} (${nights} night${nights > 1 ? 's' : ''})`,
    `Guests: ${adultGuests} adult${adultGuests > 1 ? 's' : ''}${childGuests ? `, ${childGuests} child${childGuests > 1 ? 'ren' : ''}` : ''}`,
  ];

  if (pets) {
    lines.push(`Pets: ${pets}`);
  }

  if (vegCount || nonVegCount) {
    lines.push(`Meals: ${vegCount} veg, ${nonVegCount} non-veg`);
  }

  if (pricing.adjustments?.length) {
    lines.push(`Adjustments: ${pricing.adjustments.join(', ')}`);
  }

  lines.push(``, `Subtotal: Rs ${pricing.totalPrice}`);

  const cart = session.cart || [];

  if (cart.length) {
    const cartTotal = cart.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const grandTotal = cartTotal + pricing.totalPrice;

    lines.push(``, `*Other rooms in this booking:*`);
    cart.forEach((item) => {
      const itemNights = dayjs(item.endDate).diff(dayjs(item.startDate), 'day');
      lines.push(
        `- ${item.listingName} (${formatDate(item.startDate)} to ${formatDate(item.endDate)}, ${itemNights} night${itemNights > 1 ? 's' : ''}) - Rs ${item.totalPrice}`
      );
    });
    lines.push(``, `*Grand Total: Rs ${grandTotal}*`);
  }

  session.step = 'PAYMENT_TYPE';
  await session.save();

  await sendText(phone, lines.join('\n'));
  await sendButtons(phone, 'How would you like to pay?', [
    { id: 'pay_50', title: 'Pay 50% Now' },
    { id: 'pay_full', title: 'Pay Full Amount' },
    { id: 'cancel_booking', title: 'Cancel' },
  ]);
};

const handleNonVeg = async (session, phone, text, buttonId) => {
  let nonVeg = null;

  if (buttonId?.startsWith('nonveg_')) {
    nonVeg = parseInt(buttonId.replace('nonveg_', ''), 10);
  } else {
    nonVeg = parsePositiveInt(text);
  }

  const totalGuests = (session.data.adultGuests || 0) + (session.data.childGuests || 0);

  if (nonVeg === null || nonVeg < 0 || nonVeg > totalGuests) {
    await sendMealQuestion(phone, totalGuests);
    return;
  }

  session.data = { ...session.data, nonVegCount: nonVeg, vegCount: totalGuests - nonVeg };
  await session.save();

  await sendSummary(session, phone);
};

const resetSession = async (session) => {
  session.step = 'MENU';
  session.data = {};
  session.cart = [];
  session.flow = 'single';
  await session.save();
};

const finalizeBookings = async (session, phone, profileName, payInFull = false) => {
  const items = [...(session.cart || []), session.data];

  const contactName = profileName || 'WhatsApp Guest';
  const contactEmail = `whatsapp.${phone}@bowline.guest`;
  const contactPhone = `+${phone}`;

  const bookings = [];

  for (const item of items) {
    const { listingId, listingName, startDate, endDate, adultGuests, childGuests, pets, vegCount, nonVegCount } = item;

    const listing = await Listing.findById(listingId);

    if (!listing || !listing.active) {
      await sendText(phone, `Sorry, *${listingName}* is no longer available. Type "menu" to start over.`);
      await resetSession(session);
      return;
    }

    const overlapping = await getExistingBookingsForRange({
      listingId: listing._id,
      startDate,
      endDate,
    });

    if (overlapping.length) {
      await sendText(
        phone,
        `Sorry, *${listing.name}* just got booked for ${formatDate(startDate)} to ${formatDate(endDate)} while you were booking. Please type "menu" and try again.`
      );
      await resetSession(session);
      return;
    }

    try {
      const booking = await createRoomBooking({
        listing,
        startDate,
        endDate,
        adultGuests,
        childGuests,
        pets,
        vegCount,
        nonVegCount,
        contactName,
        contactEmail,
        contactPhone,
        specialRequests: '',
        payInFullRequested: payInFull,
      });
      bookings.push(booking);
    } catch (error) {
      await sendText(
        phone,
        `Sorry, we couldn't complete the booking for *${listing.name}*: ${error.message}. Type "menu" to start over.`
      );
      await resetSession(session);
      return;
    }
  }

  const bookingIds = bookings.map((b) => b._id.toString());
  const grandTotal = bookings.reduce((sum, b) => sum + b.totalPrice, 0);

  session.step = 'MENU';
  session.data = {};
  session.cart = [];
  session.flow = 'single';
  session.lastBookingIds = bookings.map((b) => b._id);
  await session.save();

  const roomsList = bookings
    .map((b) => `- ${b.listing.name} (${formatDate(b.startDate)} to ${formatDate(b.endDate)}) - Rs ${b.totalPrice}`)
    .join('\n');
  const idsLabel = bookingIds.length > 1 ? 'Booking IDs' : 'Booking ID';

  if (!isRazorpayConfigured()) {
    await sendText(
      phone,
      `Your booking${bookings.length > 1 ? 's have' : ' has'} been received!\n\n${roomsList}\n\n*Total: Rs ${grandTotal}*\n${idsLabel}: ${bookingIds.join(', ')}\n\nOur team will contact you shortly to arrange payment.`
    );
    return;
  }

  const depositAmount = payInFull ? grandTotal : Math.round(grandTotal * 0.5);
  const depositLabel = payInFull ? `Rs ${grandTotal}` : `Rs ${depositAmount} (50% deposit)`;
  const remainingLabel = payInFull ? '' : `\nRemaining Rs ${grandTotal - depositAmount} due at check-in.`;

  try {
    const paymentLink = await createPaymentLink({
      amount: Math.round(depositAmount * 100),
      currency: 'INR',
      description:
        bookings.length > 1
          ? `Bowline Nature Stay - ${bookings.length} rooms`
          : `Bowline Nature Stay - ${bookings[0].listing.name}`,
      customer: {
        name: contactName,
        contact: contactPhone,
      },
      notes: {
        bookingIds: bookingIds.join(','),
      },
    });

    await Booking.updateMany({ _id: { $in: bookingIds } }, { razorpayPaymentLinkId: paymentLink.id });

    await sendText(
      phone,
      `*Booking Request Received!* ✅\n\n${roomsList}\n\n*Total: Rs ${grandTotal}*\nAmount to pay now: *${depositLabel}*${remainingLabel}\n\n👇 Complete your payment to confirm the booking:\n${paymentLink.short_url}\n\nYou'll receive a confirmation message here once payment is done.`
    );
  } catch (error) {
    await sendText(
      phone,
      `Your booking${bookings.length > 1 ? 's have' : ' has'} been received (${idsLabel}: ${bookingIds.join(', ')}), but we couldn't generate a payment link. Our team will contact you shortly to arrange payment.`
    );
  }
};

const handlePaymentType = async (session, phone, buttonId, profileName) => {
  if (buttonId === 'pay_50') {
    return finalizeBookings(session, phone, profileName, false);
  }

  if (buttonId === 'pay_full') {
    return finalizeBookings(session, phone, profileName, true);
  }

  if (buttonId === 'cancel_booking') {
    await resetSession(session);
    await sendText(phone, 'No problem, your booking has been cancelled. Type "menu" to start over.');
    return;
  }

  await sendText(phone, 'Please use the buttons above to choose your payment option or cancel.');
};

export const handleIncomingMessage = async (phone, message, profileName) => {
  const { text, buttonId } = extractIncoming(message);

  let session = await WhatsAppSession.findOne({ phone });

  if (!session) {
    session = await WhatsAppSession.create({ phone, step: 'MENU', data: {} });
  }

  if (!buttonId && RESET_WORDS.includes(text.toLowerCase())) {
    session.step = 'MENU';
    session.data = {};
    session.cart = [];
    await session.save();
    await sendMenu(phone, profileName);
    return;
  }

  switch (session.step) {
    case 'ROOM_SELECT':
      return handleRoomSelect(session, phone, buttonId);
    case 'GROUP_GUESTS':
      return handleGroupGuests(session, phone, text);
    case 'GROUP_DATES':
      return handleGroupDates(session, phone, text);
    case 'CHECKIN':
      return handleCheckin(session, phone, text);
    case 'CHECKOUT':
      return handleCheckout(session, phone, text);
    case 'ADULTS':
      return handleAdults(session, phone, text);
    case 'CHILDREN':
      return handleChildren(session, phone, text);
    case 'PETS':
      return handlePets(session, phone, text);
    case 'NONVEG':
      return handleNonVeg(session, phone, text, buttonId);
    case 'PAYMENT_TYPE':
      return handlePaymentType(session, phone, buttonId, profileName);
    case 'MY_BOOKINGS_SELECT':
      return handleMyBookingsSelect(session, phone, buttonId, profileName);
    case 'MENU':
    default:
      return handleMenu(session, phone, buttonId, profileName);
  }
};

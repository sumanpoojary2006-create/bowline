import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Booking from '../models/Booking.js';
import PricingRule from '../models/PricingRule.js';
import Notification from '../models/Notification.js';
import { slugify } from '../utils/slugify.js';

dotenv.config();

const sharedAmenities = [
  '24x7 Hot Water',
  'Free Wi-Fi',
  'On-site Parking',
  'Power Backup',
  'First-aid Facility',
  'Refrigerator',
  'Hot Water Kettle',
  'Toiletries - Shower Gel',
];

const sharedFacilities = [
  'Shared Kitchen',
  'Shared Hall & Dining Area',
  'Projector (Common Hall)',
  'Common Washing Machine',
  'Sound System',
  'BBQ Grill (Group Bookings Only)',
  'Coffee Plantation Stroll',
  'Nature Walk',
  'Campfire (Weather Permitting)',
];

const roomSeeds = [
  {
    type: 'room',
    name: 'Cozy 1',
    location: 'Bowline Nature Stay, Devaramane, Mudigere, Chikkamagaluru',
    shortDescription: 'Ground-floor room with one double bed, two single beds, and an attached bathroom.',
    description:
      'Cozy 1 is a ground-floor room at Bowline Nature Stay with a minimum occupancy of 2 and a maximum occupancy of 4. The brochure lists one double bed, two single beds, complimentary breakfast, and access to all shared homestay amenities and common spaces. Child tariff is 50% of adult tariff for ages 6 to 12.',
    price: 1799,
    priceUnit: 'person',
    maxOccupancy: 4,
    capacity: 4,
    amenities: sharedAmenities,
    facilities: [
      ...sharedFacilities,
      'Attached Bathroom',
      'Authentic Malnad Cuisine',
      'Host-guided Local Experiences',
    ],
    images: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    ],
    availabilityStatus: 'available',
    featured: true,
    manualPriceOverride: null,
  },
  {
    type: 'room',
    name: 'Cozy 2',
    location: 'Bowline Nature Stay, Devaramane, Mudigere, Chikkamagaluru',
    shortDescription: 'Ground-floor room with one double bed, two single beds, and an attached bathroom.',
    description:
      'Cozy 2 mirrors the brochure configuration of Cozy 1 with a minimum occupancy of 2 and a maximum occupancy of 4. It includes one double bed, two single beds, complimentary breakfast, and full access to the common dining, kitchen, and activity spaces inside the homestay.',
    price: 1799,
    priceUnit: 'person',
    maxOccupancy: 4,
    capacity: 4,
    amenities: sharedAmenities,
    facilities: [
      ...sharedFacilities,
      'Attached Bathroom',
      'Authentic Malnad Cuisine',
      'Host-guided Local Experiences',
    ],
    images: [
      'https://images.unsplash.com/photo-1505693536294-233b40443e1d?auto=format&fit=crop&w=1200&q=80',
    ],
    availabilityStatus: 'available',
    featured: true,
    manualPriceOverride: null,
  },
  {
    type: 'room',
    name: 'Cozy Mini',
    location: 'Bowline Nature Stay, Devaramane, Mudigere, Chikkamagaluru',
    shortDescription: 'First-floor compact room with three single beds and an attached bathroom.',
    description:
      'Cozy Mini is a first-floor room with a minimum occupancy of 1 and a maximum occupancy of 3. The brochure lists three single beds, complimentary breakfast, and access to Bowline’s shared kitchen, common hall, dining area, and guided homestay experiences.',
    price: 1699,
    priceUnit: 'person',
    maxOccupancy: 3,
    capacity: 3,
    amenities: sharedAmenities,
    facilities: [
      ...sharedFacilities,
      'Attached Bathroom',
      'Ideal for Solo or Small Group Stays',
    ],
    images: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    ],
    availabilityStatus: 'available',
    featured: true,
    manualPriceOverride: null,
  },
  {
    type: 'room',
    name: 'Dormitory (Open Loft)',
    location: 'Bowline Nature Stay, Devaramane, Mudigere, Chikkamagaluru',
    shortDescription: 'First-floor open loft dorm with five single beds and one shared bathroom.',
    description:
      'The dormitory at Bowline Nature Stay is an open loft setup on the first floor with a minimum occupancy of 1 and a maximum occupancy of 5. The brochure notes five single beds, one shared bathroom, complimentary breakfast, and access to all common amenities and activity areas.',
    price: 1299,
    priceUnit: 'person',
    maxOccupancy: 5,
    capacity: 5,
    amenities: sharedAmenities,
    facilities: [
      ...sharedFacilities,
      'Shared Bathroom',
      'Open Loft Layout',
      'Budget-friendly Group Stay',
    ],
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
    ],
    availabilityStatus: 'available',
    featured: false,
    manualPriceOverride: null,
  },
  {
    type: 'room',
    name: 'Pent House',
    location: 'Bowline Nature Stay, Devaramane, Mudigere, Chikkamagaluru',
    shortDescription: 'Second-floor pent house with one double bed, two single beds, and an attached bathroom.',
    description:
      'The Pent House sits on the second floor with a minimum occupancy of 2 and a maximum occupancy of 4. According to the brochure, it includes one double bed, two single beds, complimentary breakfast, attached bathroom access, and the same homestay-led guided experiences offered across the property.',
    price: 2199,
    priceUnit: 'person',
    maxOccupancy: 4,
    capacity: 4,
    amenities: sharedAmenities,
    facilities: [
      ...sharedFacilities,
      'Attached Bathroom',
      'Second-floor Stay',
      'Best Overall View Point Inside Property',
    ],
    images: [
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
    ],
    availabilityStatus: 'limited',
    featured: true,
    manualPriceOverride: null,
  },
];

const activitySeeds = [
  {
    type: 'trek',
    name: 'Offbeat Trekking',
    location: 'Devaramane & nearby trails, Mudigere',
    shortDescription: 'A guided offbeat trek offered only with package stays or two-night homestay bookings.',
    description:
      'The brochure lists offbeat trekking as one of Bowline Nature Stay’s included experiences for package guests or visitors staying for two nights. It is positioned as a guided outdoor activity led from the homestay itself.',
    price: 0,
    priceUnit: 'package',
    capacity: 20,
    difficulty: 'Moderate',
    duration: 'Depends on route',
    facilities: ['Included for package / 2 night stay', 'Guided by hosts', 'Forest Trail Access'],
    images: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    ],
    availableDates: ['2026-04-12', '2026-04-19', '2026-04-26'],
    availabilityStatus: 'available',
    featured: false,
  },
  {
    type: 'camp',
    name: 'Campfire & Nature Evening',
    location: 'Bowline Nature Stay, Mudigere',
    shortDescription: 'An in-house evening experience with campfire, indoor games, and shared common spaces.',
    description:
      'The brochure highlights campfire access depending on weather, indoor and outdoor games, a mini library, projector use in the common hall, and sound system access as part of the Bowline homestay experience.',
    price: 99,
    priceUnit: 'package',
    capacity: 20,
    duration: 'Evening',
    facilities: ['Campfire (Depends on weather)', 'Indoor & Outdoor Games', 'Mini Library', 'Projector Hall'],
    images: [
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
    ],
    availableDates: ['2026-04-12', '2026-04-19', '2026-04-26'],
    availabilityStatus: 'available',
    featured: false,
  },
];

const listingSeeds = [...roomSeeds, ...activitySeeds];

const seed = async () => {
  await connectDb();

  await Promise.all([
    User.deleteMany({}),
    Listing.deleteMany({}),
    Booking.deleteMany({}),
    PricingRule.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  const admin = await User.create({
    name: 'Bowline Admin',
    email: 'admin@bowline.com',
    password: 'Admin@123',
    role: 'admin',
    phone: '+91 6366004404',
  });

  const user = await User.create({
    name: 'Trail Explorer',
    email: 'explorer@bowline.com',
    password: 'User@123',
    role: 'user',
    phone: '+91 9876543210',
  });

  const listings = await Listing.insertMany(
    listingSeeds.map((listing) => ({
      ...listing,
      slug: slugify(listing.name),
      seo: {
        metaTitle: `Bowline Nature Stay | ${listing.name}`,
        metaDescription: listing.shortDescription,
      },
    }))
  );

  const cozy1 = listings.find((listing) => listing.slug === slugify('Cozy 1'));
  const cozy2 = listings.find((listing) => listing.slug === slugify('Cozy 2'));
  const cozyMini = listings.find((listing) => listing.slug === slugify('Cozy Mini'));
  const dormitory = listings.find((listing) => listing.slug === slugify('Dormitory (Open Loft)'));
  const pentHouse = listings.find((listing) => listing.slug === slugify('Pent House'));

  await PricingRule.insertMany([
    {
      name: 'Cozy 1 weekend tariff',
      listing: cozy1._id,
      listingType: 'room',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      adjustmentType: 'flat',
      adjustmentValue: 200,
      priority: 3,
      active: true,
    },
    {
      name: 'Cozy 2 weekend tariff',
      listing: cozy2._id,
      listingType: 'room',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      adjustmentType: 'flat',
      adjustmentValue: 200,
      priority: 3,
      active: true,
    },
    {
      name: 'Cozy Mini weekend tariff',
      listing: cozyMini._id,
      listingType: 'room',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      adjustmentType: 'flat',
      adjustmentValue: 100,
      priority: 3,
      active: true,
    },
    {
      name: 'Dormitory weekend tariff',
      listing: dormitory._id,
      listingType: 'room',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      adjustmentType: 'flat',
      adjustmentValue: 100,
      priority: 3,
      active: true,
    },
    {
      name: 'Pent House weekend tariff',
      listing: pentHouse._id,
      listingType: 'room',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      adjustmentType: 'flat',
      adjustmentValue: 300,
      priority: 3,
      active: true,
    },
  ]);

  await Booking.create({
    bookingType: cozy1.type,
    listing: cozy1._id,
    user: user._id,
    startDate: new Date('2026-04-14'),
    endDate: new Date('2026-04-16'),
    guests: 2,
    unitPrice: 1799,
    totalPrice: 7196,
    pricingBreakdown: {
      basePrice: 1799,
      adjustments: [],
    },
    status: 'confirmed',
    paymentStatus: 'pending',
    paymentMethod: 'manual',
    contactName: 'Trail Explorer',
    contactEmail: 'explorer@bowline.com',
    contactPhone: '+91 9876543210',
    specialRequests: 'Would like lunch and dinner add-on for both days.',
  });

  await Notification.insertMany([
    {
      user: admin._id,
      title: 'Bowline Nature Stay data loaded',
      message: 'Brochure-based room inventory, tariffs, and amenities are ready in the admin dashboard.',
      type: 'system',
    },
    {
      user: user._id,
      title: 'Welcome to Bowline Nature Stay',
      message: 'Explore the brochure-based room inventory and send a booking request for your stay.',
      type: 'system',
    },
  ]);

  console.log('Seed complete');
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

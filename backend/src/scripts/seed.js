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

const listingSeeds = [
  {
    type: 'room',
    name: 'Tranquil Nest',
    location: 'Mudigere, Chikkamagaluru',
    shortDescription: 'A calm mountain-facing room for couples and small families.',
    description:
      'A warm queen room with plantation views, breakfast, bonfire access, and guided nature walks.',
    price: 5600,
    priceUnit: 'night',
    maxOccupancy: 3,
    capacity: 3,
    amenities: ['WiFi', 'Hot Water', 'Mountain View', 'Breakfast'],
    facilities: ['Camp Fire', 'Coffee Plantation', 'Nature Walk'],
    images: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    ],
    availabilityStatus: 'available',
    featured: true,
  },
  {
    type: 'room',
    name: 'Deluxe Ridge Penthouse',
    location: 'Mudigere, Chikkamagaluru',
    shortDescription: 'A panoramic penthouse with kitchen access and dramatic valley views.',
    description:
      'This penthouse includes a king bed, private kitchenette, work corner, wraparound balcony, and easy access to guided off-road experiences.',
    price: 8000,
    priceUnit: 'night',
    maxOccupancy: 4,
    capacity: 4,
    amenities: ['WiFi', 'Private Kitchen', 'King Bed', 'Balcony'],
    facilities: ['Projector Show', 'Camp Fire', 'Coffee Plantation'],
    images: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    ],
    availabilityStatus: 'limited',
    featured: true,
  },
  {
    type: 'trek',
    name: 'Ettina Bhuja Sunrise Trek',
    location: 'Mudigere, Karnataka',
    shortDescription: 'A scenic guided ridge trek with sunrise views and local breakfast.',
    description:
      'An early morning trek ideal for new and intermediate hikers, covering forest paths, ridges, and a hearty local breakfast at basecamp.',
    price: 1999,
    priceUnit: 'person',
    capacity: 20,
    difficulty: 'Moderate',
    duration: '1 Day',
    facilities: ['Guide', 'Breakfast', 'Transport Add-on'],
    images: [
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    ],
    availableDates: ['2026-04-10', '2026-04-17', '2026-04-24'],
    availabilityStatus: 'available',
    featured: true,
  },
  {
    type: 'trek',
    name: 'Devaramane Forest Trail',
    location: 'Devaramane, Karnataka',
    shortDescription: 'A softer guided forest trail for families and first-timers.',
    description:
      'Walk through coffee estates and dense greenery with a local naturalist, waterfall stop, and optional packed lunch.',
    price: 1499,
    priceUnit: 'person',
    capacity: 15,
    difficulty: 'Easy',
    duration: '6 Hours',
    facilities: ['Naturalist Guide', 'Snacks', 'Waterfall Visit'],
    images: [
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    ],
    availableDates: ['2026-04-12', '2026-04-19', '2026-04-26'],
    availabilityStatus: 'available',
  },
  {
    type: 'camp',
    name: 'Bowline Wilderness Camp',
    location: 'Chikkamagaluru',
    shortDescription: 'An immersive weekend camp with survival drills, first aid, and campfire circles.',
    description:
      'Learn rope craft, navigation, first aid, and confidence-building outdoor routines in a guided camp environment for teenagers and adults.',
    price: 3999,
    priceUnit: 'package',
    capacity: 30,
    duration: '2 Days',
    facilities: ['Meals', 'Tent Stay', 'Survival Skills', 'First Aid'],
    images: [
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
    ],
    availableDates: ['2026-05-02', '2026-05-16', '2026-06-06'],
    availabilityStatus: 'available',
    featured: true,
  },
  {
    type: 'camp',
    name: 'Monsoon Wellness Camp',
    location: 'Mudigere',
    shortDescription: 'A restorative camp with yoga, forest walks, and mindful outdoor routines.',
    description:
      'Designed for small groups that want a slower and more reflective outdoor escape with guided yoga and rain-soaked plantation experiences.',
    price: 3499,
    priceUnit: 'package',
    capacity: 24,
    duration: '2 Days',
    facilities: ['Yoga Sessions', 'All Meals', 'Rain Walk', 'Bonfire'],
    images: [
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    ],
    availableDates: ['2026-06-20', '2026-07-04'],
    availabilityStatus: 'limited',
  },
];

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
        metaTitle: `Bowline | ${listing.name}`,
        metaDescription: listing.shortDescription,
      },
    }))
  );

  const room = listings.find((listing) => listing.type === 'room');
  const trek = listings.find((listing) => listing.type === 'trek');

  await PricingRule.insertMany([
    {
      name: 'Weekend stay surcharge',
      listingType: 'room',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-12-31'),
      adjustmentType: 'flat',
      adjustmentValue: 500,
      priority: 2,
      active: true,
    },
    {
      name: 'Summer adventure promo',
      listing: trek._id,
      listingType: 'trek',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-05-30'),
      adjustmentType: 'percentage',
      adjustmentValue: -10,
      priority: 3,
      active: true,
    },
  ]);

  await Booking.create({
    bookingType: room.type,
    listing: room._id,
    user: user._id,
    startDate: new Date('2026-04-11'),
    endDate: new Date('2026-04-13'),
    guests: 2,
    unitPrice: 6100,
    totalPrice: 12200,
    pricingBreakdown: {
      basePrice: 5600,
      adjustments: ['Weekend stay surcharge: ₹500'],
    },
    status: 'confirmed',
    paymentStatus: 'paid',
    paymentMethod: 'manual',
    contactName: 'Trail Explorer',
    contactEmail: 'explorer@bowline.com',
    contactPhone: '+91 9876543210',
    specialRequests: 'Need early breakfast before trek.',
  });

  await Notification.insertMany([
    {
      user: admin._id,
      title: 'Seed data ready',
      message: 'The Bowline admin dashboard has been initialized with sample listings and bookings.',
      type: 'system',
    },
    {
      user: user._id,
      title: 'Welcome to Bowline',
      message: 'Your sample user account is ready. Explore stays, treks, and camps.',
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

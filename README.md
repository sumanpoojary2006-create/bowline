# Bowline Booking Platform

A full-stack booking platform for Bowline stays, treks, and camping experiences.

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Auth: JWT + bcrypt
- Storage: Firebase Cloud Storage ready
- Hosting: Vercel-ready frontend + `/api` serverless routing
- Payments: Razorpay-ready mock flow with pluggable provider support

## Project Structure

```text
Bowline/
  backend/
    src/
      config/
      controllers/
      middleware/
      models/
      routes/
      scripts/
      utils/
    uploads/
  frontend/
    src/
      components/
      context/
      layouts/
      lib/
      pages/
  package.json
```

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create environment files:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

3. Start MongoDB locally or update `MONGODB_URI` to your hosted cluster.

4. If you want image uploads on the free tier, create a Firebase project and fill:

   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_STORAGE_BUCKET`

   If these are omitted, uploads fall back to local file storage for development.

5. Seed sample data:

   ```bash
   npm run seed
   ```

6. Run both apps:

   ```bash
   npm run dev
   ```

Frontend runs on `http://localhost:5173` and backend on `http://localhost:5000`.

## Free-Tier Deployment Path

### Firebase Storage

- Uploads can go through Firebase Cloud Storage from the backend.
- This avoids ephemeral file problems on serverless hosts like Vercel.
- Configure the Firebase service-account environment variables in your backend environment.

### Vercel

- The repo includes [vercel.json](/Users/inno/Desktop/Bowline/vercel.json) to serve the React app from `frontend/dist`.
- API routes are exposed through [api/index.js](/Users/inno/Desktop/Bowline/api/index.js), which boots the Express app as a Vercel function.
- Frontend API calls now default to same-origin `/api`, which works locally through the Vite proxy and in production on Vercel.

### Suggested Setup

1. Deploy this repo to Vercel.
2. Add all backend env vars in the Vercel project settings.
3. Use Vercel’s default `*.vercel.app` domain first.
4. Point `MONGODB_URI` to MongoDB Atlas free tier if you want the whole stack to stay low-cost.

## Core API Routes

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/profile`

### Listings

- `GET /api/listings`
- `GET /api/listings/:slug`
- `POST /api/listings/:id/availability`
- `GET /api/listings/admin/all`
- `POST /api/listings`
- `PUT /api/listings/:id`
- `DELETE /api/listings/:id`

### Bookings

- `POST /api/bookings`
- `GET /api/bookings/me`
- `PATCH /api/bookings/me/:id/cancel`
- `GET /api/bookings/admin/all`
- `PATCH /api/bookings/admin/:id`

### Admin

- `GET /api/admin/overview`
- `GET /api/admin/users`
- `GET /api/admin/users/:id/bookings`
- `GET /api/admin/pricing-rules`
- `POST /api/admin/pricing-rules`
- `PUT /api/admin/pricing-rules/:id`
- `DELETE /api/admin/pricing-rules/:id`

### Notifications

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`

## Default Seeded Accounts

- Admin: `admin@bowline.com` / `Admin@123`
- User: `explorer@bowline.com` / `User@123`

## Key Features

- Role-based JWT authentication
- Admin dashboard for rooms, treks, camps, bookings, pricing, and users
- Client website with unified browsing and booking experience
- Availability checks, seasonal overrides, notifications, and analytics
- Deployment-friendly environment variables and build setup

## Notes

- Payments are modeled with `paymentMethod` and `paymentStatus`, with a simulated instant-payment path that can be swapped for Razorpay server integration later.
- Image management supports uploaded files plus remote image URLs for faster content seeding.
- Firebase Storage is preferred for production on the free tier because Vercel filesystem writes are not durable.
- I verified the frontend production build locally. The backend source parses successfully, but the API was not launched here because MongoDB is not installed in this environment.

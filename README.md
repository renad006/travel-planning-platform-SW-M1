# travel-planning-platform-SW-M1
# Travel Planning and Booking Platform

Software Project I, Winter 2026. Flight and hotel booking, itinerary planning and budgeting, and a travel blog.

**Stack:** NestJS (backend), MongoDB Atlas, Next.js (frontend, Milestone 2).

## Setup (Milestone 1, backend)

1. Copy `.env.example` to `backend/.env` and fill in the values:
   - `MONGODB_URI`: the Atlas connection string (shared privately, never commit it)
   - `JWT_SECRET`, `JWT_ACCESS_EXPIRES_MINUTES` (15), `JWT_REFRESH_EXPIRES_MINUTES` (30)
   - `PORT`, `FRONTEND_URL`, `NODE_ENV`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`: used by the seed script to create the admin account
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DEFAULT_CURRENCY` (payments)
   - `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` (optional, email for password reset and notification copies, ACC-07 and GEN-01-B; a free Ethereal test inbox works, and if `MAIL_HOST` is empty, emails are skipped with a warning)
   - `FXRATES_API_KEY` (exchange rates)
2. `cd backend` then `npm install`
3. Seed the database: `npm run seed`. It creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` and loads countries, cities, airports and attractions. It is safe to run more than once (upserts).
4. `npm run start:dev`
5. Swagger UI: http://localhost:3000/api/docs

To test protected endpoints in Swagger, call `POST /api/auth/login` first. The JWT is stored in httpOnly cookies and sent automatically.

## Git workflow
- Long-lived branches: `main` (milestone releases) and `develop` (integration). Never push directly to either.
- Create feature branches from the latest `develop`:
  `feature/<requirement-id>-<description>`, `fix/<requirement-id>-<description>`, `refactor/<description>`, `docs/<description>`
  Example: `feature/ACC-01-user-registration`
- Commit style (Conventional Commits): `feat(auth): implement registration`, `fix(hotels): prevent double booking`
- Open a pull request into `develop`. Reference requirement IDs in the title or description, include only related changes, never commit `.env` or secrets.
- The team leader reviews every PR. Resolve review comments before merging.
- Sync your branch with `develop` regularly.
- At the milestone release: `develop` into `main`.

## Auth, accounts and admin (Member 1)

- **Auth** (`/api/auth`): register (ACC-01), login (ACC-04), refresh and logout (ACC-06), change password (ACC-08), current user (`/me`, ACC-19). Access and refresh tokens live only in httpOnly cookies, never in the response body.
- **Lockout** (ACC-05): 5 failed logins lock the account for 15 minutes.
- **Profile** (`/api/users/me`): get (ACC-11), edit name, phone and preferred currency (ACC-09), deactivate own account (ACC-12).
- **Admin** (`/api/admin`, admin role only): create moderator accounts (ACC-13), reset a user's password with a one-time temporary password (ACC-07a), audit logs with filters (GEN-07). A user with a temporary password can only call change-password, logout and `/me` until the password is changed.
- **Notifications** (`/api/notifications`): list, mark one read, mark all read; users only see their own (GEN-01).
- **Errors:** every error returns `{ statusCode, message, error, timestamp, path }`.
- **Sessions:** the user is loaded from the database on every request, so suspended or deactivated accounts are blocked immediately.
- **Bonus, forgot password by email** (ACC-07): `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`. The emailed token is single use, expires after 30 minutes, and only its hash is stored.
- **Bonus, email notifications** (GEN-01-B): every in-app notification also sends an email copy. Email problems never break the action that triggered the notification.

## Airlines & Flights (Member 2)

- **Airlines** (`/api/airlines`): An admin creates an airline (FLT-01). Its moderator edits the name and code and uploads one logo, JPG or PNG up to 5 MB, where a new logo replaces the old one (FLT-01, GEN-08). Public list and details.
- **Policies**: Baggage with `PUT /api/airlines/:id/baggage-policy`, giving the extra-bag price and max extra bags per passenger (FLT-08). Cancellation tiers with `PUT /api/airlines/:id/cancellation-policy` (FLT-09): the refund uses the highest tier not above the days left before departure, or 0% if none applies.
- **Airports** (`GET /api/airports`, public): Read-only seeded airports with search, country and city filters (FLT-02).
- **Flights** (`/api/flights`): The airline's moderator (or an admin with `airlineId`) creates a flight in each airport's **local time**; it is stored in UTC (FLT-03). Departure must be in the future, arrival after departure, and a flight number cannot repeat for the same airline on the same date. Edit times of a Scheduled flight; airports are locked once any seat is held or booked (FLT-05). Cancel a Scheduled flight (FLT-06): the bookings module cancels its bookings with a 100% refund and notifies passengers.
- **Cabins** (`/api/flights/:id/cabins`): Economy, Premium Economy, Business and First, each at most once per flight, with seats, price, free bags and max kg per bag (FLT-04). Seats can never go below held plus booked seats, and price changes never affect existing bookings (FLT-05).
- **Search** (`GET /api/flights/search`, public): One-way or round trip; adults (12+), children (2-11) and infants (under 2, pay 10%, take no seat, at most one per adult); cabin, airline and price filters; sort by price, duration or departure time; 10 results per page (FLT-11, FLT-12, FLT-15). Only Scheduled flights of active airlines with enough free seats are shown.
- **Details** (`GET /api/flights/:id`, public): Local departure and arrival times, duration, cabins with seats left, baggage and cancellation policies (FLT-17).
- **Moderator view**: `GET /api/flights/:id/bookings` lists the flight's bookings and seats left per cabin, and `GET /api/flights/:id/passengers/export` downloads the passenger list as CSV (FLT-29). Own airline only.
- **Status**: A flight becomes `Departed` automatically once its departure time passes (FLT-30).
- **Time zones** (GEN-06): Every flight time is returned as UTC, local time and the airport's time zone.
- **Seat inventory**: Holding, confirming and releasing seats is atomic, so held plus booked seats can never exceed a cabin's capacity. Member 3's bookings use these methods.

## Flight Bookings & Itinerary Budgeting (Member 3)

- **Flight bookings** (`/api/flight-bookings`): Booking summary before payment (FLT-19, FLT-21), atomic 10-minute seat hold so seats can never be overbooked, with a job that releases expired holds (FLT-22). After booking is `Confirmed` with a unique reference and a PDF e-ticket (FLT-23). The user can list their bookings as Upcoming, Past and Cancelled (FLT-25) and cancel one after seeing the refund from the airline's tiers (FLT-26). Ownership is enforced (other users get 404).
- **Budget** (`/api/itineraries/:id/...`): Budget entries per day (ITN-14), intercity transport costs (ITN-16), and `GET /api/itineraries/:id/budget-summary?currency=` for totals by category and by day. Amounts without an exchange rate are listed under `unconverted`, never guessed.
- **Exchange rates** (`/api/fx-rates`): FXRatesAPI rates are fetched once a day and cached; the last cached rates are used if the API is down (ITN-18). The API key stays on the server.
- **Sharing** (`/api/shared-itineraries`): Public or private visibility (ITN-20), public search and read-only view for guests, and cloning into a private copy that credits the author (ITN-21).
- **Bonus, seat selection** (FLT-28): `GET` and `PATCH /api/flight-bookings/:id/seat`. Up to 3 picks per passenger, closes 24 hours before departure, remaining seats are auto-assigned.
- **Bonus, change flight** (FLT-27): `change-options`, `PATCH` and `DELETE /api/flight-bookings/:id/change-flight`. Same price or cheaper is applied at once (cheaper is refunded). A more expensive flight waits 10 minutes for payment of the difference.

## Hotels & Hotel Booking (Member 4)

- **Hotels** (`/api/hotels`): An admin creates a hotel and its moderator edits the profile and check-in and check-out times (HTL-01, HTL-09). The city must be in the seeded city list (GEN-12). Public details page (HTL-02). Photos with `POST` and `DELETE /api/hotels/:id/photos`, JPG or PNG, 5 MB, at most 5 (GEN-08). Tiers with `PUT /api/hotels/:id/policies` (HTL-10).
- **Rooms** (`/api/hotels/:id/rooms/...`): Add, edit, set bookable date ranges, block dates, deactivate or delete a room. Changes that touch a Confirmed or Pending reservation are rejected (HTL-03 to HTL-06). `GET /api/hotels/:id/availability` shows each room as Available, Booked (with reference) or Blocked (HTL-08).
- **Search** (`GET /api/hotels/search`, public): City or country, dates, guests, rooms, price and rating filters and sorting (HTL-11, HTL-12). `GET /api/hotels/:id/rooms/available` lists free rooms with the stay price (HTL-15).
- **Hotel bookings** (`/api/hotel-bookings`): Book several rooms in one reservation (HTL-16). A unique room-and-night lock prevents double booking. Rooms are held for 10 minutes and a job releases expired holds (HTL-18). Payments confirms the booking with a unique `HTL-` reference (HTL-17). Upcoming, Past and Cancelled lists (HTL-20).
- **Cancellation** (`GET .../refund-preview`, `POST .../cancel`): The user sees the refund, then cancels before check-in. The rooms are released and Payments creates the refund (HTL-21).
- **Moderator view** (`GET /api/hotels/:id/reservations`): Reservations of the moderator's own hotel only (HTL-22).
- **Bonus:** Link a booking to an itinerary day (ITN-27, `/api/itineraries/:id/days/:dayId/bookings`) and favourites (BON-02, `/api/favourites`).
- **Test helpers:** `test-confirm` and `test-complete` under `/api/hotel-bookings/:id/` (admin only) skip Stripe.

## Payments & Refunds (Member 5)

- **Payments** (`/api/payments`): Accept booking policies (PAY-01), create a payment 
  and Stripe PaymentIntent for a flight or hotel booking (PAY-02), retry a failed 
  payment (PAY-03), get a payment by id. Stripe webhook (`/api/payments/webhook`) 
  confirms bookings on successful payment and never trusts client-reported status.
- **Refunds** (`/api/refunds`): Get a refund by id (PAY-04). Refunds are issued 
  automatically on booking cancellation, respecting each booking's cancellation-tier 
  policy, and never require manual admin action.
- **Bonus, flight-change payments** (FLT-27 payment integration): 
  `POST /api/payments/flight-change` pays the fare difference when a confirmed flight 
  booking is changed to a pricier flight. A fare drop refunds automatically with no 
  payment step. An abandoned or expired pending change cancels its Stripe PaymentIntent. 
  Cancelling a booking with more than one payment (an original payment plus one or more 
  flight-change payments) splits the refund across all of them correctly.
- **Idempotency**: all Stripe PaymentIntent/Refund calls use per-flow idempotency keys 
  to prevent duplicate charges or refunds on retry or webhook redelivery.

## Itineraries & Integration (Member 6)

- **Itinerary CRUD** (`/api/itineraries`): Create, list, edit, and delete itineraries (ITN-01, ITN-03). Private by default. Enforces strict ownership (non-owners get 404).
- **Days Management** (`/api/itineraries/:id/days`): Add days (max 60), edit city/notes, delete days (auto-renumbers), and reorder days (ITN-05, 07, 08). Calendar dates are automatically calculated based on the itinerary start date.
- **Budget Subtotals** (ITN-09): Calculates `groupDayCount` and `groupBudgetSubtotal` for consecutive days in the same city using Member 3's `ItineraryBudgetService`.
- **Activities** (`/api/itineraries/:id/days/:dayId/activities`): Add, edit, and delete activities with optional costs (ITN-10). Requires a currency if a cost is provided.
- **Images** (`/api/itineraries/:id/days/:dayId/activities/:activityId/images`): Upload and remove JPG/PNG images for activities (ITN-12, GEN-08).
- **Integration Search**:
  - `GET /api/itineraries/:id/flights`: Search flights from the city of Day 1, including round-trip default dates (ITN-26).
  - `GET /api/itineraries/:id/hotels`: Search hotels for a specific contiguous city group's dates (ITN-25).
- **Admin Moderation**: Includes the `isHidden` boolean field (default false) on the schema for Member 7's admin dashboard (GEN-10).


## Blog and Community (Member 7)

- **Posts** (`/api/posts`): Create a post (BLG-01), get published posts with pagination/tag/keyword search (BLG-02), get own posts including drafts (BLG-03), update/delete own posts (BLG-04).
- **Comments** (`/api/posts/:id/comments`, `/api/comments`): Add a comment (BLG-05), edit/delete own comments (BLG-07).
- **Likes** (`/api/posts/:id/like`): Like/unlike a post (BLG-06).
- **Tags** (`/api/tags/:tag/posts`): Get posts by tag (BLG-08).
- **Rules**: Max 5 tags per post (max 30 chars each). Interaction score determines search ranking. Ownership checks prevent editing others' content.
- **Comments** (`/api/posts/:id/comments`, `/api/comments`): Add a comment to a published post (BLG-05), edit/delete own comments (BLG-07).
- **Likes** (`/api/posts/:id/like`): Like/unlike a post, preventing double likes at the DB level (BLG-06).
- **Authors** (`/api/authors/:id`): Public author page with name, join date, published posts, and public itineraries (BLG-12).
- **Images** (`/api/posts/:id/images`): Upload/delete images for a post (GEN-08, BLG-10). Max 5 JPG/PNG images, 5MB each. Shared `UploadsService` is available for other modules.

- **Reports & Moderation** (`/api/reports`, `/api/admin/reports`): Users can report content once (GEN-09). Admins can view open reports and resolve them by dismissing, hiding, or deleting the content (GEN-10). Admin actions are audited (GEN-07) and authors are notified.
- **Bonus (BLG-13)**: Attach an itinerary to a post (`PATCH /api/posts/:id/itinerary`).

- **Public Blog List** (`/blog`): Dynamic SSR page showing published posts, with keyword search and pagination (BLG-02, BLG-09).
- **Post Detail** (`/blog/[id]`): ISR page showing the full post content, tags, images, and metadata (BLG-02).
- **Post Detail** (`/blog/[id]`): ISR page showing the full post content, tags, images, and metadata (BLG-02).
- **Like Button**: Interactive Client Component allowing logged-in users to like/unlike a post (BLG-06).
- **Comments**: Interactive Client Component showing chronological comments, with add/edit/delete functionality for logged-in users (BLG-05, BLG-07).
- **Tag Page** (`/tags/[tag]`): Filtered view of all posts with a specific tag (BLG-08).
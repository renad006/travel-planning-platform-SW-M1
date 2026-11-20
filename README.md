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
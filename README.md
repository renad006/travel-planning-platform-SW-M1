# travel-planning-platform-SW-M1
# Travel Planning and Booking Platform

Software Project I, Winter 2026. Flight and hotel booking, itinerary planning and budgeting, and a travel blog.

**Stack:** NestJS (backend), MongoDB Atlas, Next.js (frontend, Milestone 2).

## Setup (Milestone 1, backend)
_To be completed before submission: install, create .env, run seed, start server, open Swagger._

1. Copy `.env.example` to `backend/.env` and fill in the values.
2. `cd backend` then `npm install`
3. Run the seed script (instructions to be added)
4. `npm run start:dev`
5. Swagger UI: http://localhost:3000/api/docs

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
-- Better Auth core tables, Stripe plugin columns/tables, database rate limiting.
-- Generated with scripts/print-auth-sql.mjs (better-auth 1.7.7).
create table if not exists "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null, "stripeCustomerId" text);
create table if not exists "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);
create table if not exists "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);
create table if not exists "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);
create table if not exists "subscription" ("id" text not null primary key, "plan" text not null, "referenceId" text not null, "stripeCustomerId" text, "stripeSubscriptionId" text, "status" text not null, "periodStart" date, "periodEnd" date, "trialStart" date, "trialEnd" date, "cancelAtPeriodEnd" integer, "cancelAt" date, "canceledAt" date, "endedAt" date, "seats" integer, "billingInterval" text, "stripeScheduleId" text);
create table if not exists "rateLimit" ("id" text not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);
create index if not exists "session_userId_idx" on "session" ("userId");
create index if not exists "account_userId_idx" on "account" ("userId");
create index if not exists "verification_identifier_idx" on "verification" ("identifier");
create index if not exists "subscription_referenceId_idx" on "subscription" ("referenceId");

-- Fireboard: Firestore projects a user has added. No credentials: data access
-- uses the user's own Google sign-in in their browser, or a local emulator.
create table if not exists "project" (
	"id" text not null,
	"userId" text not null references "user" ("id") on delete cascade,
	"name" text not null,
	"projectId" text not null,
	"credentialType" text not null check ("credentialType" in ('google', 'emulator')),
	"emulatorHost" text,
	"databases" text,
	"readOnly" integer not null default 0,
	"color" text,
	"createdAt" date not null,
	"updatedAt" date not null,
	primary key ("userId", "id")
);

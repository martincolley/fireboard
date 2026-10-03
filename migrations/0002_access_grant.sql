-- Users an admin (verified email in ALLOWED_EMAILS) has approved in the app.
create table if not exists "access_grant" (
	"userId" text not null primary key references "user" ("id") on delete cascade,
	"grantedBy" text not null,
	"createdAt" date not null
);

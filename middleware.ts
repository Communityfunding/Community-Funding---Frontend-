import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  // Forward public API reads; protected endpoints retain backend authorization.
  "/api/backend(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/projects-we-love(.*)",
  "/project(.*)",
  "/categories(.*)",
  "/about-us(.*)",
  "/how-it-works(.*)",
  "/faq(.*)",
  "/terms-of-service(.*)",
  "/privacy-notice(.*)",
  "/site-admin(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

# Use the new Sifter logo everywhere

## Changes
- Store the uploaded logo in the app’s managed media and create a compact square browser icon from it.
- Add one reusable clickable Sifter logo element that always links to the homepage.
- Replace the landing-page navigation/footer branding and existing shared header logo with the new image.
- Add the shared logo header to app, sign-in, admin, and fallback pages wherever it is not already present, without replacing feature-specific icons.
- Remove the old externally hosted logo and update the browser favicon reference.

## Verification
- Check every route at desktop and phone sizes for correct logo sizing, homepage navigation, and no overlap.
- Confirm the preview builds without errors.

## Technical details
- The full logo will be served through Lovable’s managed asset flow.
- The favicon will be a real optimized 64×64 PNG in `public/`, derived from the uploaded artwork.

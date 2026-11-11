This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

The opening workspace uses system monospace fonts (Cascadia Code, Consolas, and platform fallbacks), inspired by the supplied MonoLisa reference. No proprietary font files or build-time font downloads are included.

## Opening-page redesign

The measurement entry screen follows the supplied sketch: header, left navigation, two subject inputs, Start Measurement, and live device status. The palette uses #484548 and #8B0401. Background motion and animated button edges respect reduced-motion preferences. The introductory label, headline, and paragraph have been removed.

The entry screen is designed to fit a typical desktop viewport without scrolling. Received measurement results and the other analysis pages remain scrollable so all existing data remains accessible. On narrow screens navigation becomes a compact row.

The ESP32 endpoints, polling, sample processing, CSV export, firmware, Cell Analysis, Body Composition, and report components are preserved. Connect to the existing ESP32 access point at 192.168.4.1 to test a live sweep.

Install dependencies with `npm ci`. A production build can be checked with `npm run build -- --webpack`, then served with `npm start`. The ZIP excludes node_modules and generated build files.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

Body Composition has its own height, weight, profile and received sweep. Fill the profile, choose Measure & calculate, then review the result cards below. Reset inputs & results clears only this flow. Results use the existing random-input prediction model and are also available to Reports. Narrow navigation remains across the top; desktop navigation remains at the left.

Bluetooth is the default connection method. See BLUETOOTH.md for the ESP32-S3 sketch, upload steps, browser requirements and protocol. The earlier Wi-Fi sketch remains available as a fallback.

## Fitted models and result explanations

Cell Analysis and Reports include a constrained Cole fit, fit-quality checks, plain-language explanations and referenced comparison context. Body Composition includes adult BMI screening categories and a Janssen skeletal-muscle estimate alongside the existing fat and water outputs. Read MODEL-REPORTS.md for equations, eligibility, references and limitations. Current generated ESP32 values are demonstration data, not actual body assessments.


The refreshed visual treatment uses charcoal #353236 and vivid red #BD100B. Decorative particles drift behind every page; cards and controls show a subtle hover glow. Particles use CSS transforms with no continuous JavaScript work, fewer particles on narrow screens, and automatic background motion.

The background runs automatically; no Motion button is shown.

All base, sidebar, typography and ambient styles are loaded through app/workspace.css. layout.tsx imports this single complete stylesheet so the shell and effects are delivered together in development and production.


Reports are now written as an interpretation: frequency trend and slope, Cole response, model-fitting method, and composition results derived from the selected session. Raw readings and technical methods are collapsed. Electrode-placement forms and sections are omitted from reports. See SIMULATION-GUIDE.md for presentation notes and formulas.

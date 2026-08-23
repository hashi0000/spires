# IndexNow (Bing)

IndexNow tells Bing (and other participating engines) that specific canonical URLs have changed. Vercel has no built-in IndexNow support for this static site, so submission is a **manual / post-deploy** step. URLs are **not** submitted on ordinary page views.

## What is already in the repo

- Public key file: `/76942d39c903b508.txt` (must stay crawlable at `https://www.spires-taxis.com/76942d39c903b508.txt`)
- Submit script: `scripts/submit-indexnow.mjs`

The key file is public by design (search engines fetch it to verify you control the site). It is not an API secret. Do not put Stripe, Firebase or other private credentials in this file.

## Environment variable (optional)

```
INDEXNOW_KEY=76942d39c903b508
```

Set this in your shell or CI if you prefer not to read the key from the committed `.txt` file. The live verification file must still match.

## After a production deploy

1. Confirm the live key file: `https://www.spires-taxis.com/76942d39c903b508.txt`
2. From `spires-website/`:

```bash
npm run indexnow
```

That submits every URL in `sitemap.xml`.

To submit only pages you just changed:

```bash
node scripts/submit-indexnow.mjs https://www.spires-taxis.com/rates https://www.spires-taxis.com/offer-terms
```

Only `https://www.spires-taxis.com/...` URLs are accepted.

## Bing Webmaster Tools

After the first deploy, add the sitemap `https://www.spires-taxis.com/sitemap.xml` and use URL Inspection on `/rates`. IndexNow does not replace that checklist.

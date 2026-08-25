# PAYAMAKE

PAYAMAKE is a Persian-language static website for targeted SMS marketing, specialized phone-number databases, campaign execution, and consultation.

## Repository

This repository is the **production repository** for the PAYAMAKE website.

- Repository: `sgexir/PAYAMAKE`
- Branch: `main`
- Production domain: `https://payamake.ir`

The approved production baseline before this documentation update was commit:

`799916df8d46060fbc1ffb4fcade4e5bc71d10d6`

The separate test/staging repository is not the production source of truth.

## Project structure

```text
PAYAMAKE/
├── index.html
├── README.md
├── css/
│   ├── style.css
│   ├── blog.css
│   └── article.css
├── js/
│   └── main.js
├── blog/
│   ├── index.html
│   ├── sms-marketing-guide/index.html
│   ├── best-time-to-send-promotional-sms/index.html
│   └── how-to-write-promotional-sms/index.html
└── assets/
    ├── favicon.png
    ├── fonts/
    └── images/
```

## Main site

`index.html` contains the main PAYAMAKE landing page, including navigation, hero, solutions, database, pricing, features, trust/about content, contact modal, and footer.

The main stylesheet is `css/style.css` and shared interactive behavior is handled by `js/main.js`.

## Blog

The blog index is available at `/blog/` and currently contains three articles:

1. `/blog/sms-marketing-guide/`
2. `/blog/best-time-to-send-promotional-sms/`
3. `/blog/how-to-write-promotional-sms/`

Blog pages use shared site styles plus `blog.css` or `article.css` where appropriate.

## JavaScript

`js/main.js` handles the shared interactive functionality, including:

- pricing calculator
- contact modal and form
- contact form submission to the configured Cloudflare Worker
- validation and field limits
- dynamic footer content
- formatted footer phone number
- navigation behavior for nested blog pages

The initializer contains a guard so duplicate script loading cannot register duplicate event handlers.

## Contact form

The contact form sends submissions to the configured PAYAMAKE Cloudflare Worker endpoint. The Worker and its database are external services and are not part of this static repository.

Current Worker endpoint:

`https://payamake-contact.sgexir.workers.dev/`

## Footer

The footer is generated/updated dynamically by `js/main.js`. The displayed phone number is formatted for readability while the `tel:` target uses the normalized phone number.

The copyright year is generated dynamically as Persian Solar Hijri year / Gregorian year. The SGEX text links to the official SGEX website without changing its normal footer styling.

## Performance

The hero image uses the WebP asset `assets/images/hero/hero-payamake.webp` to reduce initial image weight. Article images are served as WebP and use lazy loading where appropriate.

## SEO

The site includes page titles, meta descriptions, canonical URLs, Open Graph metadata, Twitter Cards, structured data, `robots.txt`, and `sitemap.xml` where present in the deployed site.

The blog index includes structured data describing the article collection and its three articles.

Final production SEO verification should be performed after deployment, including canonical URLs, robots directives, sitemap accessibility, structured data, and indexability.

## Local development

This is a static website and does not require a build step. Serve the repository with any local static HTTP server to test relative paths and browser behavior correctly.

## Deployment

Production deployment targets:

`https://payamake.ir`

The production source of truth is the `main` branch of this repository. Deployments must use an explicitly approved commit from `main`.

Before and after production deployment, verify:

1. The intended `main` commit is being deployed.
2. The site loads correctly over HTTPS.
3. Home, Blog, and all three article pages are accessible.
4. CSS, JavaScript, images, fonts, and relative paths load correctly.
5. Navigation works across root and nested blog pages.
6. Pricing calculator and contact modal work correctly.
7. Contact form submission reaches the configured Cloudflare Worker.
8. Footer, phone link, and SGEX link work correctly.
9. Production SEO endpoints and metadata are accessible.

## GitHub Actions

GitHub Actions is not used for deployment in this project. Do not add `.github/workflows` unless explicitly requested.

## Future development

Planned product development after the production launch includes:

1. Integration of a second SMS provider/panel.
2. A secure administration panel.
3. Management of articles, pricing, site content, and campaigns through the administration layer.

Future backend and administration work must use appropriate authentication, authorization, API boundaries, data storage, provider abstraction, error handling, and security controls.

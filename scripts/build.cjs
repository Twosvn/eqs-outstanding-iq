'use strict';
const fs = require('node:fs');
const path = require('node:path');
function build(source = path.resolve(__dirname, '..'), output = path.join(source, 'dist')) {
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const entry of ['index.html', '404.html', 'styles.css', 'components.js', 'css', 'js', 'assets', 'blog', 'payment-check', 'robots.txt', 'debt-collection-birmingham', 'debt-collection-bristol', 'debt-collection-leeds', 'debt-collection-london', 'debt-collection-manchester', 'ecommerce-debt-recovery', 'fashion-debt-recovery', 'logistics-debt-recovery', 'shopify-wholesale-debt-recovery']) {
    if (fs.existsSync(path.join(source, entry))) fs.cpSync(path.join(source, entry), path.join(output, entry), { recursive: true });
  }
  const sitemap = fs.readFileSync(path.join(source, 'sitemap.xml'), 'utf8');
  fs.writeFileSync(path.join(output,'sitemap-static.xml'),sitemap);
  fs.writeFileSync(path.join(output,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://fynrec.com/sitemap-static.xml</loc></sitemap><sitemap><loc>https://fynrec.com/payment-check/sitemap.xml</loc></sitemap></sitemapindex>');
  fs.rmSync(path.join(output,'payment-check','reviews.json'),{force:true});
  console.log('Built Fynrec site. Payment reports are served from the approved database view; server code and private files are excluded.');
}
module.exports = { build };
if (require.main === module) build();

(function () {
  var NAV = [
    '<nav>',
    '  <div class="nav-left">',
    '    <a href="/" class="nav-brand">Fynrec</a>',
    '    <div class="nav-links">',
    '      <a href="/#how-it-works">How it works</a>',
    '      <a href="/#sectors">Sectors</a>',
    '      <a href="/#pricing">Pricing</a>',
    '      <a href="/blog/">Blog</a>',
    '    </div>',
    '  </div>',
    '  <div class="nav-right">',
    '    <a href="https://wa.me/447765875615" class="nav-whatsapp" target="_blank" rel="noopener" aria-label="WhatsApp us">',
    '      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.553 4.1 1.518 5.824L.057 23.571a.5.5 0 0 0 .614.612l5.857-1.53A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.878 9.878 0 0 1-5.032-1.374l-.36-.214-3.733.976.999-3.648-.235-.374A9.861 9.861 0 0 1 2.118 12C2.118 6.533 6.533 2.118 12 2.118c5.466 0 9.882 4.415 9.882 9.882 0 5.466-4.416 9.882-9.882 9.882z"/></svg>',
    '    </a>',
    '    <div class="nav-phone"><span>Call us</span> 07765 875615</div>',
    '    <a href="/#audit" class="nav-cta">Free Audit</a>',
    '  </div>',
    '</nav>'
  ].join('\n');

  var FOOTER = [
    '<footer>',
    '  <div class="footer-inner">',
    '    <div class="footer-brand-col">',
    '      <a href="/" class="footer-brand">Fynrec</a>',
    '      <p class="footer-tagline">Contingency-only B2B debt recovery. Nothing to pay until we collect.</p>',
    '      <div class="footer-contact">',
    '        <a href="tel:+447765875615">07765 875615</a>',
    '        <a href="https://wa.me/447765875615" target="_blank" rel="noopener">WhatsApp</a>',
    '        <a href="mailto:hello@fynrec.co.uk">hello@fynrec.co.uk</a>',
    '      </div>',
    '    </div>',
    '    <div class="footer-col">',
    '      <p class="footer-col-title">Sectors</p>',
    '      <a href="/#sectors">Recruitment</a>',
    '      <a href="/#sectors">Construction</a>',
    '      <a href="/#sectors">Legal</a>',
    '      <a href="/logistics-debt-recovery/">Logistics &amp; Haulage</a>',
    '      <a href="/ecommerce-debt-recovery/">E-commerce</a>',
    '      <a href="/fashion-debt-recovery/">Fashion &amp; Clothing</a>',
    '      <a href="/shopify-wholesale-debt-recovery/">Shopify Wholesale</a>',
    '    </div>',
    '    <div class="footer-col">',
    '      <p class="footer-col-title">Locations</p>',
    '      <a href="/debt-collection-london/">London</a>',
    '      <a href="/debt-collection-manchester/">Manchester</a>',
    '      <a href="/debt-collection-birmingham/">Birmingham</a>',
    '      <a href="/debt-collection-leeds/">Leeds</a>',
    '      <a href="/debt-collection-bristol/">Bristol</a>',
    '    </div>',
    '    <div class="footer-col">',
    '      <p class="footer-col-title">Company</p>',
    '      <a href="/blog/">Blog</a>',
    '      <a href="/#how-it-works">How it works</a>',
    '      <a href="/#pricing">Pricing</a>',
    '      <a href="/#audit">Free Audit</a>',
    '      <a href="/privacy-policy/">Privacy Policy</a>',
    '      <a href="/terms/">Terms</a>',
    '    </div>',
    '  </div>',
    '  <div class="footer-bottom">',
    '    <p class="footer-legal">Fynrec Ltd &nbsp;&middot;&nbsp; Registered in England and Wales &nbsp;&middot;&nbsp; ICO Registered &nbsp;&middot;&nbsp; CICM Member &nbsp;&middot;&nbsp; B2B commercial debt only</p>',
    '  </div>',
    '</footer>'
  ].join('\n');

  var navEl = document.getElementById('site-nav');
  var footerEl = document.getElementById('site-footer');

  if (navEl) navEl.outerHTML = NAV;
  if (footerEl) footerEl.outerHTML = FOOTER;
})();

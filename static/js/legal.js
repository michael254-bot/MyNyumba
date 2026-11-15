/* legal.js — Terms of use and Privacy policy pages
   Plain-language drafts written for a Kenyan rental marketplace. Have them
   reviewed by a Kenyan advocate before relying on them. */
const Legal = (() => {
  const UPDATED  = '15 November 2026';
  const EMAIL    = 'michaelmalaba3634@gmail.com';
  const WHATSAPP = '+254 703 245 513';

  function shell(active, title, body) {
    document.getElementById('app').innerHTML = `
    <article class="legal">
      <nav class="legal-nav" aria-label="Legal">
        <a href="/terms" class="${active === 'terms' ? 'active' : ''}" onclick="Router.go('terms');return false;">Terms of use</a>
        <a href="/privacy" class="${active === 'privacy' ? 'active' : ''}" onclick="Router.go('privacy');return false;">Privacy policy</a>
      </nav>
      <h1>${title}</h1>
      <p class="legal-updated">Last updated ${UPDATED}</p>
      ${body}
    </article>
    ${Pages.footer ? Pages.footer() : ''}`;
  }

  function contact() {
    return `<a href="mailto:${EMAIL}">${EMAIL}</a> or WhatsApp <a href="https://wa.me/254703245513" target="_blank" rel="noopener">${WHATSAPP}</a>`;
  }

  function terms() {
    shell('terms', 'Terms of use', `
      <p>These terms cover your use of MyNyumba ("MyNyumba", "we", "us"), the website that lists rental houses in Kenya. By creating an account or paying to unlock a listing, you agree to them. If you don't agree, please don't use the site.</p>

      <h2>What MyNyumba does</h2>
      <p>Landlords list houses for free. Anyone can browse the photos, rent, deposit and amenities for free. To get a landlord's phone number, WhatsApp and the house's street address, a tenant pays a one-time fee of Ksh 500 for that house.</p>
      <p>We are a listings service. We are not a real estate agent, we don't own or manage the houses, and we are not a party to any tenancy agreement between you and a landlord. Viewing, negotiating, signing, paying rent and deposits all happen directly between you and the landlord.</p>

      <h2>Accounts</h2>
      <ul>
        <li>You must be 18 or older and give accurate details, including a phone number you use.</li>
        <li>Keep your password private. You're responsible for what happens under your account.</li>
        <li>One person, one account. Landlords who also rent need a separate tenant account.</li>
      </ul>

      <h2>The Ksh 500 unlock fee</h2>
      <ul>
        <li>The fee is per house and is paid once. It gives you that landlord's contact details and the address for that house only. It can't be moved to another house or another person.</li>
        <li>You normally pay through an M-Pesa prompt (STK push) sent to your phone. You're only charged if you enter your M-Pesa PIN.</li>
        <li>If the prompt doesn't work, you can pay by M-Pesa Send Money to the number shown in the payment window and enter the M-Pesa code. We unlock the house once we've matched the code to our M-Pesa statement. Each code can be used once. Submitting a code you didn't pay with is fraud, and we will close the account.</li>
        <li>Once a house is unlocked, the details stay in your account under "Unlocked houses", even after the house is let.</li>
      </ul>

      <h2>Refunds</h2>
      <p>Because you get the contact details straight away, the fee isn't refundable just because you changed your mind or didn't like the house. We will refund the Ksh 500, or unlock another house of your choice for free, if within 7 days of paying you report through the "Already taken or wrong number?" link that:</p>
      <ul>
        <li>the house was already let before you paid, or</li>
        <li>the phone number doesn't belong to the landlord or never connects,</li>
      </ul>
      <p>and we can confirm it with the landlord or from other reports. Refunds go back to the M-Pesa number you paid from. If you were charged but the house didn't unlock, contact us with the M-Pesa SMS and we'll fix it.</p>

      <h2>If you're a landlord</h2>
      <ul>
        <li>Only list houses you own or have the right to let, and only houses that are actually vacant or about to be.</li>
        <li>Use real, recent photos of that house, the real rent and deposit, and an honest description.</li>
        <li>Mark the house as let as soon as it's taken. Confirm it's still available when the dashboard asks. Listings that aren't confirmed for 37 days are hidden, and houses that tenants report as taken may be hidden until you confirm.</li>
        <li>The phone number on your profile is what paying tenants receive. Keep it correct and answer it.</li>
        <li>Never ask a tenant to pay a deposit, "viewing fee" or "booking fee" before they have viewed the house in person.</li>
      </ul>

      <h2>Safety: please read before paying anyone</h2>
      <ul>
        <li>Always view a house in person before paying rent or a deposit.</li>
        <li>Pay rent and deposits to the landlord or their registered agent, and get a receipt or a signed tenancy agreement.</li>
        <li>Be careful with anyone who pressures you to pay quickly, refuses a viewing, or asks for money for a house that's "almost taken".</li>
        <li>Report suspicious listings to us straight away.</li>
      </ul>

      <h2>Not allowed</h2>
      <ul>
        <li>Fake, duplicate or misleading listings, or listing a house you don't control.</li>
        <li>Collecting money from tenants for houses that aren't available.</li>
        <li>Copying landlords' contact details out of MyNyumba to resell or publish them.</li>
        <li>Scraping the site, overloading it, or trying to get around the payment or security.</li>
        <li>Harassing landlords, tenants or our team.</li>
      </ul>
      <p>We can remove listings, hide content, or suspend or close accounts that break these terms, without a refund where the account was used for fraud.</p>

      <h2>Reviews</h2>
      <p>Only tenants who unlocked a house can review it. Keep reviews honest and about the house and landlord. We may remove reviews that are abusive, fake or unrelated.</p>

      <h2>Our responsibility</h2>
      <p>We check listings that are reported to us, but we can't inspect every house or verify every landlord. Listings are provided by landlords, and we don't guarantee that a house is available, matches its description, or that a landlord will agree to rent to you. As far as Kenyan law allows, our total liability to you for anything related to MyNyumba is limited to the unlock fees you paid us in the 3 months before the problem. Nothing in these terms limits rights you have under the Consumer Protection Act, 2012 that can't be limited.</p>

      <h2>Changes</h2>
      <p>We may update these terms. If the change is significant, we'll show a notice on the site. Using MyNyumba after a change means you accept the updated terms.</p>

      <h2>Law and disputes</h2>
      <p>These terms are governed by the laws of Kenya. If something goes wrong, contact us first and we'll try to sort it out. Disputes that can't be resolved go to the courts of Kenya.</p>

      <h2>Contact</h2>
      <p>${contact()}.</p>
    `);
  }

  function privacy() {
    shell('privacy', 'Privacy policy', `
      <p>This policy explains what personal data MyNyumba collects, why, who sees it, and your rights under Kenya's Data Protection Act, 2019. MyNyumba is the data controller for the data described here.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email address, phone number and password (stored encrypted by our login provider). Optionally your town and ID or passport number.</li>
        <li><strong>Listings (landlords):</strong> the house details, street address, photos and videos you upload.</li>
        <li><strong>Payments:</strong> the M-Pesa number you pay from, the M-Pesa receipt or transaction code, the amount and the time. We never see or store your M-Pesa PIN.</li>
        <li><strong>Activity:</strong> which houses you unlocked, reviews and reports you post, and listing view counts.</li>
        <li><strong>Technical data:</strong> your IP address and browser details in our server logs, used for security and to stop abuse.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run your account and the service you asked for (our contract with you).</li>
        <li>To process unlock payments and send the M-Pesa prompt (contract).</li>
        <li>To give a tenant who has paid the landlord's name, phone, email and the house's street address. This is the core of the service, and landlords agree to it when they list.</li>
        <li>To keep MyNyumba safe: preventing fraud and fake listings, rate-limiting abuse, and checking reports (our legitimate interest).</li>
        <li>To meet legal obligations, for example keeping payment records.</li>
      </ul>
      <p>We don't sell your data, and we don't use advertising or tracking cookies.</p>

      <h2>Who can see what</h2>
      <ul>
        <li><strong>Everyone:</strong> listing photos, rent, deposit, area and amenities, plus a reviewer's first name and review.</li>
        <li><strong>Tenants who paid for a house:</strong> that landlord's name, phone, email and the house's street address.</li>
        <li><strong>Landlords:</strong> their own listings, views and unlock counts. Landlords don't receive tenants' contact details from us.</li>
        <li><strong>The MyNyumba admin:</strong> account and listing details, including optional ID numbers, payment records and reports, to run and protect the service.</li>
      </ul>

      <h2>Service providers</h2>
      <p>We use these companies to run MyNyumba. They process data only on our instructions:</p>
      <ul>
        <li><strong>Supabase:</strong> database, login and photo/video storage.</li>
        <li><strong>PayHero and Safaricom M-Pesa:</strong> payment prompts and confirmations.</li>
        <li><strong>Render and Contabo:</strong> web hosting.</li>
        <li><strong>Google Fonts:</strong> serves the site's typeface, which means your browser connects to Google.</li>
      </ul>
      <p>Some of these providers store data on servers outside Kenya. Where that happens, we rely on their security and contractual safeguards as the Data Protection Act requires.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account data: while your account is open, and up to 12 months after you ask us to close it, unless we need it for a dispute.</li>
        <li>Payment records: up to 7 years, for accounting and tax purposes.</li>
        <li>Listings: hidden or let listings are archived, and you can ask us to delete them at any time.</li>
        <li>Server logs: up to 90 days.</li>
      </ul>

      <h2>Your rights</h2>
      <p>Under the Data Protection Act, 2019, you can ask to see the personal data we hold about you, correct it, delete it, object to how we use it, or get a copy of it. You can edit most details yourself on your Profile page. For anything else, contact us and we'll respond within 21 days. If you're not happy with our answer, you can complain to the Office of the Data Protection Commissioner (<a href="https://www.odpc.go.ke" target="_blank" rel="noopener">odpc.go.ke</a>).</p>

      <h2>Storage on your device</h2>
      <p>We keep your login session in your browser's local storage so you stay logged in. Clearing your browser data or logging out removes it. We don't use advertising or analytics cookies.</p>

      <h2>Security</h2>
      <p>Connections are encrypted (HTTPS), passwords are handled by our login provider and never stored in plain text, access to personal data is limited to what each person needs, and payments are verified with the payment provider before anything unlocks. No system is perfect. If we discover a breach that affects you, we'll tell you and the Data Protection Commissioner as the law requires.</p>

      <h2>Children</h2>
      <p>MyNyumba is for adults. We don't knowingly collect data from anyone under 18.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a significant way, we'll show a notice on the site.</p>

      <h2>Contact</h2>
      <p>For privacy questions or requests: ${contact()}.</p>
    `);
  }

  return { terms, privacy };
})();

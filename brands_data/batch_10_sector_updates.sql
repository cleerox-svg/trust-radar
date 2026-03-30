-- Batch 10: Update existing unclassified brands with sectors
-- These are brands already in the DB but missing sector classification

-- TECH
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'google.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'microsoft.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'apple.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'facebook.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'twitter.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'x.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'linkedin.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'whatsapp.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'telegram.org' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'tiktok.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'snapchat.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'pinterest.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'reddit.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'discord.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'zoom.us' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'slack.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'dropbox.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'docusign.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'atlassian.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'salesforce.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'oracle.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'adobe.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'cisco.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'vmware.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'dell.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'hp.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'ibm.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'nvidia.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'okta.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'crowdstrike.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'cloudflare.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'github.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'gitlab.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'openai.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'anthropic.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'spotify.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'youtube.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'tech' WHERE canonical_domain = 'sap.com' AND (sector IS NULL OR sector = '');

-- BANKING/FINTECH
UPDATE brands SET sector = 'banking' WHERE canonical_domain = 'paypal.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'banking' WHERE canonical_domain = 'americanexpress.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'banking' WHERE canonical_domain = 'visa.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'banking' WHERE canonical_domain = 'mastercard.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'banking' WHERE canonical_domain = 'stripe.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'banking' WHERE canonical_domain = 'wise.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'banking' WHERE canonical_domain = 'revolut.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'banking' WHERE canonical_domain = 'venmo.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'banking' WHERE canonical_domain = 'klarna.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'banking' WHERE canonical_domain = 'cash.app' AND (sector IS NULL OR sector = '');

-- ECOMMERCE
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'amazon.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'ebay.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'walmart.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'target.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'costco.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'homedepot.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'lowes.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'etsy.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'shopify.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'aliexpress.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'alibaba.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'temu.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'ecommerce' WHERE canonical_domain = 'shein.com' AND (sector IS NULL OR sector = '');

-- CRYPTO
UPDATE brands SET sector = 'crypto' WHERE canonical_domain = 'coinbase.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'crypto' WHERE canonical_domain = 'metamask.io' AND (sector IS NULL OR sector = '');

-- TELECOM
UPDATE brands SET sector = 'telecom' WHERE canonical_domain = 'att.com' AND (sector IS NULL OR sector = '');

-- TRAVEL
UPDATE brands SET sector = 'travel' WHERE canonical_domain = 'booking.com' AND (sector IS NULL OR sector = '');
UPDATE brands SET sector = 'travel' WHERE canonical_domain = 'southwest.com' AND (sector IS NULL OR sector = '');

-- ENTERTAINMENT
UPDATE brands SET sector = 'entertainment' WHERE canonical_domain = 'netflix.com' AND (sector IS NULL OR sector = '');

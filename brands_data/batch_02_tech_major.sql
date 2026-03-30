-- Batch 02: Tech Major (50 brands)

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_microsoft_com', 'Microsoft', 'microsoft.com', 'tech', 'curated', '["microsoft","outlook","office 365","microsoft login","ms office","onedrive","teams"]', '["micr0soft","mlcrosoft","microsft","micosoft"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_google_com', 'Google', 'google.com', 'tech', 'curated', '["google","gmail","google login","google drive","google workspace"]', '["g00gle","googIe","go0gle","goog1e"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_apple_com', 'Apple', 'apple.com', 'tech', 'curated', '["apple","icloud","apple id","apple login","itunes"]', '["app1e","appIe","4pple"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_facebook_com', 'Meta', 'facebook.com', 'tech', 'curated', '["facebook","meta","fb","facebook login","instagram"]', '["faceb00k","facebok","faceb0ok","facebk"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_aws_amazon_com', 'Amazon AWS', 'aws.amazon.com', 'tech', 'curated', '["aws","amazon web services","aws login","aws console"]', '["4ws","amaz0n-aws"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_salesforce_com', 'Salesforce', 'salesforce.com', 'tech', 'curated', '["salesforce","sfdc","salesforce login"]', '["sa1esforce","salesf0rce"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_oracle_com', 'Oracle', 'oracle.com', 'tech', 'curated', '["oracle","oracle cloud","oracle login"]', '["0racle","orac1e"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_sap_com', 'SAP', 'sap.com', 'tech', 'curated', '["sap","sap erp","sap login"]', '["s4p","s-a-p"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_adobe_com', 'Adobe', 'adobe.com', 'tech', 'curated', '["adobe","adobe login","creative cloud","photoshop","acrobat"]', '["ad0be","adob3"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_zoom_us', 'Zoom', 'zoom.us', 'tech', 'curated', '["zoom","zoom meeting","zoom login","zoom video"]', '["z00m","zo0m"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_slack_com', 'Slack', 'slack.com', 'tech', 'curated', '["slack","slack app","slack login"]', '["s1ack","sl4ck"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_dropbox_com', 'Dropbox', 'dropbox.com', 'tech', 'curated', '["dropbox","dropbox login","dropbox storage"]', '["dr0pbox","dropb0x"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_docusign_com', 'DocuSign', 'docusign.com', 'tech', 'curated', '["docusign","docu sign","docusign login","e-signature"]', '["d0cusign","docusIgn","docu-sign"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_atlassian_com', 'Atlassian', 'atlassian.com', 'tech', 'curated', '["atlassian","jira","confluence","bitbucket","atlassian login"]', '["at1assian","atlass1an"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_servicenow_com', 'ServiceNow', 'servicenow.com', 'tech', 'curated', '["servicenow","service now","snow login"]', '["serv1cenow","service-now"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_okta_com', 'Okta', 'okta.com', 'tech', 'curated', '["okta","okta login","okta sso"]', '["0kta","okt4"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_crowdstrike_com', 'CrowdStrike', 'crowdstrike.com', 'tech', 'curated', '["crowdstrike","crowd strike","falcon"]', '["cr0wdstrike","crowdstr1ke"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_paloaltonetworks_com', 'Palo Alto Networks', 'paloaltonetworks.com', 'tech', 'curated', '["palo alto","palo alto networks","pan","prisma"]', '["pa1oalto","paloalto-networks"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_fortinet_com', 'Fortinet', 'fortinet.com', 'tech', 'curated', '["fortinet","fortigate","fortiguard"]', '["f0rtinet","fort1net"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_cisco_com', 'Cisco', 'cisco.com', 'tech', 'curated', '["cisco","cisco webex","cisco login","meraki"]', '["c1sco","cisc0"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_vmware_com', 'VMware', 'vmware.com', 'tech', 'curated', '["vmware","vsphere","vmware login"]', '["vmw4re","vm-ware"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_dell_com', 'Dell', 'dell.com', 'tech', 'curated', '["dell","dell technologies","dell login"]', '["de11","d3ll"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_hp_com', 'HP', 'hp.com', 'tech', 'curated', '["hp","hewlett packard","hp login"]', '["h-p","hewlett-packard"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_ibm_com', 'IBM', 'ibm.com', 'tech', 'curated', '["ibm","ibm cloud","ibm login"]', '["1bm","lbm"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_intel_com', 'Intel', 'intel.com', 'tech', 'curated', '["intel","intel corporation"]', '["inte1","lntel"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_nvidia_com', 'NVIDIA', 'nvidia.com', 'tech', 'curated', '["nvidia","geforce","nvidia login"]', '["nv1dia","nvldia"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_qualcomm_com', 'Qualcomm', 'qualcomm.com', 'tech', 'curated', '["qualcomm","snapdragon"]', '["qua1comm","qualc0mm"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_twitter_com', 'Twitter', 'twitter.com', 'tech', 'curated', '["twitter","x","tweet","twitter login"]', '["tw1tter","twltter"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_linkedin_com', 'LinkedIn', 'linkedin.com', 'tech', 'curated', '["linkedin","linked in","linkedin login"]', '["l1nkedin","linkedln","1inkedin"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_whatsapp_com', 'WhatsApp', 'whatsapp.com', 'tech', 'curated', '["whatsapp","whats app","wa","whatsapp web"]', '["whatsa0p","whatsap","what5app"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_telegram_org', 'Telegram', 'telegram.org', 'tech', 'curated', '["telegram","telegram app","tg"]', '["te1egram","telegr4m"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_signal_org', 'Signal', 'signal.org', 'tech', 'curated', '["signal","signal app","signal messenger"]', '["s1gnal","signa1"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_tiktok_com', 'TikTok', 'tiktok.com', 'tech', 'curated', '["tiktok","tik tok","tiktok login"]', '["t1ktok","tiktok","tlktok"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_snapchat_com', 'Snapchat', 'snapchat.com', 'tech', 'curated', '["snapchat","snap","snapchat login"]', '["sn4pchat","snapch4t"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_pinterest_com', 'Pinterest', 'pinterest.com', 'tech', 'curated', '["pinterest","pin","pinterest login"]', '["p1nterest","plnterest"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_reddit_com', 'Reddit', 'reddit.com', 'tech', 'curated', '["reddit","reddit login","subreddit"]', '["redd1t","reddlt"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_discord_com', 'Discord', 'discord.com', 'tech', 'curated', '["discord","discord app","discord login"]', '["d1scord","disc0rd"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_twitch_tv', 'Twitch', 'twitch.tv', 'tech', 'curated', '["twitch","twitch tv","twitch login"]', '["tw1tch","twltch"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_spotify_com', 'Spotify', 'spotify.com', 'entertainment', 'curated', '["spotify","spotify login","spotify premium"]', '["sp0tify","spotlfy"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_netflix_com', 'Netflix', 'netflix.com', 'entertainment', 'curated', '["netflix","netflix login","netflix account"]', '["netf1ix","netfllx","n3tflix"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_disneyplus_com', 'Disney+', 'disneyplus.com', 'entertainment', 'curated', '["disney+","disney plus","disneyplus","disney login"]', '["d1sney","disn3y","disney-plus"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_hulu_com', 'Hulu', 'hulu.com', 'entertainment', 'curated', '["hulu","hulu login","hulu streaming"]', '["hu1u","hul0"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_max_com', 'Max', 'max.com', 'entertainment', 'curated', '["max","hbo max","hbo","max login"]', '["hb0max","hbo-max"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_paramountplus_com', 'Paramount+', 'paramountplus.com', 'entertainment', 'curated', '["paramount+","paramount plus","paramount login"]', '["param0unt","paramount-plus"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_youtube_com', 'YouTube', 'youtube.com', 'tech', 'curated', '["youtube","yt","youtube login"]', '["y0utube","youtub3","you-tube"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_github_com', 'GitHub', 'github.com', 'tech', 'curated', '["github","git hub","github login"]', '["g1thub","glthub","gith0b"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

INSERT INTO brands (id, name, canonical_domain, sector, source, brand_keywords, aliases, monitoring_status)
VALUES ('brand_gitlab_com', 'GitLab', 'gitlab.com', 'tech', 'curated', '["gitlab","git lab","gitlab login"]', '["g1tlab","gitl4b"]', 'active')
ON CONFLICT (canonical_domain) DO UPDATE SET sector = COALESCE(excluded.sector, brands.sector), brand_keywords = COALESCE(excluded.brand_keywords, brands.brand_keywords), aliases = COALESCE(excluded.aliases, brands.aliases), monitoring_status = 'active', source = CASE WHEN brands.source = 'auto' THEN 'curated' ELSE brands.source END;

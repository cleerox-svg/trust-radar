export function renderHomepage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trust Radar — AI-Powered Brand Threat Intelligence</title>
<meta name="description" content="Five AI agents watch the internet's attack surface continuously. Get a free Trust Score for your domain — no signup required."/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg-void:#040810;--bg-surface:#0a1020;--bg-panel:#0d1528;--bg-elevated:#111d35;--blue-primary:#00d4ff;--blue-muted:#0091b3;--blue-glow:rgba(0,212,255,.08);--blue-border:rgba(0,212,255,.15);--blue-border-bright:rgba(0,212,255,.35);--threat-critical:#ff3b5c;--threat-high:#ff6b35;--threat-medium:#ffb627;--positive:#00e5a0;--positive-muted:rgba(0,229,160,.12);--negative:#ff3b5c;--purple:#b388ff;--text-primary:#e8edf5;--text-secondary:#7a8ba8;--text-tertiary:#4a5a73;--text-accent:#00d4ff;--font-display:'Chakra Petch',sans-serif;--font-body:'Outfit',sans-serif;--font-mono:'IBM Plex Mono',monospace;--radius:6px;--radius-lg:10px}
*{margin:0;padding:0;box-sizing:border-box}html{background:var(--bg-void);color:var(--text-primary);font-family:var(--font-body);scroll-behavior:smooth}

/* NAV */
.pub-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:14px 40px;background:rgba(4,8,16,.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--blue-border)}
.pub-logo{font-family:var(--font-display);font-weight:700;font-size:18px;letter-spacing:2px;text-transform:uppercase;display:flex;align-items:center;gap:10px}
.pub-logo span{color:var(--blue-primary)}
.logo-dot{width:24px;height:24px;border-radius:50%;border:2px solid var(--blue-primary);display:flex;align-items:center;justify-content:center}.logo-dot::after{content:'';width:6px;height:6px;border-radius:50%;background:var(--blue-primary);animation:pc 2s ease-in-out infinite}
@keyframes pc{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.5)}}
.pub-nav-links{display:flex;gap:24px;align-items:center}
.pub-nav-links a{font-size:13px;color:var(--text-secondary);text-decoration:none;transition:color .15s}.pub-nav-links a:hover{color:var(--text-primary)}
.login-btn{font-family:var(--font-display);font-size:11px;font-weight:600;padding:7px 18px;border-radius:var(--radius);border:1px solid var(--blue-border-bright);background:var(--bg-panel);color:var(--blue-primary);cursor:pointer;text-decoration:none;transition:all .15s}.login-btn:hover{background:var(--bg-elevated);transform:translateY(-1px)}

/* HERO */
.hero{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:120px 40px 80px;position:relative;overflow:hidden}
.hero-bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(0,212,255,.04) 0%,transparent 70%)}
.hero-content{position:relative;z-index:2;max-width:720px}
.hero-tag{font-family:var(--font-mono);font-size:11px;letter-spacing:2px;color:var(--blue-muted);margin-bottom:16px;text-transform:uppercase}
.hero-h1{font-family:var(--font-display);font-size:48px;font-weight:700;line-height:1.15;margin-bottom:20px}
.hero-h1 span{color:var(--blue-primary)}
.hero-p{font-size:18px;color:var(--text-secondary);line-height:1.6;max-width:580px;margin:0 auto 36px}

/* SCAN INPUT */
.scan-box{display:flex;gap:0;max-width:520px;margin:0 auto;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--blue-border-bright);background:var(--bg-panel);transition:border-color .2s}
.scan-box:focus-within{border-color:var(--blue-primary);box-shadow:0 0 30px rgba(0,212,255,.1)}
.scan-input{flex:1;font-family:var(--font-body);font-size:15px;padding:14px 18px;border:none;background:transparent;color:var(--text-primary);outline:none}
.scan-input::placeholder{color:var(--text-tertiary)}
.scan-btn{font-family:var(--font-display);font-size:12px;font-weight:600;letter-spacing:1px;padding:14px 28px;border:none;background:var(--blue-primary);color:var(--bg-void);cursor:pointer;transition:all .15s;text-transform:uppercase}
.scan-btn:hover{background:#33dfff}
.scan-btn:disabled{opacity:.5;cursor:not-allowed}
.scan-hint{font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);margin-top:10px}

/* AGENT SHOWCASE */
.agents-section{padding:80px 40px;text-align:center}
.section-tag{font-family:var(--font-mono);font-size:10px;letter-spacing:2px;color:var(--blue-muted);text-transform:uppercase;margin-bottom:8px}
.section-title{font-family:var(--font-display);font-size:28px;font-weight:700;margin-bottom:12px}
.section-sub{font-size:14px;color:var(--text-secondary);max-width:500px;margin:0 auto 40px;line-height:1.5}
.agents-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;max-width:1100px;margin:0 auto}
@media(max-width:900px){.agents-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.agents-grid{grid-template-columns:1fr}}
.agent-card{background:var(--bg-surface);border:1px solid var(--blue-border);border-radius:var(--radius-lg);padding:20px 16px;text-align:center;transition:all .2s}
.agent-card:hover{border-color:var(--ag-color,var(--blue-border-bright));transform:translateY(-2px)}
.ag-icon{font-size:28px;margin-bottom:10px}
.ag-name{font-family:var(--font-display);font-size:13px;font-weight:700;margin-bottom:4px}
.ag-role{font-size:10px;color:var(--text-secondary);line-height:1.5}

/* HOW IT WORKS */
.how-section{padding:80px 40px;background:var(--bg-surface)}
.steps{display:flex;gap:24px;max-width:900px;margin:0 auto}
@media(max-width:640px){.steps{flex-direction:column}}
.step{flex:1;text-align:center;position:relative}
.step::after{content:'\\2192';position:absolute;right:-16px;top:30px;font-size:18px;color:var(--text-tertiary)}.step:last-child::after{display:none}
@media(max-width:640px){.step::after{display:none}}
.step-num{font-family:var(--font-display);font-size:32px;font-weight:700;color:var(--blue-primary);opacity:.3;margin-bottom:4px}
.step-title{font-family:var(--font-display);font-size:14px;font-weight:700;margin-bottom:6px}
.step-desc{font-size:12px;color:var(--text-secondary);line-height:1.5}

/* RESULTS */
#results-section{display:none;padding:80px 40px;text-align:center}
#results-section.visible{display:block}

.result-card{max-width:600px;margin:0 auto;background:var(--bg-surface);border:1px solid var(--blue-border);border-radius:var(--radius-lg);padding:36px;position:relative}
.result-domain{font-family:var(--font-mono);font-size:14px;color:var(--text-secondary);margin-bottom:20px}
.score-ring{width:140px;height:140px;margin:0 auto 16px;position:relative}
.score-ring svg{width:140px;height:140px}
.score-val{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:var(--font-display);font-weight:700;font-size:42px}
.score-grade{font-family:var(--font-display);font-size:20px;font-weight:700;margin-bottom:8px}
.score-summary{font-size:13px;color:var(--text-secondary);line-height:1.5;max-width:400px;margin:0 auto 20px}

.risk-pills{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
.risk-p{font-family:var(--font-mono);font-size:9px;padding:4px 10px;border-radius:4px}
.risk-p.bad{background:rgba(255,59,92,.1);color:var(--negative)}.risk-p.warn{background:rgba(255,182,39,.1);color:var(--threat-medium)}.risk-p.ok{background:var(--positive-muted);color:var(--positive)}

.gate-divider{border-top:1px solid var(--blue-border);margin:24px 0;padding-top:20px}
.gate-title{font-family:var(--font-display);font-size:14px;font-weight:700;margin-bottom:4px}
.gate-sub{font-size:11px;color:var(--text-tertiary);margin-bottom:16px}
.gate-form{display:flex;gap:8px;max-width:400px;margin:0 auto}
.gate-input{flex:1;font-family:var(--font-body);font-size:13px;padding:10px 14px;border-radius:var(--radius);border:1px solid var(--blue-border);background:var(--bg-panel);color:var(--text-primary);outline:none}
.gate-input:focus{border-color:var(--blue-border-bright)}
.gate-input::placeholder{color:var(--text-tertiary)}
.gate-btn{font-family:var(--font-display);font-size:11px;font-weight:600;padding:10px 20px;border-radius:var(--radius);border:none;background:var(--blue-primary);color:var(--bg-void);cursor:pointer;white-space:nowrap}
.gate-note{font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary);margin-top:8px}
.gate-error{color:var(--negative)}

/* Scanning animation */
.scanning{text-align:center;padding:60px}
.scan-ring{width:100px;height:100px;margin:0 auto 16px;border:2px solid var(--blue-border);border-top-color:var(--blue-primary);border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.scan-label{font-family:var(--font-display);font-size:13px;color:var(--blue-primary);letter-spacing:1px}
.scan-detail{font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);margin-top:6px}

/* FOOTER */
.pub-footer{padding:40px;text-align:center;border-top:1px solid var(--blue-border)}
.footer-logo{font-family:var(--font-display);font-weight:700;font-size:14px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}.footer-logo span{color:var(--blue-primary)}
.footer-text{font-size:11px;color:var(--text-tertiary)}
</style>
</head>
<body>
<nav class="pub-nav">
  <div class="pub-logo"><div class="logo-dot"></div>TRUST <span>RADAR</span></div>
  <div class="pub-nav-links">
    <a href="#agents">Agents</a>
    <a href="#how">How It Works</a>
    <a class="login-btn" href="/api/auth/login">Sign In</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-bg"></div>
  <div class="hero-content">
    <div class="hero-tag">Outside-In Threat Intelligence</div>
    <h1 class="hero-h1">We already know<br><span>who's being attacked</span></h1>
    <p class="hero-p">Trust Radar watches the internet's attack surface continuously. Five AI agents ingest threat feeds, correlate signals, and surface which brands are being hit &mdash; before they hire anyone.</p>
    <form class="scan-box" id="scanForm" action="/assess" method="POST">
      <input class="scan-input" id="domainInput" name="domain" placeholder="Enter your domain to get a free Trust Score" autocomplete="off">
      <button class="scan-btn" type="submit" id="scanBtn">Scan</button>
    </form>
    <div class="scan-hint">Free brand security assessment &middot; No signup required &middot; Results in seconds</div>
  </div>
</section>

<!-- AGENTS -->
<section class="agents-section" id="agents">
  <div class="section-tag">Intelligence Workforce</div>
  <div class="section-title">Five AI Agents. Always Watching.</div>
  <div class="section-sub">Each agent has a specialized role in the threat intelligence pipeline. Together, they see what no single alert can.</div>
  <div class="agents-grid">
    <div class="agent-card" style="--ag-color:#00d4ff"><div class="ag-icon">&#9678;</div><div class="ag-name" style="color:#00d4ff">Sentinel</div><div class="ag-role">Monitors certificate transparency logs and new domain registrations. First to detect impersonation.</div></div>
    <div class="agent-card" style="--ag-color:#00e5a0"><div class="ag-icon">&#11041;</div><div class="ag-name" style="color:#00e5a0">Analyst</div><div class="ag-role">Classifies every signal: phishing, credential harvesting, impersonation, or typosquatting.</div></div>
    <div class="agent-card" style="--ag-color:#ffb627"><div class="ag-icon">&#9672;</div><div class="ag-name" style="color:#ffb627">Cartographer</div><div class="ag-role">Maps attack infrastructure. Traces threats to hosting providers, IPs, and registrars.</div></div>
    <div class="agent-card" style="--ag-color:#ff3b5c"><div class="ag-icon">&#11042;</div><div class="ag-name" style="color:#ff3b5c">Strategist</div><div class="ag-role">Clusters related attacks into coordinated campaigns. Sees the playbook behind individual alerts.</div></div>
    <div class="agent-card" style="--ag-color:#b388ff"><div class="ag-icon">&#9673;</div><div class="ag-name" style="color:#b388ff">Observer</div><div class="ag-role">Tracks long-term trend shifts. Produces narrative intelligence about where threats are heading.</div></div>
  </div>
</section>

<!-- HOW IT WORKS -->
<section class="how-section" id="how">
  <div style="text-align:center"><div class="section-tag">How It Works</div><div class="section-title" style="margin-bottom:40px">Intelligence in Three Steps</div></div>
  <div class="steps">
    <div class="step"><div class="step-num">01</div><div class="step-title">Enter Your Domain</div><div class="step-desc">Type your company domain. No signup, no credit card. Our agents begin scanning immediately.</div></div>
    <div class="step"><div class="step-num">02</div><div class="step-title">Agents Analyze</div><div class="step-desc">Five AI agents check DNS, email security, SSL, active threats, impersonation domains, and hosting infrastructure.</div></div>
    <div class="step"><div class="step-num">03</div><div class="step-title">Get Your Score</div><div class="step-desc">Receive a Trust Score (0-100) with key risk indicators. Unlock the full report with a business email.</div></div>
  </div>
</section>

<!-- RESULTS (hidden until scan) -->
<section id="results-section">
  <div id="results-content"></div>
</section>

<footer class="pub-footer">
  <div class="footer-logo">TRUST <span>RADAR</span></div>
  <div class="footer-text">AI-powered threat intelligence by LRX &middot; lrxradar.com</div>
</footer>

<script>
function scoreColor(s){return s>=80?'var(--positive)':s>=60?'var(--blue-primary)':s>=40?'var(--threat-medium)':s>=25?'var(--threat-high)':'var(--negative)'}
function gradeFor(s){return s>=90?'A':s>=80?'B':s>=60?'C':s>=40?'D':'F'}
function summaryFor(s,d){
  if(s>=80)return d+' has strong security posture. Email authentication is well-configured and we found minimal threat activity targeting this domain.';
  if(s>=60)return d+' has moderate security. Some areas need attention — particularly email authentication and active monitoring for impersonation threats.';
  if(s>=40)return d+' has concerning security gaps. We detected active threats and missing security configurations that leave the brand exposed.';
  return d+' has critical security vulnerabilities. Multiple active threats detected, missing essential email authentication, and significant impersonation risk.';
}

var FREEMAIL_DOMAINS=['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','mail.com','protonmail.com','proton.me','yandex.com','zoho.com','gmx.com','fastmail.com','tutanota.com','hey.com','live.com','msn.com','me.com','qq.com','163.com'];

document.getElementById('scanForm').addEventListener('submit', function(e){
  e.preventDefault();
  var domain = document.getElementById('domainInput').value.trim().toLowerCase();
  // Strip protocol/path if user pasted a URL
  domain = domain.replace(/^https?:\\/\\//, '').split('/')[0];
  if(!domain || !domain.includes('.')) return;

  var btn = document.getElementById('scanBtn');
  btn.disabled = true;
  btn.textContent = 'SCANNING...';

  var rs = document.getElementById('results-section');
  rs.classList.add('visible');
  rs.scrollIntoView({behavior:'smooth'});

  // Show scanning animation
  rs.querySelector('#results-content').innerHTML =
    '<div class="scanning"><div class="scan-ring"></div><div class="scan-label">Scanning '+domain+'</div><div class="scan-detail" id="scan-step">Resolving DNS records...</div></div>';

  var steps=['Resolving DNS records...','Checking email authentication (SPF/DKIM/DMARC)...','Validating SSL/TLS certificates...','Scanning for active threats...','Checking impersonation domains...','Analyzing hosting infrastructure...','Calculating Trust Score...'];
  var si=0;
  var stepInterval=setInterval(function(){
    si++;if(si<steps.length){var el=document.getElementById('scan-step');if(el)el.textContent=steps[si];}
  },600);

  fetch('/api/brand-scan/public', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({domain:domain})
  })
  .then(function(r){return r.json()})
  .then(function(data){
    clearInterval(stepInterval);
    btn.disabled=false;
    btn.textContent='SCAN';

    if(!data.success){
      rs.querySelector('#results-content').innerHTML='<div class="result-card"><div class="result-domain">'+domain+'</div><p style="color:var(--negative)">Scan failed: '+(data.error||'Unknown error')+'</p></div>';
      return;
    }

    var d = data.data;
    var score = d.trustScore;
    var sc = scoreColor(score);
    var grade = gradeFor(score);

    // Build real risk indicators from scan data
    var risks=[];
    if(d.riskLevel==='critical'||d.riskLevel==='high') risks.push({text:'Risk: '+d.riskLevel.toUpperCase(),cls:'bad'});
    else if(d.riskLevel==='medium') risks.push({text:'Risk: MEDIUM',cls:'warn'});
    else risks.push({text:'Risk: LOW',cls:'ok'});

    if(d.feedMentions) risks.push({text:'Active threats detected',cls:'bad'});
    else risks.push({text:'No active threats',cls:'ok'});

    if(d.lookalikesPossible>50) risks.push({text:d.lookalikesPossible+' lookalike domains possible',cls:'warn'});

    rs.querySelector('#results-content').innerHTML =
      '<div class="result-card">'+
        '<div class="result-domain">'+domain+'</div>'+
        '<div class="score-ring">'+
          '<svg viewBox="0 0 140 140">'+
            '<circle cx="70" cy="70" r="60" fill="none" stroke="var(--bg-elevated)" stroke-width="6"/>'+
            '<circle cx="70" cy="70" r="60" fill="none" stroke="'+sc+'" stroke-width="6" stroke-dasharray="377" stroke-dashoffset="'+(377*(1-score/100))+'" stroke-linecap="round" transform="rotate(-90 70 70)" style="transition:stroke-dashoffset 1.5s ease"/>'+
          '</svg>'+
          '<div class="score-val" style="color:'+sc+'">'+score+'</div>'+
        '</div>'+
        '<div class="score-grade" style="color:'+sc+'">Grade: '+grade+'</div>'+
        '<div class="score-summary">'+summaryFor(score,domain)+'</div>'+
        '<div class="risk-pills">'+risks.map(function(r){return '<span class="risk-p '+r.cls+'">'+r.text+'</span>'}).join('')+'</div>'+
        '<div class="gate-divider">'+
          '<div class="gate-title">Get the Full Report</div>'+
          '<div class="gate-sub">Our detailed assessment includes threat actor analysis, infrastructure mapping, and specific remediation steps.</div>'+
          '<form class="gate-form" id="gateForm">'+
            '<input class="gate-input" id="emailInput" name="email" placeholder="Business email address" type="email" required>'+
            '<button class="gate-btn" type="submit" id="gateBtn">Get Report</button>'+
          '</form>'+
          '<div class="gate-note" id="gateNote">Business email required &middot; Free &middot; No credit card</div>'+
        '</div>'+
      '</div>';

    // Gate handler
    document.getElementById('gateForm').addEventListener('submit', function(ev){
      ev.preventDefault();
      var email = document.getElementById('emailInput').value.trim();
      var emailDomain = (email.split('@')[1]||'').toLowerCase();
      if(!email||!email.includes('@')){return;}
      if(FREEMAIL_DOMAINS.indexOf(emailDomain)!==-1){
        document.getElementById('emailInput').style.borderColor='var(--negative)';
        var note=document.getElementById('gateNote');
        note.textContent='Please use a business email address (no free email providers)';
        note.className='gate-note gate-error';
        return;
      }
      var gbtn=document.getElementById('gateBtn');
      gbtn.textContent='Sending...';
      gbtn.disabled=true;
      fetch('/api/leads',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:email,name:email.split('@')[0],domain:domain,company:emailDomain})
      })
      .then(function(){
        gbtn.textContent='\u2713 Sent!';
        gbtn.style.background='var(--positive)';
        var note=document.getElementById('gateNote');
        note.textContent='Check your inbox. Full report delivered within 2 minutes.';
        note.style.color='var(--positive)';
        note.className='gate-note';
      })
      .catch(function(){
        gbtn.textContent='Get Report';
        gbtn.disabled=false;
      });
    });
  })
  .catch(function(err){
    clearInterval(stepInterval);
    btn.disabled=false;
    btn.textContent='SCAN';
    rs.querySelector('#results-content').innerHTML='<div class="result-card"><p style="color:var(--negative)">Scan failed. Please check the domain and try again.</p></div>';
  });
});

// Allow Enter key on domain input
document.getElementById('domainInput').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();document.getElementById('scanForm').dispatchEvent(new Event('submit'));}});
</script>
<!-- Trust Radar monitoring -->
<div style="position:absolute;left:-9999px;top:-9999px;height:0;overflow:hidden" aria-hidden="true">
  <a href="mailto:spider-pub-footer@trustradar.ca">contact us</a>
  <a href="mailto:spider-pub-meta@trustradar.ca">support</a>
</div>
</body>
</html>`;
}

// ─── Assessment Results Page (server-rendered) ──────────────────

export function renderAssessResults(scanId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Trust Score Results — Trust Radar</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg-void:#040810;--bg-surface:#0a1020;--bg-panel:#0d1528;--bg-elevated:#111d35;--blue-primary:#00d4ff;--blue-muted:#0091b3;--blue-glow:rgba(0,212,255,.08);--blue-border:rgba(0,212,255,.15);--blue-border-bright:rgba(0,212,255,.35);--threat-critical:#ff3b5c;--threat-high:#ff6b35;--threat-medium:#ffb627;--positive:#00e5a0;--positive-muted:rgba(0,229,160,.12);--negative:#ff3b5c;--purple:#b388ff;--text-primary:#e8edf5;--text-secondary:#7a8ba8;--text-tertiary:#4a5a73;--text-accent:#00d4ff;--font-display:'Chakra Petch',sans-serif;--font-body:'Outfit',sans-serif;--font-mono:'IBM Plex Mono',monospace;--radius:6px;--radius-lg:10px}
*{margin:0;padding:0;box-sizing:border-box}html{background:var(--bg-void);color:var(--text-primary);font-family:var(--font-body)}
.pub-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:14px 40px;background:rgba(4,8,16,.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--blue-border)}
.pub-logo{font-family:var(--font-display);font-weight:700;font-size:18px;letter-spacing:2px;text-transform:uppercase;display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--text-primary)}
.pub-logo span{color:var(--blue-primary)}
.logo-dot{width:24px;height:24px;border-radius:50%;border:2px solid var(--blue-primary);display:flex;align-items:center;justify-content:center}.logo-dot::after{content:'';width:6px;height:6px;border-radius:50%;background:var(--blue-primary)}
.login-btn{font-family:var(--font-display);font-size:11px;font-weight:600;padding:7px 18px;border-radius:var(--radius);border:1px solid var(--blue-border-bright);background:var(--bg-panel);color:var(--blue-primary);cursor:pointer;text-decoration:none;transition:all .15s}.login-btn:hover{background:var(--bg-elevated)}
.results-page{max-width:640px;margin:0 auto;padding:100px 24px 60px;text-align:center}
.loading{font-family:var(--font-mono);font-size:13px;color:var(--text-secondary);padding:60px 0}
.result-card{background:var(--bg-surface);border:1px solid var(--blue-border);border-radius:var(--radius-lg);padding:36px;margin-bottom:24px}
.result-domain{font-family:var(--font-mono);font-size:16px;color:var(--text-secondary);margin-bottom:20px}
.score-ring{width:160px;height:160px;margin:0 auto 16px;position:relative}
.score-ring svg{width:160px;height:160px}
.score-val{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:var(--font-display);font-weight:700;font-size:48px}
.score-grade{font-family:var(--font-display);font-size:22px;font-weight:700;margin-bottom:10px}
.score-summary{font-size:14px;color:var(--text-secondary);line-height:1.6;max-width:450px;margin:0 auto 24px}
.risk-pills{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
.risk-p{font-family:var(--font-mono);font-size:10px;padding:5px 12px;border-radius:4px}
.risk-p.bad{background:rgba(255,59,92,.1);color:var(--negative)}.risk-p.warn{background:rgba(255,182,39,.1);color:var(--threat-medium)}.risk-p.ok{background:var(--positive-muted);color:var(--positive)}
.gate-divider{border-top:1px solid var(--blue-border);margin:24px 0;padding-top:20px}
.gate-title{font-family:var(--font-display);font-size:14px;font-weight:700;margin-bottom:4px}
.gate-sub{font-size:11px;color:var(--text-tertiary);margin-bottom:16px}
.gate-form{display:flex;gap:8px;max-width:400px;margin:0 auto}
.gate-input{flex:1;font-family:var(--font-body);font-size:13px;padding:10px 14px;border-radius:var(--radius);border:1px solid var(--blue-border);background:var(--bg-panel);color:var(--text-primary);outline:none}
.gate-input:focus{border-color:var(--blue-border-bright)}
.gate-input::placeholder{color:var(--text-tertiary)}
.gate-btn{font-family:var(--font-display);font-size:11px;font-weight:600;padding:10px 20px;border-radius:var(--radius);border:none;background:var(--blue-primary);color:var(--bg-void);cursor:pointer;white-space:nowrap}
.gate-note{font-family:var(--font-mono);font-size:9px;color:var(--text-tertiary);margin-top:8px}
.gate-error{color:var(--negative)}
.back-link{display:inline-block;font-family:var(--font-display);font-size:12px;color:var(--blue-primary);text-decoration:none;margin-top:16px;padding:8px 16px;border:1px solid var(--blue-border);border-radius:var(--radius)}.back-link:hover{background:var(--bg-panel)}
</style>
</head>
<body>
<nav class="pub-nav">
  <a href="/" class="pub-logo"><div class="logo-dot"></div>TRUST <span>RADAR</span></a>
  <a class="login-btn" href="/login">Sign In</a>
</nav>
<div class="results-page">
  <div class="loading" id="loading">Loading assessment results...</div>
  <div id="results"></div>
</div>
<script>
var FREEMAIL_DOMAINS=['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','mail.com','protonmail.com','proton.me','yandex.com','zoho.com','gmx.com','fastmail.com','tutanota.com','hey.com','live.com','msn.com','me.com','qq.com','163.com'];
function scoreColor(s){return s>=80?'var(--positive)':s>=60?'var(--blue-primary)':s>=40?'var(--threat-medium)':s>=25?'var(--threat-high)':'var(--negative)'}
function gradeFor(s){return s>=90?'A':s>=80?'B':s>=60?'C':s>=40?'D':'F'}
function summaryFor(s,d){
  if(s>=80)return d+' has strong security posture. Email authentication is well-configured and we found minimal threat activity.';
  if(s>=60)return d+' has moderate security. Some areas need attention — particularly email authentication and active monitoring for impersonation threats.';
  if(s>=40)return d+' has concerning security gaps. We detected active threats and missing security configurations that leave the brand exposed.';
  return d+' has critical security vulnerabilities. Multiple active threats detected, missing essential email authentication, and significant impersonation risk.';
}

var scanId=${JSON.stringify(scanId)};
fetch('/api/brand-scan/public/'+encodeURIComponent(scanId))
.then(function(r){return r.json()})
.then(function(data){
  document.getElementById('loading').style.display='none';
  if(!data.success){
    document.getElementById('results').innerHTML='<div class="result-card"><p style="color:var(--negative)">'+( data.error||'Assessment not found')+'</p></div><a href="/" class="back-link">\u2190 Scan another domain</a>';
    return;
  }
  var d=data.data;
  var score=d.trust_score||d.trustScore||50;
  var domain=d.domain||'Unknown';
  var sc=scoreColor(score);
  var grade=gradeFor(score);
  var riskLevel=d.risk_level||d.riskLevel||'medium';

  var risks=[];
  if(riskLevel==='critical'||riskLevel==='high') risks.push({text:'Risk: '+riskLevel.toUpperCase(),cls:'bad'});
  else if(riskLevel==='medium') risks.push({text:'Risk: MEDIUM',cls:'warn'});
  else risks.push({text:'Risk: LOW',cls:'ok'});

  if(d.spf_policy==='hardfail') risks.push({text:'SPF: Enforced',cls:'ok'});
  else if(d.spf_policy) risks.push({text:'SPF: '+d.spf_policy,cls:'warn'});
  else risks.push({text:'SPF: Missing',cls:'bad'});

  if(d.dmarc_policy==='reject') risks.push({text:'DMARC: Enforced',cls:'ok'});
  else if(d.dmarc_policy) risks.push({text:'DMARC: '+d.dmarc_policy,cls:'warn'});
  else risks.push({text:'DMARC: Missing',cls:'bad'});

  if(d.feed_mentions>0) risks.push({text:'Active threats: '+d.feed_mentions,cls:'bad'});
  else risks.push({text:'No active threats',cls:'ok'});

  document.getElementById('results').innerHTML=
    '<div class="result-card">'+
      '<div class="result-domain">'+domain+'</div>'+
      '<div class="score-ring"><svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="68" fill="none" stroke="var(--bg-elevated)" stroke-width="6"/><circle cx="80" cy="80" r="68" fill="none" stroke="'+sc+'" stroke-width="6" stroke-dasharray="427" stroke-dashoffset="'+(427*(1-score/100))+'" stroke-linecap="round" transform="rotate(-90 80 80)" style="transition:stroke-dashoffset 1.5s ease"/></svg><div class="score-val" style="color:'+sc+'">'+score+'</div></div>'+
      '<div class="score-grade" style="color:'+sc+'">Grade: '+grade+'</div>'+
      '<div class="score-summary">'+summaryFor(score,domain)+'</div>'+
      '<div class="risk-pills">'+risks.map(function(r){return '<span class="risk-p '+r.cls+'">'+r.text+'</span>'}).join('')+'</div>'+
      '<div class="gate-divider"><div class="gate-title">Get the Full Report</div><div class="gate-sub">Detailed assessment with threat actor analysis, infrastructure mapping, and remediation steps.</div>'+
        '<form class="gate-form" id="gateForm"><input class="gate-input" id="emailInput" placeholder="Business email address" type="email" required><button class="gate-btn" type="submit" id="gateBtn">Get Report</button></form>'+
        '<div class="gate-note" id="gateNote">Business email required &middot; Free &middot; No credit card</div>'+
      '</div>'+
    '</div>'+
    '<a href="/" class="back-link">\u2190 Scan another domain</a>';

  document.getElementById('gateForm').addEventListener('submit',function(ev){
    ev.preventDefault();
    var email=document.getElementById('emailInput').value.trim();
    var emailDomain=(email.split('@')[1]||'').toLowerCase();
    if(!email||!email.includes('@'))return;
    if(FREEMAIL_DOMAINS.indexOf(emailDomain)!==-1){
      document.getElementById('emailInput').style.borderColor='var(--negative)';
      var note=document.getElementById('gateNote');
      note.textContent='Please use a business email address (no free email providers)';
      note.className='gate-note gate-error';
      return;
    }
    var gbtn=document.getElementById('gateBtn');
    gbtn.textContent='Sending...';gbtn.disabled=true;
    fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,name:email.split('@')[0],domain:domain,company:emailDomain})})
    .then(function(){gbtn.textContent='\u2713 Sent!';gbtn.style.background='var(--positive)';var n=document.getElementById('gateNote');n.textContent='Check your inbox. Full report delivered within 2 minutes.';n.style.color='var(--positive)';n.className='gate-note';})
    .catch(function(){gbtn.textContent='Get Report';gbtn.disabled=false;});
  });
})
.catch(function(){
  document.getElementById('loading').style.display='none';
  document.getElementById('results').innerHTML='<div class="result-card"><p style="color:var(--negative)">Failed to load assessment results.</p></div><a href="/" class="back-link">\u2190 Scan another domain</a>';
});
</script>
</body>
</html>`;
}

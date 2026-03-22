/**
 * Trust Radar — Contact Page
 * Served at /contact
 */

import { wrapPage } from "./shared";

export function renderContactPage(): string {
  return wrapPage(
    "Contact Us — Trust Radar",
    "Get in touch with the Trust Radar team. Reach out for product demos, enterprise pricing, partnerships, security reports, or general inquiries.",
    `
<style>
.contact-hero { padding: 10rem 0 4rem; text-align: center; }
.contact-hero .section-title { max-width: 100%; margin-left: auto; margin-right: auto; }
.contact-hero .section-desc { max-width: 560px; margin-left: auto; margin-right: auto; margin-bottom: 0; }

.contact-grid { display: grid; grid-template-columns: 60% 40%; gap: 3rem; margin-bottom: 5rem; }
.contact-form-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 2.5rem; box-shadow: var(--shadow-sm); }
.contact-form-card h3 { font-family: var(--font-display); font-size: 1.3rem; font-weight: 700; margin-bottom: 0.5rem; }
.contact-form-card .form-subtitle { font-size: 0.92rem; color: var(--text-secondary); margin-bottom: 2rem; }

.form-group { margin-bottom: 1.25rem; }
.form-group label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.4rem; color: var(--text-primary); }
.form-group label .required { color: var(--red); margin-left: 2px; }
.form-group input, .form-group select, .form-group textarea {
  width: 100%; padding: 0.7rem 1rem; font-family: var(--font-body); font-size: 0.9rem;
  color: var(--text-primary); background: var(--bg-tertiary); border: 1.5px solid var(--border);
  border-radius: var(--radius-sm); outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  -webkit-appearance: none; appearance: none;
}
.form-group input::placeholder, .form-group textarea::placeholder { color: var(--text-tertiary); }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.form-group select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8.825L.35 3.175l.7-.7L6 7.425l4.95-4.95.7.7z'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 1rem center; padding-right: 2.5rem; cursor: pointer;
}
.form-group textarea { resize: vertical; min-height: 100px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

.form-submit-btn {
  width: 100%; padding: 0.85rem 2rem; margin-top: 0.5rem; font-family: var(--font-body);
  font-size: 0.95rem; font-weight: 600; color: white; background: var(--accent);
  border: none; border-radius: var(--radius-sm); cursor: pointer; transition: all 0.2s;
  position: relative; overflow: hidden;
}
.form-submit-btn::after {
  content: ''; position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent); transition: none;
}
.form-submit-btn:hover::after { animation: shimmer 0.6s forwards; }
.form-submit-btn:hover { background: var(--accent-hover); box-shadow: 0 0 20px rgba(8,145,178,0.35); transform: translateY(-1px); }
.form-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }

.form-message { margin-top: 1rem; padding: 0.75rem 1rem; border-radius: var(--radius-sm); font-size: 0.88rem; font-weight: 500; display: none; }
.form-message.success { display: block; background: var(--green-bg); color: var(--green); border: 1px solid var(--green); }
.form-message.error { display: block; background: var(--red-bg); color: var(--red); border: 1px solid var(--red); }

.contact-sidebar { display: flex; flex-direction: column; gap: 1.5rem; }
.sidebar-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 2rem; box-shadow: var(--shadow-sm); }
.sidebar-card h3 { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; margin-bottom: 1.25rem; }
.sidebar-email-list { list-style: none; display: flex; flex-direction: column; gap: 1rem; }
.sidebar-email-item { display: flex; flex-direction: column; gap: 0.15rem; }
.sidebar-email-label { font-family: var(--font-mono); font-size: 0.7rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.08em; }
.sidebar-email-link { font-size: 0.9rem; color: var(--accent); transition: color 0.2s; }
.sidebar-email-link:hover { color: var(--accent-hover); }

.sidebar-info { display: flex; flex-direction: column; gap: 1rem; }
.sidebar-info-item { display: flex; align-items: flex-start; gap: 0.75rem; }
.sidebar-info-icon { width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--accent-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; margin-top: 2px; }
.sidebar-info-text { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; }
.sidebar-info-text strong { display: block; color: var(--text-primary); font-weight: 600; margin-bottom: 0.1rem; }

@media (max-width: 1024px) { .contact-grid { grid-template-columns: 1fr; } }
@media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } .contact-hero { padding-top: 7rem; padding-bottom: 2rem; } .contact-form-card { padding: 1.5rem; } .sidebar-card { padding: 1.5rem; } }
</style>

<section class="contact-hero">
  <div class="container">
    <div class="section-label">Contact Us</div>
    <h1 class="section-title">Get in Touch</h1>
    <p class="section-desc">Have questions about Trust Radar? We'd love to hear from you. Fill out the form below and our team will get back to you shortly.</p>
  </div>
</section>

<section style="padding-top:0;">
  <div class="container">
    <div class="contact-grid">
      <div class="contact-form-card">
        <h3>Send us a message</h3>
        <p class="form-subtitle">Fill out the form and we'll be in touch as soon as possible.</p>
        <form id="contactForm" novalidate>
          <div class="form-row">
            <div class="form-group">
              <label for="name">Name <span class="required">*</span></label>
              <input type="text" id="name" name="name" placeholder="Your full name" required>
            </div>
            <div class="form-group">
              <label for="email">Work Email <span class="required">*</span></label>
              <input type="email" id="email" name="email" placeholder="you@company.com" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="company">Company</label>
              <input type="text" id="company" name="company" placeholder="Your company name">
            </div>
            <div class="form-group">
              <label for="companySize">Company Size</label>
              <select id="companySize" name="companySize">
                <option value="">Select size</option>
                <option value="1-50">1-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="501-1000">501-1000 employees</option>
                <option value="1000+">1000+ employees</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="interest">Interest</label>
            <select id="interest" name="interest">
              <option value="general">General Inquiry</option>
              <option value="demo">Product Demo</option>
              <option value="enterprise">Enterprise Pricing</option>
              <option value="partnership">Partnership</option>
              <option value="security">Security Report</option>
            </select>
          </div>
          <div class="form-group">
            <label for="message">Message</label>
            <textarea id="message" name="message" rows="5" placeholder="Tell us how we can help..."></textarea>
          </div>
          <button type="submit" class="form-submit-btn" id="submitBtn">Send Message</button>
        </form>
        <div class="form-message" id="formMessage"></div>
      </div>

      <div class="contact-sidebar">
        <div class="sidebar-card">
          <h3>Contact Information</h3>
          <ul class="sidebar-email-list">
            <li class="sidebar-email-item">
              <span class="sidebar-email-label">General</span>
              <a href="mailto:hello@trustradar.ca" class="sidebar-email-link">hello@trustradar.ca</a>
            </li>
            <li class="sidebar-email-item">
              <span class="sidebar-email-label">Security</span>
              <a href="mailto:security@trustradar.ca" class="sidebar-email-link">security@trustradar.ca</a>
            </li>
            <li class="sidebar-email-item">
              <span class="sidebar-email-label">Sales</span>
              <a href="mailto:sales@trustradar.ca" class="sidebar-email-link">sales@trustradar.ca</a>
            </li>
          </ul>
        </div>
        <div class="sidebar-card">
          <h3>Quick Info</h3>
          <div class="sidebar-info">
            <div class="sidebar-info-item">
              <div class="sidebar-info-icon">&#9201;</div>
              <div class="sidebar-info-text">
                <strong>Response Time</strong>
                We respond within 1 business day.
              </div>
            </div>
            <div class="sidebar-info-item">
              <div class="sidebar-info-icon">&#127464;&#127462;</div>
              <div class="sidebar-info-text">
                <strong>Location</strong>
                LRX Enterprises Inc., Canada
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<script>
document.getElementById('contactForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const msg = document.getElementById('formMessage');
  const form = this;
  msg.className = 'form-message';
  msg.style.display = 'none';
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  if (!name || !email) {
    msg.textContent = 'Please fill in all required fields.';
    msg.className = 'form-message error';
    msg.style.display = 'block';
    return;
  }
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    msg.textContent = 'Please enter a valid email address.';
    msg.className = 'form-message error';
    msg.style.display = 'block';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Sending...';
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email,
        company: form.company.value.trim(),
        companySize: form.companySize.value,
        interest: form.interest.value,
        message: form.message.value.trim()
      })
    });
    if (res.ok) {
      msg.textContent = 'Thank you! Your message has been sent. We\\'ll get back to you soon.';
      msg.className = 'form-message success';
      msg.style.display = 'block';
      form.reset();
    } else {
      const data = await res.json().catch(() => ({}));
      msg.textContent = data.error || 'Something went wrong. Please try again later.';
      msg.className = 'form-message error';
      msg.style.display = 'block';
    }
  } catch (err) {
    msg.textContent = 'Network error. Please check your connection and try again.';
    msg.className = 'form-message error';
    msg.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Message';
  }
});
</script>
`
  );
}

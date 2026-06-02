require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json({limit: '10mb'}));

const PORT = process.env.PORT || 3000;

function buildHtmlFromData(d) {
  const addons = (d.addons||[]).filter(a=>a.checked).map(a=>`<li>${a.name} x ${a.qty||1}</li>`).join('') || '<li>None</li>';
  const sigImg = d.signature ? `<img src="cid:sigimg" style="max-width:320px;display:block">` : 'No signature';
  const witImg = d.witnessSignature ? `<img src="cid:witimg" style="max-width:320px;display:block">` : 'No witness signature';
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#102030;">
      <h2>Mercury Integrations – Completed Agreement</h2>
      <p><strong>Client:</strong> ${d.firstName||''} ${d.lastName||''}</p>
      <p><strong>Company:</strong> ${d.company||''}</p>
      <p><strong>Email:</strong> ${d.email||''}</p>
      <p><strong>Phone:</strong> ${d.phone||''}</p>
      <p><strong>Site:</strong><br>${(d.site||'').replace(/\n/g,'<br>')}</p>
      <h3>Pricing Summary</h3>
      <p><strong>Monthly Fee:</strong> ${d.sumMonthly||''} ${d.sumVAT? '('+d.sumVAT+')':''}</p>
      <p><strong>Rate:</strong> ${d.sumRate||''}</p>
      <p><strong>Channels:</strong> ${d.sumChannels||''}</p>
      <p><strong>Contract Total:</strong> ${d.sumContractTotal||''} — ${d.sumTerm||''}</p>
      <h3>Add-ons</h3>
      <ul>${addons}</ul>
      <h3>Signatures</h3>
      <p><strong>Signed by:</strong> ${d.signatory||''} — ${d.sigDate||''}</p>
      <div>${sigImg}</div>
      <p><strong>Witness:</strong> ${d.witnessName||''}</p>
      <div>${witImg}</div>
    </div>
  `;
}

app.post('/send', async (req, res) => {
  const data = req.body || {};
  try {
    // create transporter from env
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });

    const html = buildHtmlFromData(data);

    const attachments = [];
    if (data.signature && data.signature.startsWith('data:image')) {
      const b = data.signature.split(',')[1];
      attachments.push({ filename: 'signature.png', content: Buffer.from(b, 'base64'), cid: 'sigimg' });
    }
    if (data.witnessSignature && data.witnessSignature.startsWith('data:image')) {
      const b = data.witnessSignature.split(',')[1];
      attachments.push({ filename: 'witness.png', content: Buffer.from(b, 'base64'), cid: 'witimg' });
    }
    // optional PDF attachment (base64 or data url)
    if (data.pdf) {
      let pdfBase64 = data.pdf;
      if (pdfBase64.startsWith('data:')) pdfBase64 = pdfBase64.split(',')[1];
      try {
        attachments.push({ filename: 'agreement.pdf', content: Buffer.from(pdfBase64, 'base64') });
      } catch (e) {
        console.warn('pdf attach failed', e);
      }
    }

    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: process.env.TO_EMAIL || 'daniel@mercury.net.za',
      subject: `Signed Mercury Agreement - ${data.firstName||''} ${data.lastName||''}`.trim(),
      html,
      attachments
    };

    await transporter.sendMail(mailOptions);
    return res.json({ ok: true });
  } catch (err) {
    console.error('send error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.listen(PORT, () => console.log(`Email server listening on ${PORT}`));

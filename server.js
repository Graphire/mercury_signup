require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY);

function buildHtmlFromData(d) {
  const addons = (d.addons||[]).filter(a => a.checked).map(a => `<li>${a.name} x ${a.qty||1}</li>`).join('') || '<li>None</li>';
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#102030;">
      <h2>Mercury Integrations – New Signed Agreement</h2>
      <p><strong>Client:</strong> ${d.firstName||''} ${d.lastName||''}</p>
      <p><strong>Company:</strong> ${d.company||''}</p>
      <p><strong>Email:</strong> ${d.email||''}</p>
      <p><strong>Phone:</strong> ${d.phone||''}</p>
      <p><strong>Site:</strong><br>${(d.site||'').replace(/\n/g,'<br>')}</p>
      <h3>Pricing Summary</h3>
      <p><strong>Monthly Fee:</strong> ${d.sumMonthly||''}</p>
      <p><strong>Rate:</strong> ${d.sumRate||''}</p>
      <p><strong>Channels:</strong> ${d.sumChannels||''}</p>
      <p><strong>Contract Total:</strong> ${d.sumContractTotal||''} — ${d.sumTerm||''}</p>
      <h3>Add-ons</h3>
      <ul>${addons}</ul>
      <p><strong>Signed by:</strong> ${d.signatory||''} — ${d.sigDate||''}</p>
      <p><strong>Witness:</strong> ${d.witnessName||''}</p>
      <p style="color:#888;font-size:0.85em;">The full completed form is attached as a PDF.</p>
    </div>
  `;
}

app.post('/send', async (req, res) => {
  const data = req.body || {};
  try {
    const html = buildHtmlFromData(data);
    const attachments = [];

    if (data.pdf) {
      let pdfBase64 = data.pdf;
      if (pdfBase64.startsWith('data:')) pdfBase64 = pdfBase64.split(',')[1];
      attachments.push({ filename: 'agreement.pdf', content: pdfBase64 });
    }

    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Mercury Agreements <onboarding@resend.dev>',
      to: process.env.TO_EMAIL || 'daniel@mercury.net.za',
      subject: `Signed Mercury Agreement - ${data.firstName||''} ${data.lastName||''}`.trim(),
      html,
      attachments,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('send error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.listen(PORT, () => console.log(`Email server listening on ${PORT}`));

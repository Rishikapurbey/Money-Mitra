interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Sends through Brevo's API when BREVO_API_KEY is set. Without it (local development)
// the email is printed to the server console instead, so flows can be tested offline.
export async function sendEmail({ to, subject, html, text }: Email) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.log(`\n[email not sent: BREVO_API_KEY or EMAIL_FROM not set]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Money Mitra", email: from },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) throw new Error(`Brevo responded ${res.status}: ${await res.text()}`);
}

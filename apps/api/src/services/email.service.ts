import nodemailer from 'nodemailer';
import { env } from '../config/env';

function createTransporter() {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    return null;
  }
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
}

export async function sendVerificationEmail(
  toEmail: string,
  firstName: string,
  verifyUrl: string,
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`[Email] SMTP not configured — verify URL for ${toEmail}: ${verifyUrl}`);
    return;
  }

  await transporter.sendMail({
    from: env.smtp.from,
    to: toEmail,
    subject: 'Confirmez votre adresse email — Kharrazi Fleet',
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#2563eb;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">🚗 Kharrazi Fleet</h1>
            <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Plateforme de gestion de location de voitures</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Bonjour ${firstName},</h2>
            <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
              Merci de vous être inscrit sur Kharrazi Fleet. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                Confirmer mon email
              </a>
            </div>
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Ce lien expire dans <strong>24 heures</strong>.</p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:13px;">Si vous n'avez pas créé de compte, ignorez cet email.</p>
            <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                Lien direct : <a href="${verifyUrl}" style="color:#2563eb;word-break:break-all;">${verifyUrl}</a>
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} Kharrazi Fleet — Tous droits réservés</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim(),
  });
}

export async function sendPasswordResetEmail(
  toEmail: string,
  firstName: string,
  resetToken: string,
  resetUrl: string,
): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    // Log so developers see it during testing; in production SMTP must be configured
    console.warn(
      `[Email] SMTP not configured — password reset token for ${toEmail}: ${resetToken}`,
    );
    return;
  }

  await transporter.sendMail({
    from: env.smtp.from,
    to: toEmail,
    subject: 'Réinitialisation de votre mot de passe — Kharrazi Fleet',
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Réinitialisation du mot de passe</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#2563eb;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">🚗 Kharrazi Fleet</h1>
              <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Plateforme de gestion de location de voitures</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Bonjour ${firstName},</h2>
              <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
                Nous avons reçu une demande de réinitialisation du mot de passe pour votre compte.
                Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.
              </p>

              <div style="text-align:center;margin:32px 0;">
                <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                  Réinitialiser mon mot de passe
                </a>
              </div>

              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">
                Ce lien expire dans <strong>1 heure</strong>.
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:13px;">
                Si vous n'avez pas demandé de réinitialisation, ignorez cet email — votre mot de passe restera inchangé.
              </p>

              <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:8px;">
                <p style="margin:0;color:#9ca3af;font-size:12px;">
                  Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
                  <a href="${resetUrl}" style="color:#2563eb;word-break:break-all;">${resetUrl}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                © ${new Date().getFullYear()} Kharrazi Fleet — Tous droits réservés
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}

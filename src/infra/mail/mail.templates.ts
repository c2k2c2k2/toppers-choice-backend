type BrandedEmailInput = {
  title: string;
  previewText: string;
  eyebrow?: string;
  intro: string;
  body?: string;
  otpCode?: string;
  actionLabel?: string;
  actionUrl?: string;
  footerNote?: string;
};

export function buildBrandedEmailHtml(input: BrandedEmailInput) {
  const bodyHtml = input.body
    ? `<p style="margin:0 0 24px;color:#43474f;font-size:15px;line-height:1.7;">${escapeHtml(
        input.body,
      )}</p>`
    : '';
  const otpHtml = input.otpCode
    ? `<div style="margin:26px 0 28px;padding:18px 16px;border-radius:14px;background:#f3f4f5;text-align:center;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#58657c;">Verification code</div>
        <div style="margin-top:8px;font-family:Inter,Arial,sans-serif;font-size:34px;font-weight:800;letter-spacing:10px;color:#001e40;">${escapeHtml(
          input.otpCode,
        )}</div>
      </div>`
    : '';
  const ctaHtml =
    input.actionLabel && input.actionUrl
      ? `<p style="margin:28px 0 8px;"><a href="${escapeAttribute(
          input.actionUrl,
        )}" style="display:inline-block;border-radius:10px;background:#4e2b00;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:13px 18px;">${escapeHtml(
          input.actionLabel,
        )}</a></p>`
      : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;background:#f8f9fa;color:#191c1d;font-family:Inter,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
      input.previewText,
    )}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f9fa;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;box-shadow:0 16px 44px rgba(0,30,64,.08);overflow:hidden;">
            <tr>
              <td style="background:#001e40;padding:28px 30px;">
                <div style="font-family:Manrope,Inter,Arial,sans-serif;font-size:22px;font-weight:850;color:#ffffff;">Toppers' Choice</div>
                <div style="margin-top:7px;color:#ffb86f;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;">${escapeHtml(
                  input.eyebrow ?? 'Student communication',
                )}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <h1 style="margin:0 0 14px;font-family:Manrope,Inter,Arial,sans-serif;font-size:28px;line-height:1.2;color:#001e40;">${escapeHtml(
                  input.title,
                )}</h1>
                <p style="margin:0 0 18px;color:#43474f;font-size:16px;line-height:1.7;">${escapeHtml(
                  input.intro,
                )}</p>
                ${bodyHtml}
                ${otpHtml}
                ${ctaHtml}
                <p style="margin:26px 0 0;color:#737780;font-size:13px;line-height:1.7;">${escapeHtml(
                  input.footerNote ??
                    "If you did not request this email, you can safely ignore it.",
                )}</p>
              </td>
            </tr>
          </table>
          <p style="max-width:620px;margin:18px auto 0;color:#737780;font-size:12px;line-height:1.6;">
            Toppers' Choice sends important account, learning, and plan updates to help you use the platform confidently.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildPlainTextEmail(input: BrandedEmailInput) {
  return [
    "Toppers' Choice",
    input.title,
    input.intro,
    input.body,
    input.otpCode ? `Verification code: ${input.otpCode}` : undefined,
    input.actionUrl ? `${input.actionLabel ?? 'Open'}: ${input.actionUrl}` : undefined,
    input.footerNote ?? 'If you did not request this email, you can safely ignore it.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

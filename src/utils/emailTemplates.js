const COLORS = {
  background: '#080A0C',
  card: '#111318',
  border: '#272C35',
  foreground: '#F6F6F4',
  muted: '#8F96A3',
  primary: '#ABFF1A',
  primaryText: '#080A0C',
};

const LOGO_URL = 'https://www.workway.dev/logo.png';

export function magicLinkEmailHtml({ link }) {
  const preheader = 'Your sign-in link expires in 15 minutes.';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sign in to WorkWay</title>
</head>
<body style="margin:0; padding:0; background-color:${COLORS.background}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.background};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px; max-width:100%;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="${LOGO_URL}" width="40" height="40" alt="WorkWay" style="display:block; border-radius:8px;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:${COLORS.card}; border:1px solid ${COLORS.border}; border-radius:12px; padding:36px 32px;">
              <h1 style="margin:0 0 12px; font-size:20px; line-height:28px; font-weight:600; color:${COLORS.foreground};">
                Sign in to WorkWay
              </h1>
              <p style="margin:0 0 24px; font-size:14px; line-height:22px; color:${COLORS.muted};">
                Click the button below to sign in. This link expires in 15 minutes and can only be used once.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:8px; background-color:${COLORS.primary};">
                    <a href="${link}" target="_blank" style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:600; color:${COLORS.primaryText}; text-decoration:none; border-radius:8px;">
                      Sign in to WorkWay
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0; font-size:12px; line-height:20px; color:${COLORS.muted};">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:6px 0 0; font-size:12px; line-height:20px; word-break:break-all;">
                <a href="${link}" target="_blank" style="color:${COLORS.primary}; text-decoration:none;">${link}</a>
              </p>
              <p style="margin:24px 0 0; font-size:12px; line-height:20px; color:${COLORS.muted};">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0; font-size:12px; line-height:18px; color:${COLORS.muted};">
                WorkWay &middot; Built in public
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

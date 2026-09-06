"""Email over SMTP. Written against Gmail, but nothing here is Gmail-specific."""
import logging
import smtplib
import ssl
from email.message import EmailMessage

from .base import Channel, PermanentFailure, TransientFailure

logger = logging.getLogger(__name__)

# SMTP replies that will still be true tomorrow. 550/551/553 are "no such
# mailbox", 535 is a rejected login — retrying any of them just repeats the same
# rejection three times.
PERMANENT_CODES = {500, 501, 503, 535, 550, 551, 553, 554}


class SmtpEmailChannel(Channel):
    name = "email"

    def __init__(self, host, port, user, password, use_tls=True, from_address="", timeout=30):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.use_tls = use_tls
        self.from_address = from_address or user
        self.timeout = timeout

    def send(self, recipient, message):
        subject, text, html = message
        mail = EmailMessage()
        mail["Subject"] = subject
        mail["From"] = self.from_address
        mail["To"] = recipient
        mail.set_content(text)
        mail.add_alternative(html, subtype="html")

        try:
            # A fresh connection per message. Wasteful at volume, but this is a
            # handful of emails a day and a long-lived SMTP socket that Gmail
            # silently drops is a much worse failure than reconnecting.
            with smtplib.SMTP(self.host, self.port, timeout=self.timeout) as smtp:
                smtp.ehlo()
                if self.use_tls:
                    smtp.starttls(context=ssl.create_default_context())
                    smtp.ehlo()
                if self.user:
                    smtp.login(self.user, self.password)
                smtp.send_message(mail)
        except smtplib.SMTPAuthenticationError as exc:
            # Nearly always a missing App Password or 2FA not enabled on the
            # account. No number of retries fixes either.
            raise PermanentFailure(f"SMTP auth rejected: {exc}") from exc
        except smtplib.SMTPRecipientsRefused as exc:
            raise PermanentFailure(f"Recipient refused: {recipient} ({exc})") from exc
        except smtplib.SMTPResponseException as exc:
            if exc.smtp_code in PERMANENT_CODES:
                raise PermanentFailure(f"SMTP {exc.smtp_code}: {exc.smtp_error}") from exc
            raise TransientFailure(f"SMTP {exc.smtp_code}: {exc.smtp_error}") from exc
        except (smtplib.SMTPException, OSError) as exc:
            # Timeouts, DNS, TLS handshakes, connection resets — all worth
            # another attempt.
            raise TransientFailure(f"{type(exc).__name__}: {exc}") from exc

        logger.info("Emailed %s: %s", recipient, subject)
        return f"sent to {recipient}"

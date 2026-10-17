"""حماية من SSRF عند جلب روابط خارجية يدخلها المستخدم."""
import ipaddress
import socket
from urllib.parse import urlparse


def is_public_http_url(url: str) -> bool:
    """true فقط لروابط http/https التي تُحلّ كلها إلى عناوين عامة (لا loopback ولا شبكة داخلية)."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname:
            return False
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == 'https' else 80))
        for info in infos:
            ip = ipaddress.ip_address(info[4][0])
            if not ip.is_global:
                return False
        return bool(infos)
    except (ValueError, OSError):
        return False

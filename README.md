# Site Top Brasil — Landing page

Landing page estática da oferta **Site profissional por R$ 444/ano (R$ 37/mês)**, pronta para tráfego pago.

- HTML, CSS e JS sem dependências (`index.html`)
- Prints dos modelos em `modelos/` (WebP)
- SEO: metas, Open Graph, dados estruturados (Organization, Service/Offer, FAQPage)
- GEO: `llms.txt` e `robots.txt` liberando buscadores de IA

## Configuração

No fim do `index.html`, preencha o objeto `CONFIG`:

| Campo | Para quê |
| --- | --- |
| `checkoutUrl` | Link de pagamento dos botões de compra |
| `agendaUrl` | Link da agenda do botão "Agendar reunião" |
| `metaPixelId` | ID do Pixel da Meta (só carrega se preenchido) |
| `googleTagId` | ID do GA4 (`G-...`) ou Google Ads (`AW-...`) |

UTMs, `fbclid` e `gclid` da URL são repassados automaticamente para o checkout e a agenda.

## Deploy

Site estático: qualquer push na `main` publica na Vercel.

O que entra no MVP

Para o cliente
Cardápio organizado por categorias, busca e fotos
Itens com variações e adicionais (ex.: tamanho, ponto da carne, extras)
Tipos de pedido: Mesa (com QR), Retirada, Delivery
Checkout com PIX, cartão, Apple/Google Pay, gorjeta
Acompanhamento do pedido em tempo real e recibo
Para o restaurante (Admin)
CRUD de produtos, categorias, opções e combos
Gerenciar mesas e gerar QR Codes únicos
Recebimento e gestão de pedidos (KDS) + impressão na cozinha
Estoque (marcar item como “indisponível”), horários de funcionamento
Taxas: entrega, embalagem, serviço; cupons de desconto
Áreas de entrega (raio ou CEP), tempo estimado
Operacional
Notificações por WhatsApp/SMS/email (pedido confirmado/pronto/saiu)
Webhooks de pagamento para atualizar status automático
Multi-lojas e subdomínios opcionais (ex.: sualoja.seusite.com)
Arquitetura sugerida

PWA do cliente (menu e checkout): rápido, funciona como app, offline básico
Admin/KDS: painel web para o restaurante
API backend: autenticação, pedidos, pagamentos, impressão, delivery
Banco de dados SQL (PostgreSQL) + cache (Redis)
Real-time: WebSockets (Socket.io/Pusher/Ably) para status de pedidos
Integrações: gateway de pagamento (PIX + cartão), CEP/geocoding, WhatsApp/SMS
Impressão: KDS web e/ou impressoras térmicas (ESC/POS via QZ Tray)
Stack (BR-friendly e ágil)

Frontend: Next.js 14 (App Router) + React + Tailwind + PWA
Backend: Node.js + NestJS (ou Express) + Prisma ORM
Banco: PostgreSQL (Supabase/Railway/Render) + Redis
Real-time: Socket.io (self-hosted) ou Pusher/Ably
Pagamentos (PIX e cartão):
Mercado Pago ou Pagar.me (muito usados no BR, suportam PIX/Cartão e split)
Alternativa: Stripe (tem PIX no BR), integração simples e docs excelentes
CEP e mapas: ViaCEP + Mapbox/Google Maps
Notificações: Twilio/Zenvia/TotalVoice (WhatsApp/SMS)
Deploy: Vercel (frontend) + Railway/Fly.io/Render (API) + Supabase (DB/Storage)
Observabilidade: Sentry + Logtail/Datadog
Fluxo do pedido (mesa, QR)

Cliente escaneia o QR (contém merchantId + tableId + token)
Abre o menu daquela loja/mesa; monta o carrinho
Escolhe pagar agora (PIX/cartão) ou “pagar no balcão” (opcional)
API cria o pedido em “aguardando pagamento” ou “recebido”
Webhook do gateway confirma pagamento → muda status → notifica KDS
Cozinha prepara → atualizações em tempo real para o cliente
Pedido concluído → recibo enviado (e gorjeta opcional já no fluxo)
Fluxo do pedido (delivery)

Cliente seleciona delivery, informa CEP (autocompleta via ViaCEP), número e complemento
Sistema verifica cobertura (raio/CEP) e calcula taxa/tempo
Checkout com pagamento
Restaurante aceita → prepara → define “saiu para entrega”
Entrega própria: painel mostra rotas e contato; ou integrar com Loggi/Lalamove
Cliente acompanha status; prova de entrega opcional (foto/assinatura)
Pagamentos (exemplos e boas práticas)

Use o gateway para tokenizar cartão; não armazene dados sensíveis (PCI)
PIX dinâmico por pedido; expiração 15–30 min; atualize via webhook
Gorjeta (percentual ou valor fixo) e divisão de conta podem ficar no roadmap
Exemplo de criação de pagamento PIX (pseudo Node.js)

Mercado Pago:
Crie uma preferência/ordem com valor e descrição; gateway retorna qr_code_base64 e copia e cola; salve paymentId no pedido
Webhook: em /webhooks/pagamentos, valide assinatura e atualize o pedido para “pago” quando status = approved
Stripe:
Crie PaymentIntent com payment_method_types = [“pix”, “card”]
Para PIX, use next_action.pix_display_qr_code ou pix_copy_and_paste
Webhook: eventos payment_intent.succeeded/failed
QR Code por mesa

Estrutura da URL: https://app.com/{loja}/m/{mesa}?t={token}
token curta-vida para evitar abuso; mesa resolve automaticamente no carrinho
Geração: lib qrcode (Node) para produzir PNG/SVG de alta resolução
Painel para imprimir/reimprimir e desativar QR (se extraviar)
Modelo de dados (essencial)

Merchant, Location, Table
Product, Category, OptionGroup, Option (adicionais/variantes)
Order, OrderItem, OrderItemOption
Customer, Address
Payment, Transaction, Refund
DeliveryZone, DeliveryQuote
Obs.: mantenha multi-tenant com merchantId em todas as tabelas.
KDS e impressão

KDS web com filtros por estação (cozinha/bebidas/sobremesas)
Integração com impressora térmica: via QZ Tray (escpos) ou Sunmi/Elgin compatível
Regras de impressão por categoria (ex.: bebidas na impressora do bar)
Segurança e LGPD

Login leve para cliente (telefone/WhatsApp OTP) ou guest com consentimento
Não guardar dados de cartão; termos, política de privacidade e consentimento de marketing
Logs de auditoria (quem mudou preço/estoque)
Rate limit e proteção CSRF/Replay nos webhooks
Roadmap pós-MVP

Dividir conta, comanda individual por mesa
Programas de fidelidade e cupons avançados
Cardápio multilíngua e alergênicos
Integração fiscal (NFC-e/NF-e com TEF ou sistema terceiro)
Integração com iFood/Rappi (agregadores) e ERPs locais
Plano de desenvolvimento (8 semanas referência)

Sem 1: Refinamento de requisitos, UX do cliente e Admin, modelo de dados
Sem 2–3: Admin (produtos, categorias, mesas, QR), autenticação
Sem 3–4: PWA do cliente (menu, carrinho, checkout)
Sem 4–5: Integração de pagamentos (PIX + cartão) + webhooks
Sem 5–6: KDS e impressão + notificações (WhatsApp/SMS)
Sem 6–7: Delivery (CEP, taxa/raio, agendamento) + real-time
Sem 7–8: QA, performance, observabilidade, deploy e onboarding

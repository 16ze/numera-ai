/**
 * Template d'email pour l'envoi de factures
 * Compatible avec toutes les boîtes mail grâce à @react-email/components
 */

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Img,
  Hr,
} from "@react-email/components";

/**
 * Props du template d'email de facture
 */
interface InvoiceEmailProps {
  /** Nom du client */
  clientName: string;
  /** Numéro de la facture */
  invoiceNumber: string;
  /** Montant total TTC de la facture */
  totalAmount: number;
  /** ID de la facture (pour générer le lien) */
  invoiceId: string;
  /** Nom de l'entreprise */
  companyName: string;
  /** URL du logo de l'entreprise (optionnel) */
  companyLogoUrl?: string | null;
  /** URL de base de l'application (pour générer le lien) */
  baseUrl?: string;
}

/**
 * Template d'email pour envoyer une facture à un client
 */
export function InvoiceEmail({
  clientName,
  invoiceNumber,
  totalAmount,
  invoiceId,
  companyName,
  companyLogoUrl,
  baseUrl = "http://localhost:3000",
}: InvoiceEmailProps) {
  /**
   * Formate un montant en euros
   */
  const formatPrice = (amount: number): string => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  /**
   * URL de la facture
   */
  const invoiceUrl = `${baseUrl}/invoices/${invoiceId}`;

  return (
    <Html lang="fr">
      <Head />
      <Body style={main}>
        <Container style={container}>
          {/* Logo ou nom de l'entreprise */}
          <Section style={header}>
            {companyLogoUrl ? (
              <Img
                src={companyLogoUrl}
                alt={`Logo ${companyName}`}
                width="120"
                height="auto"
                style={logo}
              />
            ) : (
              <Text style={companyNameStyle}>{companyName}</Text>
            )}
          </Section>

          {/* Message principal */}
          <Section style={content}>
            <Text style={greeting}>Bonjour {clientName},</Text>
            <Text style={message}>
              Voici votre facture <strong>{invoiceNumber}</strong> d&apos;un
              montant de <strong>{formatPrice(totalAmount)}</strong>.
            </Text>

            {/* Bouton Call to Action */}
            <Section style={buttonContainer}>
              <Button href={invoiceUrl} style={button}>
                📄 Voir la facture
              </Button>
            </Section>

            {/* Lien alternatif si le bouton ne fonctionne pas */}
            <Text style={linkFallback}>
              Si le bouton ne fonctionne pas, copiez ce lien dans votre
              navigateur :
              <br />
              <a href={invoiceUrl} style={link}>
                {invoiceUrl}
              </a>
            </Text>
          </Section>

          {/* Séparateur */}
          <Hr style={divider} />

          {/* Pied de page */}
          <Section style={footer}>
            <Text style={footerText}>Merci de votre confiance</Text>
            <Text style={footerCompany}>{companyName}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Styles pour l'email (inline CSS pour compatibilité)
 */
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const header = {
  padding: "32px 24px",
  textAlign: "center" as const,
  borderBottom: "1px solid #e6ebf1",
};

const logo = {
  maxWidth: "120px",
  height: "auto",
  display: "block",
  margin: "0 auto",
};

const companyNameStyle = {
  fontSize: "24px",
  fontWeight: "bold",
  color: "#1e293b",
  margin: "0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
};

const content = {
  padding: "32px 24px",
};

const greeting = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#334155",
  marginBottom: "16px",
};

const message = {
  fontSize: "16px",
  lineHeight: "26px",
  color: "#334155",
  marginBottom: "32px",
};

const buttonContainer = {
  textAlign: "center" as const,
  margin: "32px 0",
};

const button = {
  backgroundColor: "#3b82f6",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "14px 32px",
  lineHeight: "24px",
};

const linkFallback = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#64748b",
  marginTop: "24px",
  textAlign: "center" as const,
};

const link = {
  color: "#3b82f6",
  textDecoration: "underline",
  wordBreak: "break-all" as const,
};

const divider = {
  borderColor: "#e6ebf1",
  margin: "32px 0",
};

const footer = {
  padding: "24px",
  textAlign: "center" as const,
};

const footerText = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#64748b",
  marginBottom: "8px",
};

const footerCompany = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#1e293b",
  fontWeight: "600",
};

export default InvoiceEmail;


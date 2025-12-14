import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de Confidentialité - Numera AI",
  description:
    "Politique de confidentialité de Numera AI - RGPD, protection des données bancaires, gestion des tokens Plaid",
};

/**
 * Page Politique de Confidentialité
 * Conforme RGPD et requirements Plaid
 */
export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1 className="text-4xl font-bold text-slate-900 mb-4">
        Politique de Confidentialité
      </h1>
      <p className="text-lg text-slate-600 mb-8">
        Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
      </p>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          1. Introduction
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Numera AI (&quot;nous&quot;, &quot;notre&quot;, &quot;la Société&quot;) s&apos;engage à protéger votre
          vie privée et vos données personnelles. Cette politique de confidentialité
          explique comment nous collectons, utilisons, stockons et protégeons vos
          informations personnelles conformément au Règlement Général sur la Protection
          des Données (RGPD) et aux lois françaises applicables.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          2. Données Collectées
        </h2>
        
        <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">
          2.1. Données d&apos;Authentification
        </h3>
        <p className="text-slate-700 leading-relaxed mb-4">
          Nous utilisons <strong>Clerk</strong> comme fournisseur d&apos;identité pour
          gérer l&apos;authentification de nos utilisateurs. Clerk collecte et traite les
          données suivantes :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>Adresse e-mail</li>
          <li>Nom et prénom</li>
          <li>Identifiant utilisateur unique (clerkUserId)</li>
          <li>Historique de connexion</li>
        </ul>
        <p className="text-slate-700 leading-relaxed mb-4">
          Les données d&apos;authentification sont stockées de manière sécurisée par Clerk,
          certifié <strong>SOC 2 Type 2</strong>. Nous ne stockons jamais vos mots de
          passe sur nos serveurs.
        </p>

        <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">
          2.2. Données Bancaires via Plaid
        </h3>
        <p className="text-slate-700 leading-relaxed mb-4">
          Pour vous permettre de connecter vos comptes bancaires et synchroniser
          automatiquement vos transactions, nous utilisons <strong>Plaid</strong>, un
          service tiers certifié et sécurisé.
        </p>
        <p className="text-slate-700 leading-relaxed mb-4">
          <strong>Important :</strong> Nous ne stockons <strong>jamais</strong> vos
          identifiants bancaires (nom d&apos;utilisateur, mot de passe) en clair. Plaid
          gère directement la connexion sécurisée avec votre banque via un protocole
          chiffré.
        </p>
        <p className="text-slate-700 leading-relaxed mb-4">
          Ce que nous stockons :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>
            <strong>Token d&apos;accès (Access Token) :</strong> Un jeton chiffré et
            sécurisé fourni par Plaid qui nous permet de récupérer vos transactions. Ce
            token est stocké de manière chiffrée dans notre base de données.
          </li>
          <li>
            <strong>Item ID :</strong> Identifiant unique de votre connexion bancaire
            chez Plaid (ne contient aucune information bancaire sensible).
          </li>
          <li>
            <strong>Nom de la banque :</strong> Affiché uniquement pour votre information.
          </li>
          <li>
            <strong>4 derniers chiffres du compte :</strong> Pour faciliter
            l&apos;identification du compte.
          </li>
        </ul>
        <p className="text-slate-700 leading-relaxed mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <strong>⚠️ Sécurité :</strong> Vos identifiants bancaires (username, password)
          ne transitent jamais par nos serveurs et ne sont jamais stockés dans notre base
          de données. La connexion se fait directement entre Plaid et votre banque via un
          protocole sécurisé.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          3. Données Financières
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Les données financières suivantes sont collectées et stockées dans notre base
          de données :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>Transactions bancaires (date, montant, description, catégorie)</li>
          <li>Factures émises et reçues</li>
          <li>Informations sur vos clients</li>
          <li>Données de votre entreprise (SIRET, adresse, etc.)</li>
        </ul>
        <p className="text-slate-700 leading-relaxed mb-4">
          Ces données sont stockées de manière sécurisée dans notre base de données
          PostgreSQL hébergée par Supabase, certifiée <strong>ISO 27001</strong> et
          conforme au RGPD.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          4. Base Légale du Traitement (RGPD)
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Conformément au Règlement Général sur la Protection des Données (RGPD), nous
          traitons vos données personnelles sur les bases légales suivantes :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>
            <strong>Consentement :</strong> Vous nous donnez explicitement votre
            consentement en créant un compte et en connectant vos comptes bancaires.
          </li>
          <li>
            <strong>Exécution d&apos;un contrat :</strong> Le traitement est nécessaire
            pour vous fournir nos services de gestion comptable.
          </li>
          <li>
            <strong>Obligation légale :</strong> Nous pouvons être amenés à conserver
            certaines données pour respecter nos obligations comptables et fiscales.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          5. Vos Droits (RGPD)
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Conformément au RGPD, vous disposez des droits suivants :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>
            <strong>Droit d&apos;accès :</strong> Vous pouvez demander l&apos;accès à
            toutes vos données personnelles.
          </li>
          <li>
            <strong>Droit de rectification :</strong> Vous pouvez corriger ou mettre à
            jour vos données via votre profil.
          </li>
          <li>
            <strong>Droit à l&apos;effacement :</strong> Vous pouvez supprimer votre
            compte à tout moment via les paramètres. Toutes vos données seront supprimées
            dans les 30 jours.
          </li>
          <li>
            <strong>Droit à la portabilité :</strong> Vous pouvez exporter vos données au
            format CSV via la fonction d&apos;export comptable.
          </li>
          <li>
            <strong>Droit d&apos;opposition :</strong> Vous pouvez vous opposer au
            traitement de vos données à des fins de marketing.
          </li>
          <li>
            <strong>Droit de retirer votre consentement :</strong> Vous pouvez déconnecter
            vos comptes bancaires à tout moment.
          </li>
        </ul>
        <p className="text-slate-700 leading-relaxed mb-4">
          Pour exercer ces droits, contactez-nous à :{" "}
          <a
            href="mailto:privacy@numera.ai"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            privacy@numera.ai
          </a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          6. Partage des Données
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Nous ne vendons jamais vos données personnelles à des tiers. Nous partageons
          vos données uniquement avec :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>
            <strong>Clerk :</strong> Pour l&apos;authentification et la gestion des
            utilisateurs.
          </li>
          <li>
            <strong>Plaid :</strong> Pour la connexion bancaire (uniquement si vous
            choisissez de connecter un compte).
          </li>
          <li>
            <strong>Supabase :</strong> Pour l&apos;hébergement sécurisé de notre base de
            données.
          </li>
          <li>
            <strong>Vercel :</strong> Pour l&apos;hébergement de notre application.
          </li>
        </ul>
        <p className="text-slate-700 leading-relaxed mb-4">
          Tous nos prestataires sont certifiés et conformes au RGPD.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          7. Sécurité
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles
          appropriées pour protéger vos données :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>Chiffrement des données en transit (HTTPS/TLS)</li>
          <li>Chiffrement des tokens d&apos;accès Plaid</li>
          <li>Authentification multifacteurs pour les utilisateurs (via Clerk)</li>
          <li>Accès restreint aux données (principe du moindre privilège)</li>
          <li>Backups chiffrés et sécurisés</li>
          <li>Surveillance et audit réguliers</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          8. Conservation des Données
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Vos données sont conservées tant que votre compte est actif. En cas de
          suppression de compte, toutes vos données sont supprimées définitivement dans
          les 30 jours suivant la demande.
        </p>
        <p className="text-slate-700 leading-relaxed mb-4">
          Pour plus de détails, consultez notre{" "}
          <Link
            href="/legal/data-retention"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Politique de Conservation et d&apos;Élimination des Données
          </Link>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          9. Contact
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Pour toute question concernant cette politique de confidentialité ou le
          traitement de vos données, contactez-nous :
        </p>
        <ul className="list-none text-slate-700 space-y-2 mb-4">
          <li>
            <strong>Email :</strong>{" "}
            <a
              href="mailto:privacy@numera.ai"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              privacy@numera.ai
            </a>
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          10. Modifications
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Nous nous réservons le droit de modifier cette politique de confidentialité à
          tout moment. Les modifications importantes vous seront notifiées par e-mail ou
          via une notification dans l&apos;application.
        </p>
      </section>
    </article>
  );
}


import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de Conservation et d'Élimination des Données - Numera AI",
  description:
    "Politique de conservation et d'élimination des données de Numera AI - Conformité RGPD, suppression des données, backups",
};

/**
 * Page Politique de Conservation et d'Élimination des Données
 * Conforme RGPD et requirements Plaid
 */
export default function DataRetentionPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1 className="text-4xl font-bold text-slate-900 mb-4">
        Politique de Conservation et d&apos;Élimination des Données
      </h1>
      <p className="text-lg text-slate-600 mb-8">
        Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
      </p>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          1. Principes Généraux
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Numera AI s&apos;engage à respecter le principe de limitation de la conservation
          des données énoncé dans le Règlement Général sur la Protection des Données
          (RGPD). Nous ne conservons vos données personnelles que le temps nécessaire aux
          fins pour lesquelles elles ont été collectées, sauf obligation légale ou
          réglementaire contraire.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          2. Période de Conservation
        </h2>
        
        <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">
          2.1. Compte Actif
        </h3>
        <p className="text-slate-700 leading-relaxed mb-4">
          <strong>Durée :</strong> Vos données sont conservées tant que votre compte est
          actif.
        </p>
        <p className="text-slate-700 leading-relaxed mb-4">
          Un compte est considéré comme actif si :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>Vous vous connectez régulièrement à l&apos;application</li>
          <li>Vous utilisez nos services (création de factures, ajout de transactions, etc.)</li>
          <li>Vous n&apos;avez pas demandé la suppression de votre compte</li>
        </ul>
        <p className="text-slate-700 leading-relaxed mb-4">
          <strong>Données conservées pendant la période d&apos;activité :</strong>
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>Données d&apos;authentification (via Clerk)</li>
          <li>Données de profil et entreprise</li>
          <li>Toutes vos transactions bancaires</li>
          <li>Toutes vos factures</li>
          <li>Informations sur vos clients</li>
          <li>Tokens d&apos;accès Plaid (pour la connexion bancaire)</li>
          <li>Logs d&apos;activité (pour la sécurité et le support)</li>
        </ul>

        <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">
          2.2. Compte Inactif
        </h3>
        <p className="text-slate-700 leading-relaxed mb-4">
          Si votre compte reste inactif pendant plus de <strong>3 ans</strong>, nous
          vous contacterons par e-mail pour vous informer de notre intention de supprimer
          vos données. Si vous ne répondez pas dans un délai de 30 jours, votre compte
          et toutes vos données seront supprimés définitivement.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          3. Suppression des Données
        </h2>
        
        <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">
          3.1. Demande de Suppression par l&apos;Utilisateur
        </h3>
        <p className="text-slate-700 leading-relaxed mb-4">
          Vous pouvez demander la suppression de votre compte et de toutes vos données à
          tout moment via :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>
            <strong>Les paramètres de l&apos;application :</strong> Section
            &quot;Supprimer mon compte&quot; (disponible dans les paramètres utilisateur)
          </li>
          <li>
            <strong>Email :</strong> En nous contactant à{" "}
            <a
              href="mailto:privacy@numera.ai"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              privacy@numera.ai
            </a>
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">
          3.2. Processus de Suppression (Soft Delete puis Hard Delete)
        </h3>
        <p className="text-slate-700 leading-relaxed mb-4 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <strong>⚠️ Important :</strong> La suppression est définitive et irréversible.
          Assurez-vous d&apos;exporter vos données avant de supprimer votre compte.
        </p>
        
        <div className="mt-4 mb-4">
          <p className="text-slate-700 leading-relaxed mb-3">
            <strong>Étape 1 - Soft Delete (Suppression Logicielle) :</strong>
          </p>
          <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
            <li>
              Immédiatement après votre demande, votre compte est marqué comme
              &quot;supprimé&quot; (soft delete)
            </li>
            <li>Vous ne pouvez plus vous connecter à l&apos;application</li>
            <li>Vos données restent dans la base de données mais ne sont plus accessibles</li>
            <li>
              <strong>Durée :</strong> 30 jours (période de grâce pour annuler la suppression)
            </li>
          </ul>
        </div>

        <div className="mt-4 mb-4">
          <p className="text-slate-700 leading-relaxed mb-3">
            <strong>Étape 2 - Hard Delete (Suppression Définitive) :</strong>
          </p>
          <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
            <li>
              Après <strong>30 jours</strong>, toutes vos données sont supprimées
              définitivement de notre base de données
            </li>
            <li>
              <strong>Données supprimées :</strong>
              <ul className="list-circle list-inside ml-6 mt-2 space-y-1">
                <li>Votre compte utilisateur et profil</li>
                <li>Toutes vos transactions bancaires</li>
                <li>Toutes vos factures et leurs lignes</li>
                <li>Informations sur vos clients</li>
                <li>Tokens d&apos;accès Plaid (révoqués et supprimés)</li>
                <li>Logs d&apos;activité associés à votre compte</li>
              </ul>
            </li>
            <li>
              <strong>Réduction des tokens Plaid :</strong> Nous révoquons également les
              tokens d&apos;accès Plaid via l&apos;API Plaid pour garantir qu&apos;ils ne
              peuvent plus être utilisés
            </li>
          </ul>
        </div>

        <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">
          3.3. Annulation de la Suppression
        </h3>
        <p className="text-slate-700 leading-relaxed mb-4">
          Si vous changez d&apos;avis dans les <strong>30 jours</strong> suivant la
          demande de suppression, vous pouvez annuler en nous contactant à{" "}
          <a
            href="mailto:privacy@numera.ai"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            privacy@numera.ai
          </a>
          . Votre compte sera restauré avec toutes vos données.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          4. Backups et Archives
        </h2>
        
        <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">
          4.1. Backups Automatiques
        </h3>
        <p className="text-slate-700 leading-relaxed mb-4">
          Notre base de données est sauvegardée automatiquement par{" "}
          <strong>Supabase</strong>, notre fournisseur d&apos;infrastructure :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>
            <strong>Fréquence :</strong> Backups quotidiens automatiques
          </li>
          <li>
            <strong>Chiffrement :</strong> Tous les backups sont chiffrés avec des clés
            de chiffrement gérées par Supabase
          </li>
          <li>
            <strong>Conservation :</strong> Les backups sont conservés pendant{" "}
            <strong>30 jours</strong> maximum
          </li>
          <li>
            <strong>Localisation :</strong> Backups stockés dans des datacenters certifiés
            et conformes au RGPD (région Europe)
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">
          4.2. Suppression des Backups
        </h3>
        <p className="text-slate-700 leading-relaxed mb-4">
          Lors de la suppression définitive de votre compte (hard delete), vos données
          seront également supprimées des backups dans les <strong>30 jours</strong> suivant
          la suppression de la base de données principale.
        </p>
        <p className="text-slate-700 leading-relaxed mb-4">
          <strong>Garantie :</strong> Au-delà de 60 jours après votre demande de suppression,
          vos données n&apos;existent plus nulle part dans nos systèmes, y compris dans les
          backups.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          5. Obligations Légales et Réglementaires
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Dans certains cas, nous pouvons être tenus de conserver certaines données
          pendant des durées plus longues pour respecter nos obligations légales :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>
            <strong>Obligations comptables :</strong> En France, les documents comptables
            doivent être conservés pendant 10 ans
          </li>
          <li>
            <strong>Obligations fiscales :</strong> Conservation des données nécessaires
            pour répondre aux demandes de l&apos;administration fiscale
          </li>
          <li>
            <strong>Résolution de litiges :</strong> Conservation des données nécessaires
            en cas de procédure judiciaire en cours
          </li>
        </ul>
        <p className="text-slate-700 leading-relaxed mb-4">
          Si une obligation légale nous impose de conserver certaines données, nous vous
          en informerons lors de votre demande de suppression.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          6. Export des Données
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Avant de supprimer votre compte, vous pouvez exporter toutes vos données au
          format CSV via la fonction d&apos;export comptable disponible dans les
          paramètres de l&apos;application.
        </p>
        <p className="text-slate-700 leading-relaxed mb-4">
          L&apos;export inclut :
        </p>
        <ul className="list-disc list-inside text-slate-700 space-y-2 mb-4 ml-4">
          <li>Toutes vos transactions</li>
          <li>Toutes vos factures et leurs détails</li>
          <li>Informations sur vos clients</li>
          <li>Données de votre entreprise</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-4">
          7. Contact
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Pour toute question concernant la conservation ou la suppression de vos données,
          contactez-nous :
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
          8. Modifications
        </h2>
        <p className="text-slate-700 leading-relaxed mb-4">
          Cette politique peut être modifiée à tout moment. Les modifications importantes
          vous seront notifiées par e-mail ou via une notification dans l&apos;application.
        </p>
      </section>
    </article>
  );
}


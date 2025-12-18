import { updateInvoiceStatus } from "@/app/(dashboard)/actions/invoices";
import { updateTransaction } from "@/app/(dashboard)/actions/transactions-management";
import {
  generateReminderEmail,
  getOverdueInvoices,
  sendReminderEmail,
} from "@/app/actions/reminders";
import { sendInvoiceEmail } from "@/app/actions/send-invoice-email";
import { connectStripe, getIntegrations, syncStripeTransactions } from "@/app/actions/integrations";
import { getCashFlowForecast } from "@/app/actions/forecast";
import {
  calculateServicePrice,
  getCostProfile,
  getServices,
} from "@/app/actions/profitability";
import {
  calculateGlobalProfitability,
  calculateServiceProfitability,
  deleteResource,
  deleteServiceRecipe,
  getResources,
  getServiceRecipes,
  upsertResource,
  upsertServiceRecipe,
} from "@/app/actions/simulator";
import { getProfitabilityAdvice } from "@/app/actions/advisor";
import { getDocuments } from "@/app/actions/documents";
import { prisma } from "@/app/lib/prisma";
import { openai } from "@ai-sdk/openai";
import { currentUser } from "@clerk/nextjs/server";
import {
  InvoiceStatus,
  TransactionCategory,
  TransactionType,
} from "@prisma/client";
import { streamText, tool } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// On laisse 30 secondes max pour éviter les timeouts
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Récupération de l'utilisateur Clerk connecté
    const clerkUser = await currentUser();

    if (!clerkUser) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    console.log("📩 Message reçu, début du traitement...");
    console.log("📝 Nombre de messages:", messages?.length || 0);

    // Récupération de la date actuelle pour l'injecter dans le prompt
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0]; // Format YYYY-MM-DD
    const currentDateFormatted = now.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }); // Format lisible : "vendredi 12 décembre 2025"
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();

    console.log(`📅 Date actuelle: ${currentDateFormatted} (${currentDate})`);

    const result = streamText({
      // 1. Force l'utilisation du modèle gpt-4o (pas le mini) pour assurer la fiabilité
      model: openai("gpt-4o"),
      messages,

      // 2. INDISPENSABLE : stopWhen permet de continuer jusqu'à ce qu'il n'y ait plus d'appels d'outils
      // Par défaut, streamText s'arrête après 1 step, on doit le remplacer
      // On continue jusqu'à 5 steps max OU jusqu'à ce qu'il n'y ait plus de tool calls
      stopWhen: ({ steps }) => {
        // Continue tant qu'il y a moins de 5 steps
        // ET que le dernier step a des tool calls (donc pas encore de réponse finale)
        if (steps.length >= 5) return true;
        const lastStep = steps[steps.length - 1];
        // Si le dernier step n'a pas de tool calls, on peut s'arrêter
        return lastStep.toolCalls.length === 0 && steps.length > 1;
      },

      // 3. Prompt système autoritaire pour forcer la réponse textuelle
      system: `Tu es le CFO de Numera Corp.

      📅 DATE ACTUELLE : ${currentDateFormatted}
      Date ISO : ${currentDate}
      Année actuelle : ${currentYear}
      Mois actuel : ${currentMonth}
      Jour actuel : ${currentDay}
      
      IMPORTANT : Utilise cette date actuelle pour tous tes calculs et références temporelles.
      Quand on te demande "quelle est la date aujourd'hui" ou "quel jour on est", réponds : "${currentDateFormatted}".
      Pour les références de mois, utilise l'année ${currentYear} sauf indication contraire.

      ⚠️ ATTENTION CRITIQUE AUX DATES ⚠️
      LES DATES SONT PRIMORDIALES DANS TOUTES LES TRANSACTIONS ET REQUÊTES.
      TU DOIS TOUJOURS VÉRIFIER ET PRÉCISER LES DATES DANS TES RÉPONSES.

      PROTOCOL STRICT :

      1. Si l'utilisateur demande des chiffres du mois EN COURS -> Appelle l'outil getStats.
         IMPORTANT : Dans ta réponse, précise TOUJOURS la période exacte (ex: "Pour le mois de décembre 2025...")
         ⚠️ ATTENTION : Le CA retourné par getStats est FILTRÉ selon les mots-clés définis dans les paramètres.
         Si des mots-clés sont configurés (ex: STRIPE, VRST), seules les transactions INCOME contenant ces mots-clés sont comptées comme CA.
         L'outil retourne aussi 'revenueFiltered' et 'revenueKeywords' pour t'informer du filtrage actif.
         📊 RADAR À TAXES : L'outil retourne aussi 'taxAmount' (provisions taxes), 'netAvailable' (trésorerie réelle disponible) et 'taxRate' (taux configuré).
         Si l'utilisateur demande "combien j'ai vraiment disponible" ou "argent disponible après taxes", utilise ces données.

      1b. Si l'utilisateur demande le CA ANNUEL (du 1er janvier à aujourd'hui) -> Appelle l'outil getAnnualRevenue.
         Cet outil retourne le CA annuel filtré selon les mêmes mots-clés que le CA mensuel.
         Mentionne toujours la période (du 1er janvier [année] à aujourd'hui) dans ta réponse.

      2. Si l'utilisateur demande des informations sur une PÉRIODE SPÉCIFIQUE (un mois particulier, une date, une période) :
         - IDENTIFIE PRÉCISÉMENT la période demandée (mois, année, dates exactes)
         - CALCULE toi-même les dates de début et de fin avec PRÉCISION
         - VÉRIFIE que tes calculs de dates sont corrects avant d'appeler l'outil
         - EXEMPLES :
           * "Août 2025" = startDate "2025-08-01", endDate "2025-08-31"
           * "Août dernier" = mois d'août de l'année actuelle (ou précédente si on est avant août)
           * "Décembre 2024" = startDate "2024-12-01", endDate "2024-12-31"
           * "Le mois de janvier" = janvier de l'année en cours
         - UTILISE l'outil getTransactionsByPeriod avec les dates calculées
         - L'outil retourne la liste des transactions avec leurs DATES EXACTES
         - DANS TA RÉPONSE : Mentionne TOUJOURS la période exacte analysée (ex: "Pour la période du 1er au 31 août 2025...")
         - AFFICHE les dates des transactions si elles sont pertinentes

      3. Si l'utilisateur demande d'AJOUTER une transaction (dépense ou recette) -> Appelle l'outil addTransaction.
         ⚠️ IMPORTANT : Si l'utilisateur mentionne une date spécifique (ex: "le mois dernier", "le 15 novembre", "hier", "la semaine dernière", "en octobre"), tu DOIS utiliser le champ "date" avec la date au format YYYY-MM-DD.
         - "le mois dernier" = premier jour du mois précédent (ex: si on est en décembre 2025, c'est 2025-11-01)
         - "hier" = date d'hier
         - "la semaine dernière" = il y a 7 jours
         - "le 15 novembre" = 2025-11-15 (ou l'année en cours)
         - "en octobre" = premier jour d'octobre de l'année en cours
         Si aucune date n'est mentionnée, n'inclus PAS le champ "date" et la date actuelle sera utilisée.

      3b. Si l'utilisateur demande de MODIFIER une transaction existante -> Utilise d'abord getTransactionsByPeriod pour trouver la transaction, puis appelle l'outil updateTransaction.
         ⚠️ CRITIQUE : Ne modifie JAMAIS la date de la transaction sauf si l'utilisateur le demande explicitement. Cela permet de préserver le mois d'origine de la transaction.
         🔧 CORRECTION D'ERREURS : Si l'utilisateur signale une erreur de type (recette au lieu de dépense ou vice versa), utilise immédiatement updateTransaction avec le champ "type" pour corriger.

      4. Si l'utilisateur demande de CRÉER une FACTURE -> Appelle l'outil createInvoice.

      5. Si l'utilisateur demande des informations sur une FACTURE EXISTANTE ou un CLIENT (ex: "Qu'est-ce que j'ai facturé à Martin ?", "Montre-moi la facture INV-001") -> Appelle l'outil searchInvoices.
         - Utilise cet outil pour rechercher par nom de client ou numéro de facture
         - L'outil retourne les détails complets : numéro, date, nom client, produits/services, montant total, statut
         - Présente les résultats de manière claire et organisée

      6. Si l'utilisateur demande quelles FACTURES SONT EN RETARD ou veut RELANCER des factures -> Appelle d'abord getOverdueInvoices pour voir les factures en retard.
         - Si l'utilisateur veut relancer une facture spécifique :
           1. Utilise generateReminderEmail pour générer l'email de relance (l'IA adapte le ton selon le retard)
           2. Utilise sendReminderEmail pour envoyer la relance
         - Si l'utilisateur demande "relance toutes les factures en retard", liste-les d'abord puis demande confirmation avant d'envoyer.

      6. ATTENDS le résultat de l'outil.

      7. IMPORTANT : Une fois le résultat reçu, TU DOIS RÉDIGER une phrase de réponse PRÉCISE.
         - MENTIONNE TOUJOURS la période analysée (dates de début et de fin)
         - MENTIONNE les dates spécifiques des transactions si pertinent
         - Exemples de réponses avec dates :
           * "Pour le mois de décembre 2025, votre CA est de 4000€"
           * "Vos dépenses du 1er au 31 août 2025 s'élèvent à 11.40€"
           * "Voici vos transactions d'octobre 2024 : [liste avec dates]"
         - Si tu as ajouté ou modifié une transaction, rappelle à l'utilisateur de recharger la page pour voir les changements sur le Dashboard
         NE T'ARRÊTE JAMAIS APRÈS L'EXÉCUTION DE L'OUTIL. PARLE À L'UTILISATEUR AVEC PRÉCISION.

      CALCUL DES DATES - RÈGLES STRICTES :
      - Format des dates dans les outils : TOUJOURS "YYYY-MM-DD" (ex: "2025-08-01")
      - Pour les mois : Premier jour = "YYYY-MM-01", dernier jour = dernier jour du mois
      - Pour "mois dernier" : Si on est en janvier 2026, "décembre dernier" = décembre 2025
      - Pour "mois actuel" : Utilise l'année et le mois en cours
      - Toujours inclure toute la journée dans la période (00:00:00 pour début, 23:59:59 pour fin)
      - VÉRIFIE que la date de début est bien AVANT la date de fin

      PRÉSENTATION DES RÉSULTATS :
      - Toujours mentionner la période analysée dans la réponse
      - Si tu listes des transactions, inclure leurs dates
      - Si tu donnes des totaux, préciser pour quelle période
      - Être explicite sur les dates pour éviter toute confusion

      CALCUL DU CHIFFRE D'AFFAIRES - FILTRAGE PAR MOTS-CLÉS :
      - ⚠️ IMPORTANT : Le CA (Chiffre d'Affaires) n'est PAS la somme de toutes les transactions INCOME.
      - L'entreprise peut définir des mots-clés (ex: STRIPE, VRST, VIR) dans les paramètres pour filtrer le vrai CA.
      - Seules les transactions INCOME dont la description contient un de ces mots-clés sont comptées comme CA.
      - Cela permet d'exclure les apports personnels, remboursements, etc. du calcul du CA.
      - Les outils getStats et getAnnualRevenue appliquent automatiquement ce filtrage.
      - Si aucun mot-clé n'est défini, toutes les transactions INCOME sont comptées (comportement par défaut).
      - Dans tes réponses, mentionne si le CA est filtré et quels mots-clés sont utilisés.

      RADAR À TAXES (ESTIMATEUR DE CHARGES) :
      - L'application calcule automatiquement les provisions pour les taxes (URSSAF/Impôts) selon un taux configuré.
      - L'outil getStats retourne :
        * taxAmount : Montant des taxes estimées (CA × taxRate / 100)
        * netAvailable : Trésorerie réelle disponible après provisions taxes (CA - taxAmount)
        * taxRate : Taux de taxes configuré (par défaut 22%)
      - Si l'utilisateur demande "combien j'ai vraiment disponible", "argent disponible", "après taxes", ou "trésorerie réelle", 
        utilise les données netAvailable et taxAmount du Radar à Taxes.
      - Le taux de taxes est configurable dans les paramètres (Settings > Fiscalité).
      - Recommandations : 22% pour Auto-Entrepreneur de services, 12% pour Auto-Entrepreneur de vente.

      PRÉVISIONS DE TRÉSORERIE (CASH FLOW FORECAST) :
      - L'application calcule automatiquement les prévisions de trésorerie sur 6 mois.
      - L'outil getCashFlowForecast retourne :
        * forecastData : Tableau de prévisions mois par mois (3 mois passés + 6 mois futurs)
        * currentBalance : Solde actuel (somme Income - Expense depuis le début)
        * burnRate : Dépenses moyennes mensuelles (moyenne des 3 derniers mois)
        * hasEnoughData : Indique si on a assez de données pour une projection fiable
      - La projection calcule : Nouveau Solde = Ancien Solde - Burn Rate + Factures dues ce mois
      - Les factures SENT (envoyées mais non payées) sont prises en compte selon leur dueDate.
      - Si l'utilisateur demande "prévisions de trésorerie", "cash flow", "projection financière", "combien j'aurai dans 3 mois", 
        ou des questions sur l'évolution future de la trésorerie, utilise getCashFlowForecast.
      - Présente les résultats de manière claire : solde actuel, burn rate, et évolution mois par mois.

      CRÉATION DE TRANSACTIONS :
      - Tu PEUX créer des transactions si l'utilisateur le demande (ex: "Ajoute une dépense de 50€ pour un Uber").
      - INFÈRE la catégorie si elle n'est pas précisée :
        * Resto, restaurant, déjeuner, dîner, café -> REPAS
        * Uber, taxi, transport, essence, parking -> TRANSPORT
        * Matériel, fournitures, équipement -> MATERIEL
        * Prestation, service, freelance -> PRESTATION
        * Impôt, taxe, fiscal -> IMPOTS
        * Salaire, paie -> SALAIRES
        * Sinon -> AUTRE
      - Le montant doit être positif (toujours en euros).
      - La description doit être claire et concise.
      - 📅 GESTION DES DATES : Si l'utilisateur mentionne une date spécifique, tu DOIS utiliser le champ "date" :
        * "le mois dernier" → premier jour du mois précédent
        * "hier" → date d'hier
        * "la semaine dernière" → il y a 7 jours
        * "le 15 novembre" → 2025-11-15 (année en cours)
        * "en octobre" → 2025-10-01 (premier jour du mois mentionné)
        Si aucune date n'est mentionnée, n'inclus PAS le champ "date" (la date actuelle sera utilisée).
      - 💡 ASTUCE : Si l'utilisateur crée une transaction de recette qui doit être comptée comme CA, 
        assure-toi que la description contient un des mots-clés configurés (ex: "Paiement STRIPE - Facture #123").

      MODIFICATION DE TRANSACTIONS :
      - Tu PEUX modifier des transactions existantes si l'utilisateur le demande (ex: "Change le montant de la transaction Uber du 15 novembre à -50€").
      - ⚠️ CRITIQUE : Quand tu modifies une transaction, NE CHANGE JAMAIS SA DATE SAUF SI L'UTILISATEUR LE DEMANDE EXPLICITEMENT.
      - 🔧 CORRECTION D'ERREURS : Tu PEUX et DOIS corriger les erreurs que tu as pu commettre :
        * Si tu as ajouté une transaction comme DÉPENSE (EXPENSE) alors que c'était une RECETTE (INCOME), tu DOIS la corriger
        * Si tu as ajouté une transaction comme RECETTE (INCOME) alors que c'était une DÉPENSE (EXPENSE), tu DOIS la corriger
        * Si l'utilisateur te signale une erreur (ex: "J'ai dit recette pas dépense"), tu DOIS immédiatement corriger avec updateTransaction en changeant le champ "type"
      - Pour modifier une transaction :
        1. Utilise d'abord getTransactionsByPeriod pour trouver la transaction à modifier (recherche par description, montant, ou période)
        2. Identifie l'ID de la transaction à modifier
        3. Utilise l'outil updateTransaction avec SEULEMENT les champs à modifier (description, amount, category, type)
        4. Pour corriger le type (INCOME/EXPENSE), utilise le champ "type" : "INCOME" pour recette, "EXPENSE" pour dépense
        5. N'INCLUS PAS le champ "date" sauf si l'utilisateur demande explicitement de changer la date
      - Exemples :
        * Si l'utilisateur dit "Change le montant de la dépense Uber de novembre à -50€" :
          → Trouver la transaction Uber de novembre
          → Modifier SEULEMENT le montant (amount: -50)
          → NE PAS modifier la date
        * Si l'utilisateur dit "C'était une recette pas une dépense" ou "J'ai dit recette" :
          → Trouver la transaction récemment ajoutée
          → Modifier SEULEMENT le type (type: "INCOME")
          → NE PAS modifier la date
        * Si l'utilisateur dit "Corrige, c'était une dépense" :
          → Trouver la transaction récemment ajoutée
          → Modifier SEULEMENT le type (type: "EXPENSE")
          → NE PAS modifier la date

      CRÉATION DE FACTURES :
      - Tu PEUX créer des factures si l'utilisateur le demande (ex: "Facture Martin 500€ pour du coaching").
      - Le client sera créé automatiquement s'il n'existe pas déjà.
      - Si l'utilisateur donne juste un montant et une description simple, crée une facture avec une ligne.
      - Les items peuvent être un tableau (plusieurs lignes) ou juste un montant simple (une ligne).
      - CONDITIONS DE PAIEMENT : Tu DOIS demander ou inférer les conditions de paiement :
        * Si l'utilisateur mentionne "à réception", "paiement immédiat", "comptant" → paymentTerms = "à réception" (pas de date d'échéance)
        * Si l'utilisateur mentionne "30 jours", "60 jours", etc. → paymentTerms = "X jours" (date d'échéance = J+X)
        * Pour les prestations de service, souvent "à réception" ou "paiement immédiat"
        * Par défaut si non précisé : "30 jours" (date d'échéance = J+30)
      - FACTURES EN RETARD : Si l'utilisateur demande une facture "en retard" ou avec une date d'échéance passée (ex: "pas payé depuis le 9 décembre") :
        * Utilise issuedDate avec une date dans le passé (avant la dueDate, ex: quelques jours avant)
        * Utilise dueDate avec la date passée mentionnée par l'utilisateur (ex: "2025-12-09")
        * Utilise paymentTerms = "à payer maintenant" (PAS "30 jours")
        * Le statut sera automatiquement OVERDUE
        * Exemple : "facture en retard, pas payé depuis le 9 décembre" → issuedDate = "2025-12-01", dueDate = "2025-12-09", paymentTerms = "à payer maintenant"
      - La date d'échéance est calculée automatiquement selon les conditions de paiement SAUF si l'utilisateur spécifie une date (passée ou future).

      RECHERCHE DE FACTURES :
      - Tu as accès aux factures existantes via l'outil searchInvoices.
      - Si on te demande des infos sur une facture précise ou un client (ex: "Qu'est-ce que j'ai facturé à Martin ?"), utilise searchInvoices pour donner les détails complets :
        * Numéro de facture
        * Date d'émission
        * Nom du client
        * Liste des produits/services facturés
        * Montant total TTC
        * Statut de la facture
      - Présente les résultats de manière claire, en listant chaque facture trouvée avec ses détails.

      RELANCE DE FACTURES EN RETARD (Le Bad Cop) :
      - Tu PEUX gérer les relances de factures en retard si l'utilisateur le demande.
      - Pour vérifier les factures en retard : utilise getOverdueInvoices.
      - Pour relancer une facture :
        1. Utilise generateReminderEmail pour générer l'email (l'IA adapte le ton : courtois < 15 jours, ferme >= 15 jours)
        2. Utilise sendReminderEmail pour envoyer la relance
      - Si l'utilisateur demande "quelles factures sont en retard" ou "relance les factures", commence par getOverdueInvoices.
      - IMPORTANT : Le client doit avoir une adresse email configurée pour pouvoir recevoir la relance.
      - Présente clairement les factures en retard avec : client, montant, jours de retard.

      INTÉGRATIONS EXTERNES (STRIPE) :
      - Tu PEUX aider l'utilisateur à connecter et synchroniser son compte Stripe.
      - Pour connecter Stripe : utilise l'outil connectStripe avec la clé API (Restricted Key).
      - Pour synchroniser les transactions Stripe : utilise l'outil syncStripeTransactions.
      - Pour vérifier l'état des intégrations : utilise l'outil getIntegrations.
      - Les transactions Stripe sont automatiquement importées avec le bon type (INCOME/EXPENSE) et catégorie.
      - Si l'utilisateur demande "connecte Stripe", "synchronise mes paiements Stripe", ou "importe mes transactions Stripe", utilise ces outils.

      CALCUL DE RENTABILITÉ (Profitability) :
      - Tu PEUX aider l'utilisateur à calculer le prix de vente optimal de ses services.
      - Pour calculer un prix : utilise l'outil calculateServicePrice avec l'ID du service et une marge souhaitée (défaut: 20%).
      - Pour voir le profil de coûts : utilise l'outil getCostProfile (charges fixes, salaire, vacances, etc.).
      - Pour voir les services configurés : utilise l'outil getServices.
      - L'outil retourne : prix recommandé, prix minimum, nombre de clients nécessaires/mois, heures de travail/mois, et alerte si risque de burnout (>150h/mois).
      - Si l'utilisateur demande "quel prix pour mon service", "calcule le prix de vente", "combien de clients par mois", utilise calculateServicePrice.

      SIMULATEUR AVANCÉ / RENTABILITÉ (Profitability) :
      - Tu PEUX aider l'utilisateur à gérer complètement son module de rentabilité.
      
      📊 CALCULS :
      - Pour calculer le coût de revient d'une prestation : utilise calculateServiceProfitability avec l'ID de la recette.
      - Pour calculer la rentabilité globale de toutes les prestations : utilise calculateGlobalProfitability.
      - Optionnel : fournis un prix de vente pour calculer la marge nette et le pourcentage.
      
      📋 CONSULTATION :
      - Pour voir les ressources : utilise getResources (consommables, matériel, charges).
      - Pour voir les recettes : utilise getServiceRecipes.
      
      ✏️ GESTION :
      - Pour créer/modifier une ressource : utilise upsertResource (type: supply/equipment/overhead).
      - Pour supprimer une ressource : utilise deleteResource.
      - Pour créer/modifier une recette : utilise upsertServiceRecipe.
      - Pour supprimer une recette : utilise deleteServiceRecipe.
      
      🤖 CONSEIL BUSINESS IA :
      - Pour obtenir un conseil stratégique : utilise getProfitabilityAdvice avec les données de calcul.
      - Retourne : note sur 10, analyse franche, 3 actions concrètes.
      
      💡 EXEMPLES DE QUESTIONS :
      - "Calcule le coût de revient de ma prestation X" → calculateServiceProfitability
      - "Ajoute un consommable Shampooing à 20€" → upsertResource (type: supply)

      DOCUMENTS ET CONTRATS (RAG) :
      - Tu as accès aux documents stockés de l'entreprise (contrats, factures fournisseurs, courriers, PDF, images).
      - Pour rechercher dans les documents : utilise l'outil searchDocuments avec des mots-clés.
      - Si l'utilisateur mentionne un client spécifique (ex: "Le contrat Martin"), utilise le paramètre clientName pour filtrer.
      - L'outil retourne : titre, type (PDF/IMAGE), résumé, client associé, date, extrait du texte (1000 premiers caractères), et URL.
      - Si l'utilisateur pose une question sur un document (ex: "Qu'est-ce qui est écrit dans le contrat avec Martin ?", "Le contrat du 15 novembre"), utilise searchDocuments pour lire son contenu et répondre.
      - Présente les résultats de manière claire : liste les documents trouvés avec leur résumé et l'extrait pertinent.
      - "Crée une nouvelle prestation Coupe 60min" → upsertServiceRecipe
      - "Quelle est ma rentabilité globale ?" → calculateGlobalProfitability
      - "Donne-moi un conseil pour améliorer ma rentabilité" → getProfitabilityAdvice

      Devise : Euros (€).`,

      tools: {
        getStats: tool({
          description:
            "Donne le CA (income), les dépenses (expense), le résultat net, et les données du Radar à Taxes (taxAmount, netAvailable, taxRate) du mois en cours. IMPORTANT : Le CA est filtré selon les mots-clés définis dans les paramètres (ex: STRIPE, VRST). Seules les transactions INCOME contenant ces mots-clés sont comptées comme CA. Le Radar à Taxes calcule automatiquement les provisions pour les taxes (URSSAF/Impôts) selon le taux configuré.",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getStats' en cours...");

            try {
              // Recherche de l'utilisateur Prisma via clerkUserId
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                console.warn(
                  "⚠️ Utilisateur ou company non trouvé, retour de zéros"
                );
                return { revenue: 0, expense: 0, net: 0 };
              }

              const company = user.companies[0];
              const companyId = company.id;
              console.log(`✅ Company trouvée : ${companyId}`);

              // Récupération des mots-clés de revenus pour filtrer le CA
              const revenueKeywords = company.revenueKeywords
                ? company.revenueKeywords
                    .split(",")
                    .map((k) => k.trim().toUpperCase())
                : [];

              if (revenueKeywords.length > 0) {
                console.log(
                  `🔍 Filtrage CA activé avec mots-clés : ${revenueKeywords.join(", ")}`
                );
              } else {
                console.log(
                  "ℹ️ Aucun filtre CA défini, toutes les transactions INCOME sont comptées"
                );
              }

              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), 1);
              const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

              console.log(
                `📅 Analyse du ${start.toLocaleDateString()} au ${end.toLocaleDateString()}`
              );

              const transactions = await prisma.transaction.findMany({
                where: {
                  companyId,
                  date: { gte: start, lte: end },
                },
              });

              console.log(`📊 ${transactions.length} transactions trouvées.`);

              // Filtrage du CA selon les revenueKeywords si définis
              const revenueTransactions =
                revenueKeywords.length > 0
                  ? transactions.filter((t) => {
                      if (t.type !== "INCOME") return false;
                      if (!t.description) return false;
                      const descriptionUpper = t.description.toUpperCase();
                      return revenueKeywords.some((keyword) =>
                        descriptionUpper.includes(keyword)
                      );
                    })
                  : transactions.filter((t) => t.type === "INCOME");

              const revenue = revenueTransactions.reduce(
                (acc, t) => acc + Number(t.amount),
                0
              );

              const expense = transactions
                .filter((t) => t.type === "EXPENSE")
                .reduce((acc, t) => acc + Number(t.amount), 0);

              const net = revenue - expense;

              // Calcul des taxes et de la trésorerie réelle disponible (Radar à Taxes)
              const taxRate = company.taxRate ?? 22.0; // Par défaut 22%
              const taxAmount = (revenue * taxRate) / 100;
              const netAvailable = revenue - taxAmount;

              console.log(
                `💰 Succès : CA=${revenue} (filtré: ${revenueKeywords.length > 0 ? "OUI" : "NON"}) | Dépenses=${expense} | Net=${net} | Taxes=${taxAmount} (${taxRate}%) | Disponible=${netAvailable}`
              );

              // On retourne le résultat
              return {
                revenue,
                expense,
                net,
                taxAmount, // Montant des taxes estimées
                netAvailable, // Trésorerie réelle disponible après provisions taxes
                taxRate, // Taux de taxes configuré
                revenueFiltered: revenueKeywords.length > 0,
                revenueKeywords:
                  revenueKeywords.length > 0 ? revenueKeywords : null,
              };
            } catch (err) {
              console.error("❌ CRASH dans execute :", err);
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error("Erreur technique lors du calcul.");
            }
          },
        }),

        getAnnualRevenue: tool({
          description:
            "Donne le Chiffre d'Affaires annuel (du 1er janvier de l'année en cours à aujourd'hui). IMPORTANT : Le CA est filtré selon les mots-clés définis dans les paramètres (ex: STRIPE, VRST). Seules les transactions INCOME contenant ces mots-clés sont comptées comme CA.",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getAnnualRevenue' en cours...");

            try {
              // Recherche de l'utilisateur Prisma via clerkUserId
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                console.warn(
                  "⚠️ Utilisateur ou company non trouvé, retour de zéro"
                );
                return { annualRevenue: 0 };
              }

              const company = user.companies[0];
              const companyId = company.id;
              console.log(`✅ Company trouvée : ${companyId}`);

              // Récupération des mots-clés de revenus pour filtrer le CA
              const revenueKeywords = company.revenueKeywords
                ? company.revenueKeywords
                    .split(",")
                    .map((k) => k.trim().toUpperCase())
                : [];

              if (revenueKeywords.length > 0) {
                console.log(
                  `🔍 Filtrage CA activé avec mots-clés : ${revenueKeywords.join(", ")}`
                );
              }

              // Calcul du CA Annuel (du 1er janvier de l'année en cours à aujourd'hui)
              const now = new Date();
              const startOfYear = new Date(now.getFullYear(), 0, 1); // 1er janvier

              const allAnnualTransactions = await prisma.transaction.findMany({
                where: {
                  companyId,
                  type: "INCOME",
                  date: {
                    gte: startOfYear,
                    lte: now,
                  },
                },
              });

              // Filtrage selon les revenueKeywords si définis
              const annualRevenueTransactions =
                revenueKeywords.length > 0
                  ? allAnnualTransactions.filter((t) => {
                      if (!t.description) return false;
                      const descriptionUpper = t.description.toUpperCase();
                      return revenueKeywords.some((keyword) =>
                        descriptionUpper.includes(keyword)
                      );
                    })
                  : allAnnualTransactions;

              const annualRevenue = annualRevenueTransactions.reduce(
                (sum, t) => sum + Number(t.amount),
                0
              );

              console.log(
                `💰 CA Annuel : ${annualRevenue}€ (filtré: ${revenueKeywords.length > 0 ? "OUI" : "NON"}, ${annualRevenueTransactions.length} transactions)`
              );

              return {
                annualRevenue,
                revenueFiltered: revenueKeywords.length > 0,
                revenueKeywords:
                  revenueKeywords.length > 0 ? revenueKeywords : null,
                transactionCount: annualRevenueTransactions.length,
                period: {
                  start: startOfYear.toISOString().split("T")[0],
                  end: now.toISOString().split("T")[0],
                },
              };
            } catch (err) {
              console.error("❌ ERREUR dans getAnnualRevenue execute :", err);
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors du calcul du CA annuel"
              );
            }
          },
        }),

        getTransactionsByPeriod: tool({
          description:
            "Récupère toutes les transactions d'une période spécifique (dates de début et de fin). Utilise cet outil quand l'utilisateur demande des informations sur un mois ou une période spécifique (ex: 'Août', 'octobre 2024'). L'IA doit calculer elle-même les dates de début et de fin du mois demandé.",
          inputSchema: z.object({
            startDate: z
              .string()
              .regex(
                /^\d{4}-\d{2}-\d{2}$/,
                "Format de date invalide (YYYY-MM-DD)"
              )
              .describe(
                "Date de début au format YYYY-MM-DD (ex: '2025-08-01' pour le 1er août 2025)"
              ),
            endDate: z
              .string()
              .regex(
                /^\d{4}-\d{2}-\d{2}$/,
                "Format de date invalide (YYYY-MM-DD)"
              )
              .describe(
                "Date de fin au format YYYY-MM-DD (ex: '2025-08-31' pour le 31 août 2025)"
              ),
          }),
          execute: async ({ startDate, endDate }) => {
            console.log("🛠️ Outil 'getTransactionsByPeriod' en cours...");
            console.log(`📅 Période demandée: du ${startDate} au ${endDate}`);

            try {
              // Recherche de l'utilisateur Prisma via clerkUserId
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                console.warn(
                  "⚠️ Utilisateur ou company non trouvé, retour vide"
                );
                return { transactions: [] };
              }

              const companyId = user.companies[0].id;
              console.log(`✅ Company trouvée : ${companyId}`);

              // Conversion des dates string en Date objects
              // On utilise minuit pour startDate et 23:59:59 pour endDate pour couvrir toute la journée
              const start = new Date(startDate + "T00:00:00.000Z");
              const end = new Date(endDate + "T23:59:59.999Z");

              // Validation des dates
              if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new Error("Dates invalides");
              }

              if (start > end) {
                throw new Error(
                  "La date de début doit être antérieure à la date de fin"
                );
              }

              console.log(
                `📅 Recherche des transactions du ${start.toISOString()} au ${end.toISOString()}`
              );

              // Récupération des transactions dans la période
              const transactions = await prisma.transaction.findMany({
                where: {
                  companyId,
                  date: {
                    gte: start,
                    lte: end,
                  },
                },
                orderBy: {
                  date: "desc", // Plus récentes en premier
                },
              });

              console.log(
                `📊 ${transactions.length} transactions trouvées pour la période.`
              );

              // Formatage des transactions pour la réponse
              const formattedTransactions = transactions.map((t) => ({
                id: t.id, // ID nécessaire pour modifier la transaction
                date: t.date.toISOString().split("T")[0], // Format YYYY-MM-DD
                description: t.description || "Sans description",
                amount: Number(t.amount),
                type: t.type,
                category: t.category,
              }));

              // Calcul des totaux pour faciliter l'analyse
              const totalIncome = formattedTransactions
                .filter((t) => t.type === "INCOME")
                .reduce((sum, t) => sum + t.amount, 0);

              const totalExpense = formattedTransactions
                .filter((t) => t.type === "EXPENSE")
                .reduce((sum, t) => sum + t.amount, 0);

              const net = totalIncome - totalExpense;

              console.log(
                `💰 Totaux pour la période : Recettes=${totalIncome}€ | Dépenses=${totalExpense}€ | Net=${net}€`
              );

              return {
                transactions: formattedTransactions,
                summary: {
                  totalIncome,
                  totalExpense,
                  net,
                  count: formattedTransactions.length,
                },
              };
            } catch (err) {
              console.error(
                "❌ ERREUR dans getTransactionsByPeriod execute :",
                err
              );
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la récupération des transactions"
              );
            }
          },
        }),

        searchInvoices: tool({
          description:
            "Recherche les factures existantes par numéro de facture ou par nom de client. Utilise cet outil quand l'utilisateur demande des informations sur une facture précise ou sur ce qui a été facturé à un client spécifique (ex: 'Qu'est-ce que j'ai facturé à Martin ?', 'Montre-moi la facture INV-001').",
          inputSchema: z.object({
            query: z
              .string()
              .min(1, "La recherche ne peut pas être vide")
              .describe(
                "Le nom du client ou le numéro de facture à rechercher (ex: 'Martin', 'INV-001')"
              ),
          }),
          execute: async ({ query }) => {
            console.log("🛠️ Outil 'searchInvoices' en cours...");
            console.log(`🔍 Recherche: "${query}"`);

            try {
              // Recherche de l'utilisateur Prisma via clerkUserId
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                console.warn(
                  "⚠️ Utilisateur ou company non trouvé, retour vide"
                );
                return { invoices: [] };
              }

              const companyId = user.companies[0].id;
              console.log(`✅ Company trouvée : ${companyId}`);

              // Recherche des factures par numéro OU par nom de client
              // Recherche insensible à la casse
              const searchQuery = query.trim();

              const invoices = await prisma.invoice.findMany({
                where: {
                  companyId,
                  OR: [
                    // Recherche par numéro de facture (contient la query)
                    {
                      number: {
                        contains: searchQuery,
                        mode: "insensitive",
                      },
                    },
                    // Recherche par nom de client (contient la query, insensible à la casse)
                    {
                      client: {
                        name: {
                          contains: searchQuery,
                          mode: "insensitive",
                        },
                      },
                    },
                  ],
                },
                include: {
                  client: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                  rows: {
                    orderBy: {
                      createdAt: "asc",
                    },
                  },
                },
                orderBy: {
                  issuedDate: "desc", // Plus récentes en premier
                },
              });

              console.log(`📄 ${invoices.length} facture(s) trouvée(s).`);

              // Formatage des factures pour la réponse
              const formattedInvoices = invoices.map((invoice) => {
                // Calcul du montant total TTC
                const totalHT = invoice.rows.reduce(
                  (sum, row) =>
                    sum + Number(row.quantity) * Number(row.unitPrice),
                  0
                );

                const totalVAT = invoice.rows.reduce(
                  (sum, row) =>
                    sum +
                    Number(row.quantity) *
                      Number(row.unitPrice) *
                      (Number(row.vatRate) / 100),
                  0
                );

                const totalTTC = totalHT + totalVAT;

                return {
                  numero: invoice.number,
                  date: invoice.issuedDate.toISOString().split("T")[0], // Format YYYY-MM-DD
                  client: invoice.client.name,
                  clientEmail: invoice.client.email || null,
                  statut: invoice.status,
                  produits: invoice.rows.map((row) => ({
                    description: row.description,
                    quantity: Number(row.quantity),
                    prixUnitaireHT: Number(row.unitPrice),
                    tauxTVA: Number(row.vatRate),
                    montantHT: Number(row.quantity) * Number(row.unitPrice),
                  })),
                  totalHT: Math.round(totalHT * 100) / 100,
                  totalTVA: Math.round(totalVAT * 100) / 100,
                  totalTTC: Math.round(totalTTC * 100) / 100,
                  dateEcheance: invoice.dueDate
                    ? invoice.dueDate.toISOString().split("T")[0]
                    : null,
                };
              });

              return {
                invoices: formattedInvoices,
                count: formattedInvoices.length,
              };
            } catch (err) {
              console.error("❌ ERREUR dans searchInvoices execute :", err);
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la recherche de factures"
              );
            }
          },
        }),

        addTransaction: tool({
          description:
            "Ajoute une transaction (recette ou dépense) dans la base de données. Utilise cet outil quand l'utilisateur demande d'ajouter une transaction. IMPORTANT : Si l'utilisateur mentionne une date spécifique (ex: 'le mois dernier', 'le 15 novembre', 'hier'), tu DOIS utiliser le champ 'date' pour enregistrer la transaction à la bonne date.",
          inputSchema: z.object({
            amount: z
              .number()
              .positive("Le montant doit être positif")
              .describe("Montant de la transaction en euros"),
            type: z
              .enum(["INCOME", "EXPENSE"])
              .describe(
                "Type de transaction : INCOME (recette) ou EXPENSE (dépense)"
              ),
            description: z
              .string()
              .min(1, "La description est requise")
              .describe(
                "Description de la transaction (ex: 'Uber pour déplacement client')"
              ),
            category: z
              .enum([
                "TRANSPORT",
                "REPAS",
                "MATERIEL",
                "PRESTATION",
                "IMPOTS",
                "SALAIRES",
                "AUTRE",
              ])
              .optional()
              .describe(
                "Catégorie de la transaction (inférée si non précisée). Options: TRANSPORT, REPAS, MATERIEL, PRESTATION, IMPOTS, SALAIRES, AUTRE"
              ),
            date: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional()
              .describe(
                "Date de la transaction au format YYYY-MM-DD. INCLUS ce champ si l'utilisateur mentionne une date spécifique (ex: 'le mois dernier', 'le 15 novembre', 'hier', 'la semaine dernière'). Si non fourni, la date actuelle sera utilisée."
              ),
          }),
          execute: async ({ amount, type, description, category, date }) => {
            console.log("🛠️ Outil 'addTransaction' en cours...");
            console.log(
              `📝 Paramètres: amount=${amount}, type=${type}, description=${description}, category=${
                category || "AUTO"
              }, date=${date || "Aujourd'hui (par défaut)"}`
            );

            try {
              // Recherche de l'utilisateur Prisma via clerkUserId
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                console.error("❌ Utilisateur ou company non trouvé");
                throw new Error(
                  "Utilisateur ou entreprise introuvable. Veuillez réessayer."
                );
              }

              const companyId = user.companies[0].id;
              console.log(`✅ Company trouvée : ${companyId}`);

              // Inférence de la catégorie si non fournie
              let finalCategory: TransactionCategory = category || "AUTRE";

              if (!category) {
                const descriptionLower = description.toLowerCase();
                if (
                  descriptionLower.includes("resto") ||
                  descriptionLower.includes("restaurant") ||
                  descriptionLower.includes("déjeuner") ||
                  descriptionLower.includes("diner") ||
                  descriptionLower.includes("dîner") ||
                  descriptionLower.includes("café") ||
                  descriptionLower.includes("cafe") ||
                  descriptionLower.includes("manger") ||
                  descriptionLower.includes("repas")
                ) {
                  finalCategory = "REPAS";
                } else if (
                  descriptionLower.includes("uber") ||
                  descriptionLower.includes("taxi") ||
                  descriptionLower.includes("transport") ||
                  descriptionLower.includes("essence") ||
                  descriptionLower.includes("parking") ||
                  descriptionLower.includes("train") ||
                  descriptionLower.includes("avion")
                ) {
                  finalCategory = "TRANSPORT";
                } else if (
                  descriptionLower.includes("matériel") ||
                  descriptionLower.includes("materiel") ||
                  descriptionLower.includes("fourniture") ||
                  descriptionLower.includes("équipement") ||
                  descriptionLower.includes("equipement")
                ) {
                  finalCategory = "MATERIEL";
                } else if (
                  descriptionLower.includes("prestation") ||
                  descriptionLower.includes("service") ||
                  descriptionLower.includes("freelance")
                ) {
                  finalCategory = "PRESTATION";
                } else if (
                  descriptionLower.includes("impôt") ||
                  descriptionLower.includes("impot") ||
                  descriptionLower.includes("taxe") ||
                  descriptionLower.includes("fiscal")
                ) {
                  finalCategory = "IMPOTS";
                } else if (
                  descriptionLower.includes("salaire") ||
                  descriptionLower.includes("paie") ||
                  descriptionLower.includes("paye")
                ) {
                  finalCategory = "SALAIRES";
                }

                console.log(`🔍 Catégorie inférée : ${finalCategory}`);
              }

              // Préparation de la date : utiliser la date fournie ou la date actuelle
              let transactionDate: Date;
              if (date) {
                // Parser la date fournie (format YYYY-MM-DD)
                transactionDate = new Date(date + "T00:00:00.000Z");
                if (isNaN(transactionDate.getTime())) {
                  throw new Error("Date invalide. Format attendu: YYYY-MM-DD");
                }
                console.log(`📅 Date spécifiée utilisée: ${date}`);
              } else {
                transactionDate = new Date();
                console.log("📅 Date actuelle utilisée (par défaut)");
              }

              // Création de la transaction
              const transaction = await prisma.transaction.create({
                data: {
                  amount,
                  type: type as TransactionType,
                  description,
                  category: finalCategory,
                  status: "COMPLETED",
                  companyId,
                  date: transactionDate,
                },
              });

              console.log(
                `✅ Transaction créée avec succès: ${transaction.id}`
              );

              // IMPORTANT : Revalidation du cache pour mettre à jour le dashboard instantanément
              // On revalide tous les chemins concernés pour forcer la mise à jour
              revalidatePath("/"); // Dashboard principal
              revalidatePath("/transactions"); // Page transactions

              console.log("🔄 Cache revalidé pour / et /transactions");

              // Formatage de la date pour le message
              const dateMessage = date
                ? ` enregistrée pour le ${new Date(
                    transactionDate
                  ).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}`
                : " (date d'aujourd'hui)";

              return {
                success: true,
                transactionId: transaction.id,
                message: `Transaction ${
                  type === "INCOME" ? "de recette" : "de dépense"
                } de ${amount}€ ajoutée avec succès${dateMessage}. Rechargez la page pour voir la mise à jour du Dashboard.`,
              };
            } catch (err) {
              console.error("❌ ERREUR dans addTransaction execute :", err);
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la création de la transaction"
              );
            }
          },
        }),

        updateTransaction: tool({
          description:
            "Modifie une transaction existante. Utilise cet outil quand l'utilisateur demande de modifier une transaction (montant, description, catégorie, type INCOME/EXPENSE). IMPORTANT : Tu PEUX corriger les erreurs de type (ex: changer une dépense en recette ou vice versa). Ne modifie JAMAIS la date sauf si l'utilisateur le demande explicitement. Pour trouver l'ID d'une transaction, utilise d'abord getTransactionsByPeriod.",
          inputSchema: z.object({
            transactionId: z
              .string()
              .min(1, "L'ID de la transaction est requis")
              .describe(
                "ID de la transaction à modifier (obtenu via getTransactionsByPeriod)"
              ),
            amount: z
              .number()
              .refine((val) => val !== 0, {
                message: "Le montant ne peut pas être égal à 0",
              })
              .optional()
              .describe(
                "Nouveau montant en euros (positif ou négatif, mais pas 0). Ne pas inclure si le montant ne doit pas être modifié."
              ),
            description: z
              .string()
              .min(1)
              .optional()
              .describe(
                "Nouvelle description. Ne pas inclure si la description ne doit pas être modifiée."
              ),
            category: z
              .enum([
                "TRANSPORT",
                "REPAS",
                "MATERIEL",
                "PRESTATION",
                "IMPOTS",
                "SALAIRES",
                "AUTRE",
              ])
              .optional()
              .describe(
                "Nouvelle catégorie. Ne pas inclure si la catégorie ne doit pas être modifiée."
              ),
            type: z
              .enum(["INCOME", "EXPENSE"])
              .optional()
              .describe(
                "Type de transaction : INCOME (recette) ou EXPENSE (dépense). Utilise ce champ pour CORRIGER les erreurs (ex: si tu as ajouté une dépense au lieu d'une recette, ou vice versa). Ne pas inclure si le type ne doit pas être modifié."
              ),
            date: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional()
              .describe(
                "Nouvelle date au format YYYY-MM-DD. ⚠️ NE PAS INCLURE SAUF SI L'UTILISATEUR DEMANDE EXPLICITEMENT DE CHANGER LA DATE. Par défaut, la date de la transaction ne doit JAMAIS être modifiée pour préserver le mois d'origine."
              ),
          }),
          execute: async ({
            transactionId,
            amount,
            description,
            category,
            type,
            date,
          }) => {
            console.log("🛠️ Outil 'updateTransaction' en cours...");
            console.log(
              `📝 Paramètres: transactionId=${transactionId}, amount=${
                amount !== undefined ? amount : "N/A"
              }, description=${description || "N/A"}, category=${
                category || "N/A"
              }, type=${type || "N/A"}, date=${date || "N/A (non modifiée)"}`
            );

            try {
              // Préparer les données de mise à jour (seulement les champs fournis)
              const updateData: {
                amount?: number;
                description?: string;
                category?: TransactionCategory;
                type?: TransactionType;
                date?: string;
              } = {};

              if (amount !== undefined) {
                updateData.amount = amount;
              }

              if (description !== undefined) {
                updateData.description = description;
              }

              if (category !== undefined) {
                updateData.category = category as TransactionCategory;
              }

              if (type !== undefined) {
                updateData.type = type as TransactionType;
                console.log(`🔄 Type de transaction modifié: ${type}`);
              }

              // ⚠️ CRITIQUE : Ne modifier la date QUE si elle est explicitement fournie
              if (date !== undefined) {
                updateData.date = date;
                console.log(
                  "⚠️ ATTENTION : La date de la transaction est modifiée"
                );
              } else {
                console.log(
                  "✅ La date de la transaction n'est pas modifiée (conservation du mois d'origine)"
                );
              }

              // Appeler la fonction de mise à jour
              await updateTransaction(transactionId, updateData);

              console.log(
                `✅ Transaction ${transactionId} modifiée avec succès`
              );

              // IMPORTANT : Revalidation du cache pour mettre à jour le dashboard instantanément
              revalidatePath("/");
              revalidatePath("/transactions");

              return {
                success: true,
                transactionId,
                message: `Transaction modifiée avec succès${
                  date
                    ? ` (date changée vers ${date})`
                    : " (date conservée pour préserver le mois d'origine)"
                }`,
              };
            } catch (err) {
              console.error("❌ ERREUR dans updateTransaction execute :", err);
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la modification de la transaction"
              );
            }
          },
        }),

        createInvoice: tool({
          description:
            "Crée une facture pour un client. Le client sera créé automatiquement s'il n'existe pas déjà. Utilise cet outil quand l'utilisateur demande de créer une facture. IMPORTANT : Si l'utilisateur demande une facture 'en retard' ou avec une date d'échéance passée, utilise issuedDate dans le passé et dueDate passée, et met paymentTerms à 'à payer maintenant' ou 'à réception'.",
          inputSchema: z.object({
            clientName: z
              .string()
              .min(1, "Le nom du client est requis")
              .describe("Nom du client (sera créé s'il n'existe pas)"),
            items: z
              .array(
                z.object({
                  description: z
                    .string()
                    .min(1, "La description est requise")
                    .describe("Description de la prestation ou produit"),
                  quantity: z
                    .number()
                    .positive("La quantité doit être positive")
                    .default(1)
                    .describe("Quantité (par défaut: 1)"),
                  unitPrice: z
                    .number()
                    .positive("Le prix unitaire doit être positif")
                    .describe("Prix unitaire HT en euros"),
                })
              )
              .min(1, "Au moins un item est requis")
              .describe("Lignes de la facture (items)"),
            issuedDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional()
              .describe(
                "Date d'émission au format YYYY-MM-DD (optionnel, date actuelle par défaut). IMPORTANT : Si l'utilisateur demande une facture 'en retard' ou avec une date d'échéance passée, utilise une date d'émission dans le passé (avant la date d'échéance)."
              ),
            paymentTerms: z
              .string()
              .optional()
              .describe(
                "Conditions de paiement (ex: '30 jours', '60 jours', 'à réception', 'paiement immédiat', 'à payer maintenant'). Si l'utilisateur demande une facture 'en retard', utilise 'à payer maintenant' ou 'à réception'. Si non fourni, par défaut '30 jours'."
              ),
            dueDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional()
              .describe(
                "Date d'échéance au format YYYY-MM-DD (optionnel, calculée automatiquement selon paymentTerms si non fourni). IMPORTANT : Tu PEUX utiliser une date passée si l'utilisateur demande une facture 'en retard', 'du mois dernier', ou avec une date d'échéance spécifique dans le passé (ex: 'pas payé depuis le 9 décembre')."
              ),
          }),
          execute: async ({
            clientName,
            items,
            dueDate,
            paymentTerms,
            issuedDate,
          }) => {
            console.log("🛠️ Outil 'createInvoice' en cours...");
            console.log(
              `📝 Paramètres: clientName=${clientName}, items=${
                items.length
              }, paymentTerms=${paymentTerms || "30 jours (défaut)"}, dueDate=${dueDate || "AUTO"}`
            );

            try {
              // Recherche de l'utilisateur Prisma via clerkUserId
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                console.error("❌ Utilisateur ou company non trouvé");
                throw new Error(
                  "Utilisateur ou entreprise introuvable. Veuillez réessayer."
                );
              }

              const companyId = user.companies[0].id;
              console.log(`✅ Company trouvée : ${companyId}`);

              // Recherche ou création du client
              let client = await prisma.client.findFirst({
                where: {
                  companyId,
                  name: {
                    equals: clientName,
                    mode: "insensitive", // Recherche insensible à la casse
                  },
                },
              });

              if (!client) {
                console.log(`🆕 Création du nouveau client: ${clientName}`);
                client = await prisma.client.create({
                  data: {
                    name: clientName,
                    companyId,
                  },
                });
                console.log(`✅ Client créé avec succès: ${client.id}`);
              } else {
                console.log(`✅ Client trouvé: ${client.id}`);
              }

              // Calcul de la date d'émission
              const now = new Date();
              let calculatedIssuedDate: Date;
              
              if (issuedDate) {
                // Si une date d'émission est fournie, l'utiliser (peut être dans le passé pour factures en retard)
                calculatedIssuedDate = new Date(issuedDate + "T00:00:00.000Z");
                if (isNaN(calculatedIssuedDate.getTime())) {
                  throw new Error(
                    "Date d'émission invalide. Format attendu: YYYY-MM-DD"
                  );
                }
                console.log(
                  `📅 Date d'émission fournie: ${issuedDate} ${calculatedIssuedDate < now ? "(PASSÉE)" : ""}`
                );
              } else {
                // Par défaut, date actuelle
                calculatedIssuedDate = now;
              }

              // Détermination des conditions de paiement et calcul de la date d'échéance
              let finalPaymentTerms: string;
              let calculatedDueDate: Date | null = null;
              let invoiceStatus: InvoiceStatus = InvoiceStatus.DRAFT;

              if (dueDate) {
                // Si une date d'échéance est explicitement fournie, l'utiliser (même si elle est dans le passé)
                calculatedDueDate = new Date(dueDate + "T00:00:00.000Z");
                if (isNaN(calculatedDueDate.getTime())) {
                  throw new Error(
                    "Date d'échéance invalide. Format attendu: YYYY-MM-DD"
                  );
                }
                
                // Si la date d'échéance est dans le passé, c'est une facture en retard
                if (calculatedDueDate < now) {
                  finalPaymentTerms = paymentTerms || "à payer maintenant";
                  invoiceStatus = InvoiceStatus.OVERDUE;
                  console.log(
                    `⚠️ Facture en retard détectée: échéance ${dueDate} (passée)`
                  );
                } else {
                  finalPaymentTerms = paymentTerms || "30 jours";
                }
                console.log(
                  `📅 Date d'échéance explicitement fournie: ${dueDate} ${calculatedDueDate < now ? "(PASSÉE - facture en retard)" : ""}`
                );
              } else {
                // Sinon, calculer selon les conditions de paiement
                finalPaymentTerms = paymentTerms || "30 jours";
                const paymentTermsLower = finalPaymentTerms.toLowerCase();

                if (
                  paymentTermsLower.includes("réception") ||
                  paymentTermsLower.includes("reception") ||
                  paymentTermsLower.includes("immédiat") ||
                  paymentTermsLower.includes("immediat") ||
                  paymentTermsLower.includes("comptant") ||
                  paymentTermsLower.includes("payer maintenant")
                ) {
                  // Pas de date d'échéance pour paiement à réception/immédiat
                  calculatedDueDate = null;
                } else {
                  // Extraction du nombre de jours depuis paymentTerms (ex: "30 jours", "60 jours")
                  const daysMatch = finalPaymentTerms.match(/(\d+)\s*jour/i);
                  const days = daysMatch ? parseInt(daysMatch[1], 10) : 30;

                  calculatedDueDate = new Date(calculatedIssuedDate);
                  calculatedDueDate.setDate(calculatedDueDate.getDate() + days);
                  
                  // Si la date d'échéance calculée est dans le passé, c'est une facture en retard
                  if (calculatedDueDate < now) {
                    invoiceStatus = InvoiceStatus.OVERDUE;
                    console.log(
                      `⚠️ Facture en retard détectée: échéance calculée ${calculatedDueDate.toISOString().split("T")[0]} (passée)`
                    );
                  }
                }
              }

              console.log(
                `📅 Conditions: ${finalPaymentTerms}, Date d'émission: ${calculatedIssuedDate.toISOString().split("T")[0]}, Date d'échéance: ${calculatedDueDate ? calculatedDueDate.toISOString().split("T")[0] : "Aucune (paiement immédiat)"}, Statut: ${invoiceStatus}`
              );

              // Récupération du dernier numéro de facture pour cette company
              const lastInvoice = await prisma.invoice.findFirst({
                where: { companyId },
                orderBy: { createdAt: "desc" },
              });

              // Génération du numéro de facture (INV-001, INV-002, etc.)
              let invoiceNumber = "INV-001";
              if (lastInvoice) {
                const lastNumber = parseInt(
                  lastInvoice.number.replace("INV-", "")
                );
                invoiceNumber = `INV-${String(lastNumber + 1).padStart(
                  3,
                  "0"
                )}`;
              }

              console.log(`📄 Numéro de facture généré: ${invoiceNumber}`);

              // Création de la facture avec ses lignes en transaction
              const invoice = await prisma.invoice.create({
                data: {
                  number: invoiceNumber,
                  issuedDate: calculatedIssuedDate,
                  dueDate: calculatedDueDate,
                  paymentTerms: finalPaymentTerms,
                  status: invoiceStatus,
                  companyId,
                  clientId: client.id,
                  rows: {
                    create: items.map((item) => ({
                      description: item.description,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      vatRate: 0.0, // TVA par défaut à 0%, peut être amélioré plus tard
                    })),
                  },
                },
                include: {
                  rows: true,
                },
              });

              console.log(`✅ Facture créée avec succès: ${invoice.id}`);

              // Calcul du montant total
              const total = invoice.rows.reduce((sum, row) => {
                return sum + Number(row.quantity) * Number(row.unitPrice);
              }, 0);

              // IMPORTANT : Revalidation du cache pour mettre à jour la page des factures
              revalidatePath("/invoices");

              return {
                success: true,
                invoiceId: invoice.id,
                invoiceNumber: invoice.number,
                message: `Facture ${
                  invoice.number
                } créée pour ${clientName} (Montant: ${total.toFixed(2)}€)`,
              };
            } catch (err) {
              console.error("❌ ERREUR dans createInvoice execute :", err);
              console.error(
                "Stack trace:",
                err instanceof Error ? err.stack : "N/A"
              );
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la création de la facture"
              );
            }
          },
        }),

        // Nouvel outil : Envoyer une facture par email
        sendInvoice: tool({
          description:
            "Envoie une facture par email au client. Passe automatiquement le statut à SENT. Utilise cet outil quand l'utilisateur demande d'envoyer une facture.",
          inputSchema: z.object({
            invoiceNumber: z
              .string()
              .optional()
              .describe("Le numéro de la facture (ex: INV-001)"),
            clientName: z
              .string()
              .optional()
              .describe("Le nom du client (pour trouver la dernière facture)"),
          }),
          execute: async ({ invoiceNumber, clientName }) => {
            console.log("🛠️ Outil 'sendInvoice' en cours...");
            console.log(
              `📧 Paramètres: invoiceNumber=${invoiceNumber || "N/A"}, clientName=${clientName || "N/A"}`
            );

            try {
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                throw new Error("Utilisateur ou entreprise introuvable");
              }

              const companyId = user.companies[0].id;
              let invoice;

              if (invoiceNumber) {
                invoice = await prisma.invoice.findFirst({
                  where: {
                    companyId,
                    number: { equals: invoiceNumber, mode: "insensitive" },
                    status: { not: "PAID" },
                  },
                  include: { client: true },
                });
              } else if (clientName) {
                invoice = await prisma.invoice.findFirst({
                  where: {
                    companyId,
                    client: {
                      name: { contains: clientName, mode: "insensitive" },
                    },
                    status: { not: "PAID" },
                  },
                  include: { client: true },
                  orderBy: { createdAt: "desc" },
                });
              } else {
                throw new Error(
                  "Merci de préciser le numéro de facture ou le nom du client"
                );
              }

              if (!invoice) {
                return {
                  success: false,
                  message: invoiceNumber
                    ? `Aucune facture trouvée avec le numéro ${invoiceNumber}`
                    : `Aucune facture trouvée pour le client ${clientName}`,
                };
              }

              if (!invoice.client.email) {
                return {
                  success: false,
                  message: `Le client ${invoice.client.name} n'a pas d'adresse email.`,
                };
              }

              await sendInvoiceEmail(invoice.id);

              if (invoice.status === "DRAFT") {
                await updateInvoiceStatus(invoice.id, "SENT");
              }

              return {
                success: true,
                invoiceNumber: invoice.number,
                clientName: invoice.client.name,
                clientEmail: invoice.client.email,
                message: `Facture ${invoice.number} envoyée par email à ${invoice.client.email} !`,
              };
            } catch (err) {
              console.error("❌ ERREUR dans sendInvoice :", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de l'envoi de la facture"
              );
            }
          },
        }),

        // Nouvel outil : Valider une facture (sans envoyer d'email)
        validateInvoice: tool({
          description:
            "Valide une facture en passant son statut de DRAFT à SENT (sans envoyer d'email).",
          inputSchema: z.object({
            invoiceNumber: z
              .string()
              .describe("Le numéro de la facture à valider (ex: INV-001)"),
          }),
          execute: async ({ invoiceNumber }) => {
            console.log("🛠️ Outil 'validateInvoice' en cours...");

            try {
              const user = await prisma.user.findUnique({
                where: { clerkUserId: clerkUser.id },
                include: {
                  companies: {
                    orderBy: { createdAt: "asc" },
                    take: 1,
                  },
                },
              });

              if (!user || !user.companies || user.companies.length === 0) {
                throw new Error("Utilisateur ou entreprise introuvable");
              }

              const companyId = user.companies[0].id;

              const invoice = await prisma.invoice.findFirst({
                where: {
                  companyId,
                  number: { equals: invoiceNumber, mode: "insensitive" },
                },
                include: { client: true },
              });

              if (!invoice) {
                return {
                  success: false,
                  message: `Aucune facture trouvée avec le numéro ${invoiceNumber}`,
                };
              }

              if (invoice.status === "DRAFT") {
                await updateInvoiceStatus(invoice.id, "SENT");
                return {
                  success: true,
                  invoiceNumber: invoice.number,
                  clientName: invoice.client.name,
                  message: `Facture ${invoice.number} validée avec succès.`,
                };
              } else {
                return {
                  success: true,
                  invoiceNumber: invoice.number,
                  currentStatus: invoice.status,
                  message: `La facture ${invoice.number} est déjà au statut ${invoice.status}.`,
                };
              }
            } catch (err) {
              console.error("❌ ERREUR dans validateInvoice :", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la validation de la facture"
              );
            }
          },
        }),

        getOverdueInvoices: tool({
          description:
            "Récupère la liste des factures en retard (non payées et dont la date d'échéance est passée). Utilise cet outil quand l'utilisateur demande quelles factures sont en retard, ou pour vérifier s'il y a des relances à faire.",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getOverdueInvoices' en cours...");

            try {
              const invoices = await getOverdueInvoices();

              console.log(
                `✅ ${invoices.length} facture(s) en retard trouvée(s)`
              );

              return {
                count: invoices.length,
                invoices: invoices.map((inv) => ({
                  id: inv.id,
                  number: inv.number,
                  clientName: inv.clientName,
                  clientEmail: inv.clientEmail,
                  totalAmount: inv.totalAmount,
                  dueDate: inv.dueDate.toISOString().split("T")[0],
                  daysOverdue: inv.daysOverdue,
                })),
              };
            } catch (err) {
              console.error("❌ ERREUR dans getOverdueInvoices:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la récupération des factures en retard"
              );
            }
          },
        }),

        generateReminderEmail: tool({
          description:
            "Génère un email de relance pour une facture en retard en utilisant l'IA. Le ton est adaptatif : courtois si retard < 15 jours, ferme si retard >= 15 jours. Utilise cet outil quand l'utilisateur demande de relancer une facture ou de générer un email de relance.",
          inputSchema: z.object({
            invoiceId: z
              .string()
              .describe(
                "ID de la facture à relancer (obtenu via getOverdueInvoices ou searchInvoices)"
              ),
          }),
          execute: async ({ invoiceId }) => {
            console.log("🛠️ Outil 'generateReminderEmail' en cours...");
            console.log(`📧 Génération email pour facture ${invoiceId}`);

            try {
              const emailData = await generateReminderEmail(invoiceId);

              console.log(
                `✅ Email généré : "${emailData.subject}" (${emailData.body.length} caractères)`
              );

              return {
                success: true,
                invoiceId,
                subject: emailData.subject,
                body: emailData.body,
              };
            } catch (err) {
              console.error("❌ ERREUR dans generateReminderEmail:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la génération de l'email de relance"
              );
            }
          },
        }),

        sendReminderEmail: tool({
          description:
            "Envoie un email de relance à un client pour une facture en retard. Utilise cet outil après avoir généré l'email (generateReminderEmail) ou si l'utilisateur demande d'envoyer directement une relance. IMPORTANT : Le client doit avoir une adresse email configurée.",
          inputSchema: z.object({
            invoiceId: z
              .string()
              .describe(
                "ID de la facture à relancer (obtenu via getOverdueInvoices ou searchInvoices)"
              ),
            subject: z.string().describe("Sujet de l'email de relance"),
            body: z
              .string()
              .describe(
                "Corps de l'email de relance (peut être HTML ou texte)"
              ),
          }),
          execute: async ({ invoiceId, subject, body }) => {
            console.log("🛠️ Outil 'sendReminderEmail' en cours...");
            console.log(`📧 Envoi relance facture ${invoiceId} : "${subject}"`);

            try {
              const result = await sendReminderEmail(invoiceId, subject, body);

              console.log(
                `✅ Email de relance envoyé (messageId: ${result.messageId})`
              );

              // Revalidation du cache pour mettre à jour le dashboard
              revalidatePath("/");

              return {
                success: true,
                invoiceId,
                messageId: result.messageId,
                message: "Email de relance envoyé avec succès",
              };
            } catch (err) {
              console.error("❌ ERREUR dans sendReminderEmail:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de l'envoi de l'email de relance"
              );
            }
          },
        }),

        getCashFlowForecast: tool({
          description:
            "Donne les prévisions de trésorerie sur 6 mois. Calcule le solde actuel, le burn rate (dépenses moyennes), et projette l'évolution de la trésorerie en tenant compte des factures à recevoir. Utilise cet outil quand l'utilisateur demande des prévisions financières, l'évolution future de la trésorerie, ou 'combien j'aurai dans X mois'.",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getCashFlowForecast' en cours...");

            try {
              const forecast = await getCashFlowForecast();

              console.log(
                `✅ Prévisions calculées : Solde=${forecast.currentBalance}€, Burn Rate=${forecast.burnRate}€/mois, ${forecast.forecastData.length} points`
              );

              return {
                currentBalance: forecast.currentBalance,
                burnRate: forecast.burnRate,
                hasEnoughData: forecast.hasEnoughData,
                forecast: forecast.forecastData.map((point) => ({
                  mois: point.date,
                  solde: point.solde,
                  type: point.type === "real" ? "réel" : "projeté",
                })),
              };
            } catch (err) {
              console.error("❌ ERREUR dans getCashFlowForecast:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors du calcul des prévisions de trésorerie"
              );
            }
          },
        }),

        getIntegrations: tool({
          description:
            "Récupère la liste des intégrations externes connectées (Stripe, PayPal, etc.). Utilise cet outil pour vérifier si Stripe est connecté ou pour voir l'état des intégrations.",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getIntegrations' en cours...");

            try {
              const integrations = await getIntegrations();

              return {
                integrations: integrations.map((i) => ({
                  provider: i.provider,
                  isConnected: i.isConnected,
                  accountId: i.accountId,
                  lastSyncedAt: i.lastSyncedAt
                    ? new Date(i.lastSyncedAt).toISOString()
                    : null,
                })),
                count: integrations.length,
              };
            } catch (err) {
              console.error("❌ ERREUR dans getIntegrations:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la récupération des intégrations"
              );
            }
          },
        }),

        connectStripe: tool({
          description:
            "Connecte un compte Stripe en utilisant une clé API (Restricted Key). Utilise cet outil quand l'utilisateur demande de connecter Stripe ou fournit une clé API Stripe. IMPORTANT : La clé doit être une Restricted Key avec permissions balance:read et charges:read.",
          inputSchema: z.object({
            apiKey: z
              .string()
              .min(1, "La clé API est requise")
              .describe(
                "Clé API Stripe (Restricted Key). Format: sk_test_... ou sk_live_..."
              ),
          }),
          execute: async ({ apiKey }) => {
            console.log("🛠️ Outil 'connectStripe' en cours...");

            try {
              const result = await connectStripe(apiKey);

              console.log(`✅ Stripe connecté: ${result.integrationId}`);

              return {
                success: true,
                integrationId: result.integrationId,
                message: "Stripe connecté avec succès",
              };
            } catch (err) {
              console.error("❌ ERREUR dans connectStripe:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la connexion à Stripe"
              );
            }
          },
        }),

        syncStripeTransactions: tool({
          description:
            "Synchronise les transactions Stripe et les importe dans la base de données. Utilise cet outil quand l'utilisateur demande de synchroniser Stripe, importer ses transactions Stripe, ou récupérer ses paiements Stripe. Les transactions sont automatiquement dédoublonnées et classées (INCOME/EXPENSE).",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'syncStripeTransactions' en cours...");

            try {
              const result = await syncStripeTransactions();

              console.log(
                `✅ Synchronisation terminée: ${result.syncedCount} importées, ${result.skippedCount} ignorées`
              );

              return {
                success: true,
                syncedCount: result.syncedCount,
                skippedCount: result.skippedCount,
                totalProcessed: result.syncedCount + result.skippedCount,
                errors: result.errors,
                message: `${result.syncedCount} transaction(s) importée(s)${result.skippedCount > 0 ? `, ${result.skippedCount} déjà existante(s)` : ""}`,
              };
            } catch (err) {
              console.error("❌ ERREUR dans syncStripeTransactions:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la synchronisation Stripe"
              );
            }
          },
        }),

        // ============================================
        // OUTILS RENTABILITÉ (Profitability)
        // ============================================

        calculateServicePrice: tool({
          description:
            "Calcule le prix de vente recommandé pour un service en fonction des coûts (charges fixes, salaire, vacances, marge). Utilise cet outil quand l'utilisateur demande de calculer un prix de vente, fixer un prix, ou connaître le prix minimum pour un service. Retourne le prix recommandé, le nombre de clients nécessaires par mois, et alerte si risque de burnout (>150h/mois).",
          inputSchema: z.object({
            serviceId: z.string().describe("ID du service à calculer"),
            marginPercent: z
              .number()
              .optional()
              .describe("Marge de sécurité souhaitée en % (défaut: 20%)"),
          }),
          execute: async ({ serviceId, marginPercent = 20 }) => {
            console.log(
              `🛠️ Outil 'calculateServicePrice' en cours pour service ${serviceId}...`
            );

            try {
              const result = await calculateServicePrice(serviceId, marginPercent);

              return {
                success: true,
                hourlyCost: result.hourlyCost,
                serviceCost: result.serviceCost,
                minimumPrice: result.minimumPrice,
                recommendedPrice: result.recommendedPrice,
                clientsNeededPerMonth: result.clientsNeededPerMonth,
                monthlyHoursNeeded: result.monthlyHoursNeeded,
                isRealistic: result.isRealistic,
                breakdown: result.breakdown,
                message: `Prix recommandé : ${result.recommendedPrice.toFixed(2)} €. ${result.clientsNeededPerMonth} clients/mois nécessaires (${result.monthlyHoursNeeded.toFixed(1)}h). ${result.isRealistic ? "✅ Réaliste" : "⚠️ Risque de burnout (>150h/mois)"}`,
              };
            } catch (err) {
              console.error("❌ ERREUR dans calculateServicePrice:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors du calcul du prix"
              );
            }
          },
        }),

        getCostProfile: tool({
          description:
            "Récupère le profil de coûts de l'entreprise (charges fixes, salaire souhaité, charges sociales, jours/heures travaillés, vacances). Utilise cet outil pour connaître la configuration actuelle des coûts.",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getCostProfile' en cours...");

            try {
              const profile = await getCostProfile();

              if (!profile) {
                return {
                  success: false,
                  message:
                    "Aucun profil de coûts configuré. Configurez-le dans /profitability",
                };
              }

              return {
                success: true,
                profile: {
                  monthlyFixedCosts: profile.monthlyFixedCosts,
                  desiredMonthlySalary: profile.desiredMonthlySalary,
                  socialChargesRate: profile.socialChargesRate,
                  workingDaysPerMonth: profile.workingDaysPerMonth,
                  dailyHours: profile.dailyHours,
                  vacationWeeks: profile.vacationWeeks,
                },
              };
            } catch (err) {
              console.error("❌ ERREUR dans getCostProfile:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la récupération du profil de coûts"
              );
            }
          },
        }),

        getServices: tool({
          description:
            "Récupère la liste des services définis. Utilise cet outil pour voir quels services sont disponibles pour calculer leur prix.",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getServices' en cours...");

            try {
              const services = await getServices();

              return {
                success: true,
                services: services.map((s) => ({
                  id: s.id,
                  name: s.name,
                  durationMinutes: s.durationMinutes,
                  materialCost: s.materialCost,
                  platformFees: s.platformFees,
                })),
                count: services.length,
              };
            } catch (err) {
              console.error("❌ ERREUR dans getServices:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la récupération des services"
              );
            }
          },
        }),

        // ============================================
        // OUTILS SIMULATEUR AVANCÉ (Simulator)
        // ============================================

        calculateServiceProfitability: tool({
          description:
            "Calcule le coût de revient précis d'une prestation en tenant compte de tous les coûts (consommables, matériel amortissable, main d'œuvre, charges fixes). Utilise cet outil quand l'utilisateur demande de calculer le coût de revient d'un service, le break-even, ou la rentabilité d'une prestation. Retourne le détail de tous les coûts et la marge si un prix de vente est fourni.",
          inputSchema: z.object({
            serviceRecipeId: z
              .string()
              .describe("ID de la recette de service à calculer"),
            sellingPrice: z
              .number()
              .optional()
              .describe("Prix de vente envisagé (optionnel, pour calculer la marge)"),
          }),
          execute: async ({ serviceRecipeId, sellingPrice }) => {
            console.log(
              `🛠️ Outil 'calculateServiceProfitability' en cours pour recette ${serviceRecipeId}...`
            );

            try {
              const result = await calculateServiceProfitability(
                serviceRecipeId,
                sellingPrice
              );

              return {
                success: true,
                suppliesCost: result.suppliesCost,
                equipmentCost: result.equipmentCost,
                laborCost: result.laborCost,
                overheadCost: result.overheadCost,
                totalCost: result.totalCost,
                breakdown: result.breakdown,
                sellingPrice: result.sellingPrice,
                netMargin: result.netMargin,
                marginPercent: result.marginPercent,
                message: `Coût de revient total : ${result.totalCost.toFixed(2)} € (Consommables: ${result.suppliesCost.toFixed(2)} €, Matériel: ${result.equipmentCost.toFixed(2)} €, Main d'œuvre: ${result.laborCost.toFixed(2)} €, Charges: ${result.overheadCost.toFixed(2)} €)${result.netMargin !== undefined ? `. Marge : ${result.netMargin >= 0 ? "+" : ""}${result.netMargin.toFixed(2)} € (${result.marginPercent?.toFixed(1)}%)` : ""}`,
              };
            } catch (err) {
              console.error("❌ ERREUR dans calculateServiceProfitability:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors du calcul de rentabilité"
              );
            }
          },
        }),

        getResources: tool({
          description:
            "Récupère toutes les ressources de l'entreprise (consommables, matériel, charges). Utilise cet outil pour voir quelles ressources sont disponibles pour construire une recette de service.",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getResources' en cours...");

            try {
              const resources = await getResources();

              return {
                success: true,
                supplies: resources.supplies.map((s) => ({
                  id: s.id,
                  name: s.name,
                  supplier: s.supplier,
                  purchasePrice: s.purchasePrice,
                  totalQuantity: s.totalQuantity,
                  unit: s.unit,
                  unitCost: s.purchasePrice / s.totalQuantity,
                })),
                equipment: resources.equipment.map((e) => ({
                  id: e.id,
                  name: e.name,
                  purchasePrice: e.purchasePrice,
                  lifespanMonths: e.lifespanMonths,
                  weeklyUses: e.weeklyUses,
                  costPerService:
                    e.purchasePrice / (e.lifespanMonths * 4.33 * e.weeklyUses),
                })),
                overheads: resources.overheads.map((o) => ({
                  id: o.id,
                  name: o.name,
                  monthlyCost: o.monthlyCost,
                  category: o.category,
                })),
                counts: {
                  supplies: resources.supplies.length,
                  equipment: resources.equipment.length,
                  overheads: resources.overheads.length,
                },
              };
            } catch (err) {
              console.error("❌ ERREUR dans getResources:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la récupération des ressources"
              );
            }
          },
        }),

        getServiceRecipes: tool({
          description:
            "Récupère toutes les recettes de service définies. Utilise cet outil pour voir quelles recettes sont disponibles pour calculer leur rentabilité.",
          inputSchema: z.object({}),
          execute: async () => {
            console.log("🛠️ Outil 'getServiceRecipes' en cours...");

            try {
              const recipes = await getServiceRecipes();

              return {
                success: true,
                recipes: recipes.map((r) => ({
                  id: r.id,
                  name: r.name,
                  laborTimeMinutes: r.laborTimeMinutes,
                  laborHourlyCost: r.laborHourlyCost,
                  suppliesCount: r.suppliesUsed.length,
                  equipmentCount: r.equipmentUsed.length,
                })),
                count: recipes.length,
              };
            } catch (err) {
              console.error("❌ ERREUR dans getServiceRecipes:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la récupération des recettes"
              );
            }
          },
        }),

        searchDocuments: tool({
          description:
            "Recherche dans les documents stockés (PDF/Images) de l'entreprise. Utilise cet outil si l'utilisateur pose une question sur un document, un contrat, une facture fournisseur, ou un courrier. Tu peux filtrer par client si le nom est fourni.",
          inputSchema: z.object({
            keywords: z
              .string()
              .describe(
                "Mots-clés à rechercher dans le nom ou le contenu du document"
              ),
            clientName: z
              .string()
              .optional()
              .describe(
                "Nom du client pour filtrer les documents (optionnel)"
              ),
          }),
          execute: async ({ keywords, clientName }) => {
            console.log("📄 Outil 'searchDocuments' en cours...");
            console.log("🔍 Mots-clés:", keywords);
            console.log("👤 Client:", clientName || "Tous");

            try {
              const user = await getCurrentUser();
              const company = user.companies[0];

              if (!company) {
                return {
                  success: false,
                  message: "Aucune entreprise trouvée",
                  documents: [],
                };
              }

              // Si un nom de client est fourni, chercher d'abord l'ID du client
              let clientId: string | undefined = undefined;
              if (clientName) {
                const client = await prisma.client.findFirst({
                  where: {
                    companyId: company.id,
                    name: {
                      contains: clientName,
                      mode: "insensitive",
                    },
                  },
                });
                if (client) {
                  clientId = client.id;
                }
              }

              // Recherche dans les documents
              const documents = await prisma.document.findMany({
                where: {
                  userId: user.id,
                  ...(clientId && { clientId }),
                  OR: [
                    {
                      name: {
                        contains: keywords,
                        mode: "insensitive",
                      },
                    },
                    {
                      extractedText: {
                        contains: keywords,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
                include: {
                  client: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: "desc",
                },
                take: 10, // Limiter à 10 résultats
              });

              return {
                success: true,
                count: documents.length,
                documents: documents.map((doc) => ({
                  id: doc.id,
                  titre: doc.name,
                  type: doc.type,
                  resume: doc.summary || "Aucun résumé disponible",
                  client: doc.client?.name || null,
                  date: doc.createdAt.toISOString().split("T")[0],
                  extrait:
                    doc.extractedText.length > 1000
                      ? doc.extractedText.substring(0, 1000) + "..."
                      : doc.extractedText,
                  url: doc.url,
                })),
              };
            } catch (err) {
              console.error("❌ ERREUR dans searchDocuments:", err);
              throw new Error(
                err instanceof Error
                  ? err.message
                  : "Erreur lors de la recherche de documents"
              );
            }
          },
        }),
      },

      // 4. Callback onFinish pour logger le moment exact où l'IA a fini
      onFinish: (result) => {
        console.log("✅✅✅ STREAMTEXT TERMINÉ ✅✅✅");
        console.log("📊 Finish reason:", result.finishReason);
        console.log("🔧 Tool calls:", result.toolCalls?.length || 0);
        console.log("📝 Usage:", result.usage);
        console.log(
          "📄 Texte généré:",
          result.text?.substring(0, 200) || "Aucun texte"
        );
        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log(
            "🛠️ Outils appelés:",
            result.toolCalls.map((t) => t.toolName)
          );
        }
      },

      // 5. Callback onError pour logger les erreurs
      onError: (error) => {
        console.error("❌ ERREUR DANS streamText :", error);
        console.error(
          "Stack trace:",
          error instanceof Error ? error.stack : "N/A"
        );
      },
    });

    // 6. On renvoie le stream au format UIMessageStream (standard Vercel AI v5)
    // toUIMessageStreamResponse() envoie les métadonnées des outils ET le texte
    // Cela permet au client de gérer correctement le cycle complet des outils
    console.log("📤 Envoi de la réponse streamée...");
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("❌ ERREUR GENERALE API :", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "N/A");
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Script de seed pour remplir la base de données avec des données de test
 * Exécution : npx prisma db seed
 */

import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient();

/**
 * Fonction principale de seed
 */
async function main() {
  console.log("🌱 Début du seed de la base de données...");

  // Nettoyage de la base (optionnel, pour éviter les doublons)
  console.log("🧹 Nettoyage de la base...");
  await prisma.assistantThread.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.invoiceRow.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.client.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();

  // ============================================
  // 1. CRÉATION DE L'UTILISATEUR
  // ============================================
  console.log("👤 Création de l'utilisateur...");
  const user = await prisma.user.create({
    data: {
      email: "demo@numera.ai",
      name: "Demo User",
      // Mot de passe hashé fictif (ne correspond à aucun vrai mot de passe)
      passwordHash: "$2a$10$fK8J8J8J8J8J8J8J8J8J8J8J8J8J8J8J8J8J8J8J8J8J8J8J8J8J8",
      createdAt: new Date("2024-01-01"),
    },
  });
  console.log(`✅ Utilisateur créé : ${user.email}`);

  // ============================================
  // 2. CRÉATION DE L'ENTREPRISE
  // ============================================
  console.log("🏢 Création de l'entreprise...");
  const company = await prisma.company.create({
    data: {
      name: "Numera Corp",
      siret: "12345678901234",
      vatNumber: "FR12345678901",
      address: "123 Rue de la Comptabilité, 75001 Paris",
      logoUrl: null,
      currency: "EUR",
      userId: user.id,
      createdAt: new Date("2024-01-01"),
    },
  });
  console.log(`✅ Entreprise créée : ${company.name}`);

  // ============================================
  // 3. CRÉATION DES CLIENTS
  // ============================================
  console.log("👥 Création des clients...");
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        name: "Tech Solutions",
        email: "contact@techsolutions.fr",
        address: "45 Avenue des Technologies, 69001 Lyon",
        siret: "98765432109876",
        vatIntra: "FR98765432109",
        companyId: company.id,
        createdAt: new Date("2024-01-05"),
      },
    }),
    prisma.client.create({
      data: {
        name: "Boulangerie Patoche",
        email: "patoche@boulangerie.fr",
        address: "12 Rue du Pain, 33000 Bordeaux",
        siret: "11111111111111",
        vatIntra: null, // TPE, pas de TVA intracommunautaire
        companyId: company.id,
        createdAt: new Date("2024-01-10"),
      },
    }),
    prisma.client.create({
      data: {
        name: "Consulting SAS",
        email: "info@consulting-sas.fr",
        address: "78 Boulevard des Consultants, 13001 Marseille",
        siret: "22222222222222",
        vatIntra: "FR22222222222",
        companyId: company.id,
        createdAt: new Date("2024-01-15"),
      },
    }),
  ]);
  console.log(`✅ ${clients.length} clients créés`);

  // ============================================
  // 4. CRÉATION DES TRANSACTIONS (50 transactions)
  // ============================================
  console.log("💰 Création des transactions...");

  // Catégories disponibles
  const categories = [
    "TRANSPORT",
    "REPAS",
    "MATERIEL",
    "PRESTATION",
    "IMPOTS",
    "SALAIRES",
    "AUTRE",
  ] as const;

  // Fonction pour générer une date aléatoire dans une période
  const randomDate = (start: Date, end: Date): Date => {
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime())
    );
  };

  // Fonction pour générer un montant aléatoire entre min et max
  const randomAmount = (min: number, max: number): number => {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
  };

  // Périodes : Janvier, Février, Mars 2024
  const januaryStart = new Date("2024-01-01");
  const januaryEnd = new Date("2024-01-31");
  const februaryStart = new Date("2024-02-01");
  const februaryEnd = new Date("2024-02-29");
  const marchStart = new Date("2024-03-01");
  const marchEnd = new Date("2024-03-31");

  const periods = [
    { start: januaryStart, end: januaryEnd },
    { start: februaryStart, end: februaryEnd },
    { start: marchStart, end: marchEnd },
  ];

  const transactions = [];
  let totalIncome = 0;
  let totalExpense = 0;

  // Génération de 50 transactions
  // On s'assure d'avoir plus de recettes que de dépenses pour un résultat positif
  for (let i = 0; i < 50; i++) {
    const period = periods[Math.floor(Math.random() * periods.length)];
    const date = randomDate(period.start, period.end);
    const isIncome = i < 30; // 30 recettes, 20 dépenses (pour être rentable)
    const type = isIncome ? "INCOME" : "EXPENSE";
    const amount = randomAmount(50, 3000);

    if (isIncome) {
      totalIncome += amount;
    } else {
      totalExpense += amount;
    }

    const descriptions = {
      INCOME: [
        "Facturation client Tech Solutions",
        "Prestation de conseil",
        "Vente de produits",
        "Abonnement récurrent",
        "Remboursement frais",
        "Subvention",
        "Vente de services",
      ],
      EXPENSE: [
        "Achat matériel informatique",
        "Frais de transport",
        "Repas d'affaires",
        "Loyer bureau",
        "Salaire employé",
        "Frais comptable",
        "Assurance professionnelle",
        "Achat fournitures",
        "Frais bancaires",
        "Publicité et marketing",
      ],
    };

    const category =
      categories[Math.floor(Math.random() * categories.length)];

    transactions.push({
      date,
      amount,
      description:
        descriptions[type][
          Math.floor(Math.random() * descriptions[type].length)
        ],
      type,
      category,
      status: Math.random() > 0.2 ? "COMPLETED" : "PENDING", // 80% complétées
      receiptUrl: Math.random() > 0.7 ? "https://example.com/receipt.jpg" : null,
      companyId: company.id,
      createdAt: date,
    });
  }

  // Insertion des transactions
  await prisma.transaction.createMany({
    data: transactions,
  });

  console.log(
    `✅ ${transactions.length} transactions créées (Recettes: ${totalIncome.toFixed(2)}€, Dépenses: ${totalExpense.toFixed(2)}€)`
  );
  console.log(
    `   Bénéfice net: ${(totalIncome - totalExpense).toFixed(2)}€`
  );

  // ============================================
  // 5. CRÉATION DES FACTURES (5 factures)
  // ============================================
  console.log("📄 Création des factures...");

  const invoiceData = [
    {
      number: "INV-2024-001",
      issuedDate: new Date("2024-03-01"),
      dueDate: new Date("2024-03-31"),
      status: "PAID" as const,
      client: clients[0], // Tech Solutions
      rows: [
        {
          description: "Développement application web",
          quantity: 40,
          unitPrice: 120.0,
          vatRate: 20.0,
        },
        {
          description: "Intégration API",
          quantity: 10,
          unitPrice: 150.0,
          vatRate: 20.0,
        },
      ],
    },
    {
      number: "INV-2024-002",
      issuedDate: new Date("2024-03-05"),
      dueDate: new Date("2024-04-05"),
      status: "PAID" as const,
      client: clients[1], // Boulangerie Patoche
      rows: [
        {
          description: "Conseil en stratégie digitale",
          quantity: 8,
          unitPrice: 200.0,
          vatRate: 20.0,
        },
      ],
    },
    {
      number: "INV-2024-003",
      issuedDate: new Date("2024-02-15"),
      dueDate: new Date("2024-03-15"),
      status: "OVERDUE" as const, // En retard
      client: clients[2], // Consulting SAS
      rows: [
        {
          description: "Audit comptable",
          quantity: 20,
          unitPrice: 180.0,
          vatRate: 20.0,
        },
        {
          description: "Formation équipe",
          quantity: 5,
          unitPrice: 250.0,
          vatRate: 20.0,
        },
      ],
    },
    {
      number: "INV-2024-004",
      issuedDate: new Date("2024-03-10"),
      dueDate: new Date("2024-04-10"),
      status: "SENT" as const, // En attente
      client: clients[0], // Tech Solutions
      rows: [
        {
          description: "Maintenance mensuelle",
          quantity: 1,
          unitPrice: 500.0,
          vatRate: 20.0,
        },
      ],
    },
    {
      number: "INV-2024-005",
      issuedDate: new Date("2024-03-12"),
      dueDate: new Date("2024-04-12"),
      status: "SENT" as const, // En attente
      client: clients[1], // Boulangerie Patoche
      rows: [
        {
          description: "Refonte site web",
          quantity: 1,
          unitPrice: 2500.0,
          vatRate: 20.0,
        },
        {
          description: "Hébergement annuel",
          quantity: 1,
          unitPrice: 300.0,
          vatRate: 20.0,
        },
      ],
    },
  ];

  // Création des factures avec leurs lignes
  for (const invoice of invoiceData) {
    const createdInvoice = await prisma.invoice.create({
      data: {
        number: invoice.number,
        issuedDate: invoice.issuedDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        companyId: company.id,
        clientId: invoice.client.id,
        createdAt: invoice.issuedDate,
        rows: {
          create: invoice.rows,
        },
      },
    });
    console.log(
      `   ✅ Facture ${createdInvoice.number} créée (${createdInvoice.status})`
    );
  }

  console.log(`✅ ${invoiceData.length} factures créées avec leurs lignes`);

  // ============================================
  // RÉSUMÉ
  // ============================================
  console.log("\n✨ Seed terminé avec succès !");
  console.log("\n📊 Résumé :");
  console.log(`   - 1 utilisateur (${user.email})`);
  console.log(`   - 1 entreprise (${company.name})`);
  console.log(`   - ${clients.length} clients`);
  console.log(`   - ${transactions.length} transactions`);
  console.log(`   - ${invoiceData.length} factures`);
}

/**
 * Exécution du seed avec gestion des erreurs
 */
main()
  .catch((e) => {
    console.error("❌ Erreur lors du seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


/**
 * Script de seed pour remplir la base de données avec des données de test
 * Exécution : npx prisma db seed
 */

// CORRECTION ICI : On utilise l'import standard
import { PrismaClient, Prisma, TransactionType, TransactionCategory, TransactionStatus } from '@prisma/client'

const prisma = new PrismaClient();

/**
 * Fonction principale de seed
 */
async function main() {
  console.log("🌱 Début du seed de la base de données...");

  // Nettoyage de la base (pour éviter les erreurs de doublons)
  console.log("🧹 Nettoyage de la base...");
  // On utilise deleteMany dans un try/catch pour éviter de planter si la table n'existe pas encore
  try {
    await prisma.invoiceRow.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.client.deleteMany();
    await prisma.company.deleteMany();
    await prisma.user.deleteMany();
  } catch (e) {
    console.log("Info: Tables probablement déjà vides.");
  }

  // ============================================
  // 1. CRÉATION DE L'UTILISATEUR
  // ============================================
  console.log("👤 Création de l'utilisateur...");
  const user = await prisma.user.create({
    data: {
      email: "demo@numera.ai",
      name: "Demo User",
      clerkUserId: "demo_clerk_user_id_123", // ID factice pour le seed (normalement créé via Clerk)
      passwordHash: "password_fictif_123", 
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
  const clients = []
  
  const c1 = await prisma.client.create({
      data: {
        name: "Tech Solutions",
        email: "contact@techsolutions.fr",
        address: "45 Avenue des Technologies, 69001 Lyon",
        siret: "98765432109876",
        vatIntra: "FR98765432109",
        companyId: company.id,
        createdAt: new Date("2024-01-05"),
      },
    })
  clients.push(c1)

  const c2 = await prisma.client.create({
      data: {
        name: "Boulangerie Patoche",
        email: "patoche@boulangerie.fr",
        address: "12 Rue du Pain, 33000 Bordeaux",
        siret: "11111111111111",
        vatIntra: null,
        companyId: company.id,
        createdAt: new Date("2024-01-10"),
      },
    })
  clients.push(c2)

  const c3 = await prisma.client.create({
      data: {
        name: "Consulting SAS",
        email: "info@consulting-sas.fr",
        address: "78 Boulevard des Consultants, 13001 Marseille",
        siret: "22222222222222",
        vatIntra: "FR22222222222",
        companyId: company.id,
        createdAt: new Date("2024-01-15"),
      },
    })
  clients.push(c3)

  console.log(`✅ ${clients.length} clients créés`);

  // ============================================
  // 4. CRÉATION DES TRANSACTIONS
  // ============================================
  console.log("💰 Création des transactions...");

  const categories = ["TRANSPORT", "REPAS", "MATERIEL", "PRESTATION", "IMPOTS", "AUTRE"];

  const transactions = [];
  
  for (let i = 0; i < 50; i++) {
    // 3 derniers mois
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 90));

    const isIncome = i < 30; // Plus de recettes pour être rentable
    const type = isIncome ? TransactionType.INCOME : TransactionType.EXPENSE;
    // Montants cohérents
    const amount = isIncome 
        ? Math.floor(Math.random() * 2000) + 500 
        : Math.floor(Math.random() * 300) + 20;

    const category = categories[Math.floor(Math.random() * categories.length)] as TransactionCategory;

    transactions.push({
      date,
      amount,
      description: `${type === TransactionType.INCOME ? 'Vente' : 'Achat'} - ${category}`,
      type,
      category,
      status: Math.random() > 0.1 ? TransactionStatus.COMPLETED : TransactionStatus.PENDING,
      companyId: company.id,
      createdAt: date,
    });
  }

  await prisma.transaction.createMany({
    data: transactions,
  });

  console.log(`✅ 50 transactions créées`);

  // ============================================
  // 5. CRÉATION DES FACTURES
  // ============================================
  console.log("📄 Création des factures...");

  // Facture 1 : Payée
  await prisma.invoice.create({
    data: {
        number: "INV-2024-001",
        issuedDate: new Date("2024-03-01"),
        dueDate: new Date("2024-03-31"),
        status: "PAID",
        companyId: company.id,
        clientId: clients[0].id,
        rows: {
            create: [
                { description: "Dev Web", quantity: 1, unitPrice: 1500, vatRate: 20 }
            ]
        }
    }
  });

  // Facture 2 : En retard
  await prisma.invoice.create({
    data: {
        number: "INV-2024-002",
        issuedDate: new Date("2024-02-01"),
        dueDate: new Date("2024-02-28"),
        status: "OVERDUE",
        companyId: company.id,
        clientId: clients[1].id,
        rows: {
            create: [
                { description: "Formation", quantity: 1, unitPrice: 800, vatRate: 20 }
            ]
        }
    }
  });

  console.log("\n✨ Seed terminé avec succès !");
}

main()
  .catch((e) => {
    console.error("❌ Erreur :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
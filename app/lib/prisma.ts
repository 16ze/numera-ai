import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Vérification que le modèle Document existe (pour debug)
if (process.env.NODE_ENV === "development") {
  // Vérification différée pour éviter les erreurs au chargement du module
  setTimeout(() => {
    if (!prisma.document) {
      console.error(
        "⚠️ Prisma Client: Le modèle 'document' n'est pas disponible. " +
          "Veuillez exécuter 'npx prisma generate' et redémarrer le serveur de développement."
      );
    }
  }, 100);
}




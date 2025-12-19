"use server";

/**
 * Server Actions pour la gestion des dossiers
 * CRUD + déplacement d'éléments
 */

import { getCurrentUser } from "@/app/lib/auth-helper";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Crée un nouveau dossier
 * @param name - Nom du dossier
 * @param parentId - ID du dossier parent (optionnel, null = racine)
 */
export async function createFolder(name: string, parentId?: string | null) {
  try {
    const user = await getCurrentUser();

    // Validation
    if (!name || name.trim().length === 0) {
      throw new Error("Le nom du dossier ne peut pas être vide");
    }

    // Si un parentId est fourni, vérifier qu'il appartient à l'utilisateur
    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: {
          id: parentId,
          userId: user.id,
        },
      });

      if (!parent) {
        throw new Error("Dossier parent non trouvé ou accès refusé");
      }
    }

    // Créer le dossier
    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        userId: user.id,
        parentId: parentId || null,
      },
    });

    revalidatePath("/documents");
    return { success: true, folderId: folder.id };
  } catch (error) {
    console.error("Erreur lors de la création du dossier:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la création du dossier"
    );
  }
}

/**
 * Récupère la structure de fichiers et dossiers
 * @param parentId - ID du dossier parent (optionnel, null = racine)
 */
export async function getFileSystem(parentId?: string | null) {
  try {
    const user = await getCurrentUser();

    // Récupérer le dossier courant si parentId est fourni
    let currentFolder = null;
    if (parentId) {
      currentFolder = await prisma.folder.findFirst({
        where: {
          id: parentId,
          userId: user.id,
        },
        include: {
          parent: {
            include: {
              parent: {
                include: {
                  parent: true, // 3 niveaux max pour le breadcrumb
                },
              },
            },
          },
        },
      });

      if (!currentFolder) {
        throw new Error("Dossier non trouvé ou accès refusé");
      }
    }

    // Récupérer les dossiers enfants
    const folders = await prisma.folder.findMany({
      where: {
        userId: user.id,
        parentId: parentId || null,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Récupérer les documents
    const documents = await prisma.document.findMany({
      where: {
        userId: user.id,
        folderId: parentId || null,
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
        name: "asc",
      },
    });

    return {
      folders,
      documents,
      currentFolder,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération du système de fichiers:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la récupération du système de fichiers"
    );
  }
}

/**
 * Déplace un élément (document ou dossier) vers un autre dossier
 * @param itemId - ID de l'élément à déplacer
 * @param itemType - Type : 'doc' ou 'folder'
 * @param targetFolderId - ID du dossier cible (null = racine)
 */
export async function moveItem(
  itemId: string,
  itemType: "doc" | "folder",
  targetFolderId: string | null
) {
  try {
    const user = await getCurrentUser();

    // Vérifier que le dossier cible existe et appartient à l'utilisateur (si fourni)
    if (targetFolderId) {
      const targetFolder = await prisma.folder.findFirst({
        where: {
          id: targetFolderId,
          userId: user.id,
        },
      });

      if (!targetFolder) {
        throw new Error("Dossier cible non trouvé ou accès refusé");
      }

      // Empêcher de déplacer un dossier dans lui-même ou dans un de ses enfants
      if (itemType === "folder" && itemId === targetFolderId) {
        throw new Error("Impossible de déplacer un dossier dans lui-même");
      }

      // Vérifier qu'on ne déplace pas un dossier dans un de ses enfants (récursif)
      if (itemType === "folder") {
        const isDescendant = await checkIfDescendant(itemId, targetFolderId, user.id);
        if (isDescendant) {
          throw new Error("Impossible de déplacer un dossier dans un de ses sous-dossiers");
        }
      }
    }

    // Déplacer l'élément
    if (itemType === "doc") {
      await prisma.document.update({
        where: {
          id: itemId,
          userId: user.id, // Vérification de sécurité
        },
        data: {
          folderId: targetFolderId,
        },
      });
    } else {
      // itemType === "folder"
      await prisma.folder.update({
        where: {
          id: itemId,
          userId: user.id, // Vérification de sécurité
        },
        data: {
          parentId: targetFolderId,
        },
      });
    }

    revalidatePath("/documents");
    return { success: true };
  } catch (error) {
    console.error("Erreur lors du déplacement:", error);
    throw new Error(
      error instanceof Error ? error.message : "Erreur lors du déplacement"
    );
  }
}

/**
 * Vérifie si un dossier est un descendant d'un autre (pour éviter les boucles)
 */
async function checkIfDescendant(
  folderId: string,
  potentialAncestorId: string,
  userId: string
): Promise<boolean> {
  let currentId: string | null = folderId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      // Boucle détectée
      return false;
    }
    visited.add(currentId);

    if (currentId === potentialAncestorId) {
      return true;
    }

    const folder = await prisma.folder.findFirst({
      where: {
        id: currentId,
        userId: userId,
      },
      select: {
        parentId: true,
      },
    });

    if (!folder) {
      break;
    }

    currentId = folder.parentId;
  }

  return false;
}

/**
 * Supprime un dossier (suppression récursive de tout son contenu)
 * @param folderId - ID du dossier à supprimer
 */
export async function deleteFolder(folderId: string) {
  try {
    const user = await getCurrentUser();

    // Vérifier que le dossier existe et appartient à l'utilisateur
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId: user.id,
      },
    });

    if (!folder) {
      throw new Error("Dossier non trouvé ou accès refusé");
    }

    // Suppression récursive : Prisma gère automatiquement les cascades
    // grâce à onDelete: Cascade dans les relations
    await prisma.folder.delete({
      where: {
        id: folderId,
      },
    });

    revalidatePath("/documents");
    return { success: true };
  } catch (error) {
    console.error("Erreur lors de la suppression du dossier:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Erreur lors de la suppression du dossier"
    );
  }
}

/**
 * Renomme un dossier
 * @param folderId - ID du dossier
 * @param newName - Nouveau nom
 */
export async function renameFolder(folderId: string, newName: string) {
  try {
    const user = await getCurrentUser();

    if (!newName || newName.trim().length === 0) {
      throw new Error("Le nom du dossier ne peut pas être vide");
    }

    await prisma.folder.update({
      where: {
        id: folderId,
        userId: user.id,
      },
      data: {
        name: newName.trim(),
      },
    });

    revalidatePath("/documents");
    return { success: true };
  } catch (error) {
    console.error("Erreur lors du renommage:", error);
    throw new Error(
      error instanceof Error ? error.message : "Erreur lors du renommage"
    );
  }
}

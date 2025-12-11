# 📸 Instructions pour Ajouter l'Image de Fond

## ✅ ÉTAPE 1 : Placer l'Image

1. **Téléchargez ou copiez votre image** dans le dossier :
   ```
   /Users/bryandev/Documents/numera-ai/public/images/
   ```

2. **Nommez l'image** : `auth-background.jpg`

   Si votre image a une autre extension (`.png`, `.webp`, etc.), vous pouvez :
   - Soit renommer l'image en `auth-background.jpg`
   - Soit modifier le code dans `app/(auth)/sign-in/[[...sign-in]]/page.tsx` ligne 19 :
     ```typescript
     src="/images/auth-background.jpg"  // Changez .jpg par votre extension
     ```

---

## 📋 OPTIMISATION RECOMMANDÉE

Pour une meilleure performance, voici les recommandations :

### Format de l'image
- ✅ **Format recommandé** : `.webp` (meilleure compression)
- ✅ **Alternative** : `.jpg` ou `.png`

### Dimensions recommandées
- ✅ **Largeur** : 1200px - 1920px
- ✅ **Ratio** : 16:9 ou similaire
- ✅ **Taille fichier** : < 500KB (optimisé)

### Outils d'optimisation

1. **En ligne** :
   - https://squoosh.app/ (compression WebP)
   - https://tinypng.com/ (compression PNG/JPG)

2. **Via ligne de commande** :
   ```bash
   # Avec ImageMagick (si installé)
   convert votre-image.jpg -quality 85 -resize 1920x public/images/auth-background.jpg
   ```

---

## 🎨 AMÉLIORATIONS UX APPLIQUÉES

### 1. **Image en Arrière-plan**
- Image optimisée avec Next.js `Image` component
- `object-cover` pour un remplissage parfait
- `priority` pour chargement immédiat

### 2. **Overlays pour Lisibilité**
- Overlay sombre (`from-slate-900/80`) pour contraste
- Overlay de brillance subtil pour profondeur
- Texte avec `drop-shadow` pour lisibilité

### 3. **Effets Visuels**
- `backdrop-blur-sm` sur le logo pour effet de verre
- Ombres (`shadow-lg`) pour profondeur
- Transitions fluides sur les éléments interactifs

### 4. **Responsive**
- Image cachée sur mobile (`hidden lg:flex`)
- Formulaire centré et optimisé sur mobile

---

## 🚀 APRES AVOIR AJOUTE L'IMAGE

Une fois l'image placée dans `/public/images/auth-background.jpg`, le serveur Next.js la chargera automatiquement.

**Pas besoin de redémarrer**, le hot-reload de Next.js prendra en charge l'image automatiquement !

---

## 🔄 SI L'IMAGE NE S'AFFICHE PAS

1. **Vérifiez le chemin** :
   - L'image doit être dans : `public/images/auth-background.jpg`
   - Le chemin dans le code est : `/images/auth-background.jpg`

2. **Vérifiez le nom** :
   - Respectez la casse : `auth-background.jpg` (pas `Auth-Background.jpg`)

3. **Vérifiez l'extension** :
   - `.jpg`, `.jpeg`, `.png`, `.webp` sont acceptés

4. **Redémarrez le serveur** si nécessaire :
   ```bash
   npm run dev
   ```

---

## 📝 MODIFICATION DU NOM D'IMAGE

Si vous voulez utiliser un nom différent :

1. Renommez votre image
2. Modifiez `app/(auth)/sign-in/[[...sign-in]]/page.tsx` ligne 19 :
   ```typescript
   src="/images/VOTRE-NOM-IMAGE.jpg"
   ```

---

## 🎉 RÉSULTAT ATTENDU

Une fois l'image ajoutée, vous verrez :
- ✅ Image professionnelle en arrière-plan à gauche
- ✅ Overlay sombre pour une meilleure lisibilité du texte
- ✅ Logo et texte bien visibles sur l'image
- ✅ Formulaire propre à droite
- ✅ Expérience utilisateur améliorée

**L'image ajoute une dimension professionnelle et moderne à votre page de connexion !** 🎨


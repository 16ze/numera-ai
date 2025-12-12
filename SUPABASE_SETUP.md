# Configuration Supabase pour l'upload de logos

Ce guide vous explique comment configurer Supabase Storage pour permettre l'upload de logos d'entreprise sur les factures.

## 1. Variables d'environnement

Ajoutez ces variables dans votre fichier `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon-publique
```

### Où trouver ces valeurs ?

1. Allez sur [https://supabase.com](https://supabase.com) et connectez-vous
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Dans le dashboard, allez dans **Settings** → **API**
4. Copiez :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Créer le bucket "logos" dans Supabase

### Via le Dashboard Supabase :

1. Dans votre projet Supabase, allez dans **Storage** (menu de gauche)
2. Cliquez sur **"New bucket"** ou **"Créer un bucket"**
3. Configurez le bucket :
   - **Name** : `logos`
   - **Public bucket** : ✅ **Cochez cette case** (nécessaire pour que les logos soient accessibles publiquement)
   - **File size limit** : 5 MB (ou plus selon vos besoins)
   - **Allowed MIME types** : 
     - `image/jpeg`
     - `image/png`
     - `image/gif`
     - `image/webp`
4. Cliquez sur **"Create bucket"**

### Via SQL (Alternative) :

Si vous préférez utiliser SQL, exécutez cette commande dans l'éditeur SQL de Supabase :

```sql
-- Créer le bucket "logos"
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true);

-- Politique pour permettre l'upload à tous les utilisateurs authentifiés
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Politique pour permettre la lecture publique
CREATE POLICY "Allow public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'logos');

-- Politique pour permettre la suppression aux utilisateurs authentifiés
CREATE POLICY "Allow authenticated deletes"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'logos');
```

## 3. Politiques de sécurité (Row Level Security)

Si vous utilisez l'approche SQL, les politiques sont déjà configurées ci-dessus.

Sinon, via le dashboard :
1. Allez dans **Storage** → **Policies** pour le bucket `logos`
2. Créez ces politiques :

### Politique d'upload (INSERT) :
- **Name** : Allow authenticated uploads
- **Allowed operation** : INSERT
- **Target roles** : authenticated
- **Policy definition** : `bucket_id = 'logos'`

### Politique de lecture (SELECT) :
- **Name** : Allow public read
- **Allowed operation** : SELECT
- **Target roles** : public
- **Policy definition** : `bucket_id = 'logos'`

### Politique de suppression (DELETE) :
- **Name** : Allow authenticated deletes
- **Allowed operation** : DELETE
- **Target roles** : authenticated
- **Policy definition** : `bucket_id = 'logos'`

## 4. Vérification

Une fois configuré, vous devriez pouvoir :
1. Aller dans **Settings** → **Logo de l'entreprise**
2. Cliquer sur **"Ajouter un logo"**
3. Sélectionner une image
4. Le logo apparaît immédiatement
5. Le logo s'affiche sur vos factures

## Notes importantes

- Les logos sont stockés dans le bucket `logos` avec le nom `{companyId}-{timestamp}.{extension}`
- La taille maximale par défaut est de 5 MB
- Les formats acceptés sont : JPEG, PNG, GIF, WebP
- Les URLs des logos sont publiques (nécessaire pour l'affichage sur les factures)
- L'ancien logo est automatiquement supprimé lors de l'upload d'un nouveau logo

## Dépannage

### Erreur "Variables d'environnement Supabase manquantes"
- Vérifiez que vos variables `.env.local` sont bien définies
- Redémarrez le serveur de développement après avoir modifié `.env.local`

### Erreur "Bucket 'logos' not found"
- Vérifiez que le bucket `logos` existe bien dans Supabase Storage
- Vérifiez que le bucket est marqué comme **public**

### Erreur "new row violates row-level security policy"
- Vérifiez que les politiques de sécurité sont bien configurées (voir section 3)
- Le bucket doit autoriser l'upload pour les utilisateurs authentifiés

### Le logo ne s'affiche pas sur les factures
- Vérifiez que le bucket est **public** (cochez "Public bucket")
- Vérifiez que l'URL du logo est bien enregistrée dans la base de données
- Ouvrez l'URL du logo directement dans le navigateur pour vérifier qu'elle est accessible


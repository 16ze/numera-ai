# Configuration Resend pour l'envoi d'emails de factures

Ce guide vous explique comment configurer Resend pour envoyer vos factures par email.

## 1. Créer un compte Resend

1. Allez sur [https://resend.com](https://resend.com)
2. Créez un compte gratuit (100 emails/jour gratuits)
3. Confirmez votre email

## 2. Obtenir votre clé API

1. Dans le dashboard Resend, allez dans **API Keys**
2. Cliquez sur **Create API Key**
3. Donnez un nom à votre clé (ex: "Numera Production")
4. Sélectionnez les permissions :
   - ✅ **Sending access** (obligatoire)
5. Copiez la clé API générée (elle ne sera affichée qu'une seule fois)

## 3. Variables d'environnement

Ajoutez ces variables dans votre fichier `.env.local` :

```env
# Obligatoire - Votre clé API Resend
RESEND_API_KEY=re_VotreCleApiResend

# Optionnel - Email expéditeur (par défaut: onboarding@resend.dev pour les tests)
RESEND_FROM_EMAIL=noreply@votre-domaine.com

# Optionnel - URL de base de l'application (par défaut: http://localhost:3000)
NEXT_PUBLIC_APP_URL=https://votre-domaine.com
```

### Pour les tests (développement)

Utilisez l'email de test fourni par Resend :

```env
RESEND_API_KEY=re_VotreCleApi
RESEND_FROM_EMAIL=onboarding@resend.dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Pour la production

Vous devez **vérifier votre domaine** dans Resend pour utiliser votre propre adresse email.

## 4. Vérifier un domaine (Production uniquement)

Pour envoyer des emails depuis votre propre domaine (ex: `factures@votre-entreprise.com`) :

1. Dans le dashboard Resend, allez dans **Domains**
2. Cliquez sur **Add Domain**
3. Entrez votre nom de domaine (ex: `votre-entreprise.com`)
4. Suivez les instructions pour ajouter les enregistrements DNS :
   - **SPF** (TXT record)
   - **DKIM** (TXT record)
   - **DMARC** (optionnel mais recommandé)
5. Attendez la vérification (peut prendre quelques minutes à 48h)
6. Une fois vérifié, mettez à jour votre `.env.local` :

```env
RESEND_FROM_EMAIL=factures@votre-entreprise.com
```

## 5. Tester l'envoi

Une fois configuré :

1. Redémarrez votre serveur de développement :
   ```bash
   npm run dev
   ```

2. Allez sur une facture dans votre application
3. Cliquez sur le bouton **"Envoyer par email"**
4. Vérifiez la boîte mail du client

## 6. Template d'email

Le template d'email (`components/emails/InvoiceEmail.tsx`) affiche :

- ✅ Logo de l'entreprise (si configuré) ou nom de l'entreprise
- ✅ Message personnalisé : "Bonjour [Client], voici votre facture [Numéro] de [Montant]€"
- ✅ Bouton "📄 Voir la facture" pointant vers l'URL de la facture
- ✅ Lien alternatif si le bouton ne fonctionne pas
- ✅ Pied de page "Merci de votre confiance"

## 7. Limites et tarification

### Plan Gratuit
- **100 emails/jour**
- Idéal pour tester et petites entreprises

### Plans payants
- **$20/mois** : 50,000 emails/mois
- **$80/mois** : 1,000,000 emails/mois
- Voir [resend.com/pricing](https://resend.com/pricing)

## 8. Prochaines étapes

Pour intégrer le bouton d'envoi dans l'interface :

1. Ajouter un bouton "Envoyer par email" dans `InvoiceActions.tsx`
2. Appeler la fonction `sendInvoiceEmail(invoiceId)`
3. Afficher un toast de confirmation

## Dépannage

### Erreur "RESEND_API_KEY manquante"
- Vérifiez que la variable est bien définie dans `.env.local`
- Redémarrez le serveur après avoir modifié `.env.local`

### Erreur "Le client n'a pas d'adresse email"
- Allez dans **Clients** → Modifiez le client → Ajoutez un email

### Erreur "Domain not verified"
- Vous essayez d'utiliser un domaine non vérifié
- Utilisez `onboarding@resend.dev` pour les tests
- Ou vérifiez votre domaine (voir section 4)

### L'email n'arrive pas
- Vérifiez les spams
- Si vous utilisez `onboarding@resend.dev`, les emails peuvent être retardés
- En production avec domaine vérifié, la délivrabilité est excellente

### Erreur "Rate limit exceeded"
- Vous avez dépassé votre quota (100 emails/jour en gratuit)
- Attendez 24h ou passez à un plan payant

## Support

- Documentation Resend : [resend.com/docs](https://resend.com/docs)
- Discord Resend : [resend.com/discord](https://resend.com/discord)


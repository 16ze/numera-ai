# 📱 Correction : "Phone numbers from France are currently not supported"

## ❌ Problème

Clerk affiche l'option "Utiliser téléphone" mais les numéros français ne sont pas supportés en mode développement.

Message d'erreur :
```
Phone numbers from this country (France) are currently not supported. 
For more information, please contact support.
```

## ✅ Solution

### Option 1 : Désactiver l'authentification par téléphone (Recommandé)

1. Allez sur https://dashboard.clerk.com
2. Sélectionnez votre application **"Numera AI"**
3. Dans le menu de gauche, cliquez sur **"User & Authentication"**
4. Cliquez sur **"Email, Phone, Username"**
5. Dans la section **"Contact information"** :
   - ✅ **Email address** : Activé (laissez activé)
   - ❌ **Phone number** : Désactivez cette option
6. Cliquez sur **"Save"**

### Option 2 : Activer les SMS en production

Si vous voulez garder l'authentification par téléphone, vous devez :

1. Passer à un plan payant Clerk (ou utiliser vos clés de production)
2. Configurer un provider SMS (Twilio, etc.)
3. Activer les numéros français dans la configuration

**Note** : Cette option n'est pas nécessaire pour la plupart des applications SaaS.

## 🎯 Résultat après désactivation

Le formulaire de connexion/inscription affichera seulement :
- ✅ **Email + Mot de passe**
- ✅ **Continuer avec Google** (OAuth)
- ❌ Plus de lien "Utiliser téléphone"

## ⚠️ Important

Ce n'est **PAS une erreur de votre code**, c'est une limitation des clés de développement Clerk.

En utilisant uniquement l'email, votre application fonctionnera parfaitement !


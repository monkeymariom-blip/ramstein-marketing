import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Sparkles,
  Camera,
  Megaphone,
  Share2,
  Search,
  Calendar,
  Copy,
  Check,
  Image as ImageIcon,
  RefreshCw,
  MessageSquare,
  Star,
  Award,
  Utensils,
  BedDouble,
  Heart,
  Globe,
  MapPin,
  AlertCircle,
  LogOut,
  Lock,
} from 'lucide-react';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  syncUserProfile,
} from './firebase.ts';

type ActiveTab = 'social' | 'seo' | 'reviews' | 'planner';
type ContentType = 'food' | 'room' | 'spa' | 'event';
type SeoType = 'meta' | 'gbp' | 'faq';

interface CallGeminiOptions {
  prompt: string;
  systemInstruction?: string;
  imageDataUrl?: string | null;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('social');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAuthError('');
      if (!currentUser) {
        setUser(null);
        setIsAuthorized(false);
        setAuthLoading(false);
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        const verifyRes = await fetch('/api/auth/verify', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const verifyData = (await verifyRes.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };

        if (!verifyRes.ok || !verifyData.ok) {
          setUser(currentUser);
          setIsAuthorized(false);
          setAuthError(
            verifyData.error ||
              "Votre compte n'est pas autorisé à accéder à cette application."
          );
          setAuthLoading(false);
          return;
        }

        await syncUserProfile(currentUser).catch((err) => {
          console.warn('Profile sync warning:', err);
        });

        setUser(currentUser);
        setIsAuthorized(true);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Impossible de vérifier l'authentification.";
        setUser(currentUser);
        setIsAuthorized(false);
        setAuthError(message);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Connexion annulée.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'La fenêtre de connexion a été bloquée par votre navigateur. Veuillez autoriser les pop-ups.'
        );
      } else {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'Erreur lors de la connexion avec Google.'
        );
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError('');
    await signOutUser();
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Texte copié dans le presse-papier !');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const callGeminiText = async ({
    prompt,
    systemInstruction = '',
    imageDataUrl = null,
  }: CallGeminiOptions): Promise<string> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }

    const token = await currentUser.getIdToken();
    const response = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt,
        systemInstruction,
        imageDataUrl: imageDataUrl || undefined,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      text?: string;
      error?: string;
    };

    if (!response.ok || !data.text) {
      throw new Error(
        data.error || "Une erreur est survenue lors de la génération avec Gemini."
      );
    }

    return data.text;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-stone-400">
          <RefreshCw className="w-7 h-7 animate-spin text-amber-500" />
          <span className="text-xs font-medium">
            Vérification de la session...
          </span>
        </div>
      </div>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-stone-950 border border-stone-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 pb-5 border-b border-stone-800">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-lg shadow-amber-900/40 border border-amber-500/30">
              <Utensils className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold text-amber-100 leading-tight">
                Auberge Ramstein
              </h1>
              <p className="text-xs text-stone-400 tracking-wide uppercase">
                Scherwiller • Assistant Marketing
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-full">
              <Lock className="w-3.5 h-3.5" /> Accès Authentifié
            </div>
            <h2 className="text-lg font-serif font-bold text-stone-100">
              Connexion requise
            </h2>
            <p className="text-xs text-stone-400 leading-relaxed">
              Connectez-vous avec votre compte Google pour accéder au studio
              réseaux sociaux, à l&apos;outil SEO local et aux réponses aux avis
              clients.
            </p>
          </div>

          {authError && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {!user ? (
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-medium rounded-xl shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2.5 text-sm transition-all disabled:opacity-50"
            >
              {isSigningIn ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>
                {isSigningIn
                  ? 'Connexion en cours...'
                  : 'Se connecter avec Google'}
              </span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 text-xs text-stone-300">
                Connecté en tant que{' '}
                <strong className="text-amber-300">{user.email}</strong>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Changer de compte</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 font-sans flex flex-col md:flex-row">
      {/* Toast message */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-amber-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-5 h-5" />
          <span className="font-medium text-sm">{toast}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-stone-950 border-r border-stone-800 p-6 flex flex-col justify-between shrink-0">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-stone-800">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-lg shadow-amber-900/40 border border-amber-500/30">
              <Utensils className="w-6 h-6 text-amber-100" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold text-amber-100 leading-tight">
                Auberge Ramstein
              </h1>
              <p className="text-xs text-stone-400 font-sans tracking-wide uppercase">
                Scherwiller • Alsace
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('social')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === 'social'
                  ? 'bg-amber-700/20 text-amber-400 border border-amber-600/30 shadow-inner'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
              }`}
            >
              <Camera className="w-5 h-5" />
              <span>Studio Réseaux Sociaux</span>
            </button>

            <button
              onClick={() => setActiveTab('seo')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === 'seo'
                  ? 'bg-amber-700/20 text-amber-400 border border-amber-600/30 shadow-inner'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
              }`}
            >
              <Search className="w-5 h-5" />
              <span>Référencement SEO & Google</span>
            </button>

            <button
              onClick={() => setActiveTab('reviews')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === 'reviews'
                  ? 'bg-amber-700/20 text-amber-400 border border-amber-600/30 shadow-inner'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
              }`}
            >
              <Star className="w-5 h-5" />
              <span>Réponses Avis Client</span>
            </button>

            <button
              onClick={() => setActiveTab('planner')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === 'planner'
                  ? 'bg-amber-700/20 text-amber-400 border border-amber-600/30 shadow-inner'
                  : 'text-stone-400 hover:bg-stone-900 hover:text-stone-200'
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span>Planificateur Meta</span>
            </button>
          </nav>
        </div>

        {/* Authenticated User Footer */}
        <div className="pt-6 border-t border-stone-800 space-y-3">
          <div className="bg-stone-900/70 p-3.5 rounded-xl border border-stone-800 flex items-center gap-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Profil'}
                className="w-9 h-9 rounded-full object-cover border border-amber-600/40 shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-amber-700 text-stone-100 flex items-center justify-center font-serif text-xs font-bold shrink-0">
                {(user.displayName || user.email || 'AR')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-stone-200 truncate">
                {user.displayName || 'Compte connecté'}
              </p>
              <p className="text-[11px] text-stone-400 truncate">
                {user.email}
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-2.5 px-3 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-3.5 h-3.5 text-stone-400" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-stone-900 overflow-y-auto">
        <header className="px-8 py-6 bg-stone-950/40 border-b border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-amber-500 mb-1">
              <MapPin className="w-3.5 h-3.5" /> Scherwiller, Route des Vins
              d&apos;Alsace
            </div>
            <h2 className="text-2xl font-serif font-bold text-stone-100">
              {activeTab === 'social' &&
                'Créateur de Contenu Social (Instagram & Facebook)'}
              {activeTab === 'seo' && 'Optimisation SEO Local & Site Web'}
              {activeTab === 'reviews' &&
                'Gestionnaire de Réputation & Avis Google'}
              {activeTab === 'planner' && 'Planning & Export Meta Business'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-full text-xs bg-amber-950/60 text-amber-300 border border-amber-800/40 flex items-center gap-1.5 font-medium">
              <Award className="w-3.5 h-3.5 text-amber-400" /> Gastronomie &
              Hôtel 3★
            </span>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {activeTab === 'social' && (
            <SocialStudio
              callGeminiText={callGeminiText}
              handleCopy={handleCopy}
              copiedId={copiedId}
              showToast={showToast}
            />
          )}
          {activeTab === 'seo' && (
            <SeoTool
              callGeminiText={callGeminiText}
              handleCopy={handleCopy}
              copiedId={copiedId}
            />
          )}
          {activeTab === 'reviews' && (
            <ReviewResponder
              callGeminiText={callGeminiText}
              handleCopy={handleCopy}
              copiedId={copiedId}
            />
          )}
          {activeTab === 'planner' && (
            <MetaPlanner handleCopy={handleCopy} copiedId={copiedId} />
          )}
        </div>
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB 1: STUDIO RÉSEAUX SOCIAUX
// ----------------------------------------------------------------------
interface SocialStudioProps {
  callGeminiText: (opts: CallGeminiOptions) => Promise<string>;
  handleCopy: (text: string, id: string) => void;
  copiedId: string | null;
  showToast: (msg: string) => void;
}

function SocialStudio({
  callGeminiText,
  handleCopy,
  copiedId,
  showToast,
}: SocialStudioProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [contentType, setContentType] = useState<ContentType>('food');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hashtags] = useState([
    '#AubergeRamstein',
    '#Scherwiller',
    '#GastronomieAlsace',
    '#RoutedesVins',
    '#FaitMaison',
    '#AlsaceGourmande',
    '#HotelAlsace',
    '#LogisdeFrance',
  ]);
  const [selectedHashtags, setSelectedHashtags] = useState([
    '#AubergeRamstein',
    '#Scherwiller',
    '#GastronomieAlsace',
  ]);

  const presets: Record<ContentType, string> = {
    food: 'Assiette gastronomique, filet de cerf, spaetzles maison, jus réduit et morilles. Présentation élégante.',
    room: 'Chambre supérieure rénovée avec vue sur les vignes de Scherwiller, ambiance cocooning, literie haut de gamme.',
    spa: 'Espace détente avec spa, sauna et jacuzzi pour se ressourcer au cœur du vignoble Alsacien.',
    event:
      'Menu spécial Fête des Mères / Événement spécial autour des cépages locaux (Riesling de Scherwiller).',
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setSelectedImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleHashtag = (tag: string) => {
    if (selectedHashtags.includes(tag)) {
      setSelectedHashtags(selectedHashtags.filter((t) => t !== tag));
    } else {
      setSelectedHashtags([...selectedHashtags, tag]);
    }
  };

  const generateSocialPost = async () => {
    setIsGenerating(true);
    setErrorMsg('');
    const details = customPrompt.trim() || presets[contentType];
    const systemInstruction = `Tu es l'assistant marketing de l'Auberge Ramstein à Scherwiller (Alsace). L'auberge propose une cuisine gastronomique authentique, des chambres douillettes et un cadre chaleureux au cœur des vignes de Scherwiller.
Rédige un post engageant, convivial et gourmand pour Instagram & Facebook. Inclus des emojis adaptés et termine avec une incitation chaleureuse à la réservation (ex: lien en bio / réservation sur notre site).
Conserve un ton raffiné mais accessible.`;

    const prompt = `Crée un post pour les réseaux sociaux sur le sujet suivant : ${details}. Type de contenu : ${contentType}.${
      selectedImage
        ? " Appuie-toi également sur la photo jointe pour décrire visuellement ce qui y figure."
        : ''
    }`;

    try {
      const result = await callGeminiText({
        prompt,
        systemInstruction,
        imageDataUrl: selectedImage,
      });
      setGeneratedCaption(result);
      showToast('Légende générée avec succès !');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Impossible de générer la légende pour le moment.';
      setErrorMsg(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Input Column */}
      <div className="lg:col-span-6 space-y-6">
        {/* Photo Upload Box */}
        <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 shadow-md">
          <label className="text-sm font-medium text-stone-300 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-500" /> Photo du Plat ou de
              l&apos;Hôtel
            </span>
            <span className="text-xs text-stone-500">JPG, PNG supportés</span>
          </label>

          <div className="relative group border-2 border-dashed border-stone-800 hover:border-amber-600/50 rounded-xl p-4 transition-all duration-300 text-center bg-stone-900/50">
            {selectedImage ? (
              <div className="relative rounded-lg overflow-hidden max-h-72">
                <img
                  src={selectedImage}
                  alt="Aperçu"
                  className="w-full object-cover h-64 rounded-lg"
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 bg-stone-950/80 text-stone-300 px-3 py-1 rounded-full text-xs hover:bg-stone-900 border border-stone-700"
                >
                  Changer
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center justify-center py-8">
                <div className="w-14 h-14 rounded-full bg-amber-950/40 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <p className="text-sm font-medium text-stone-200">
                  Cliquez pour importer une photo
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  Prenez directement une photo de votre plat ou de votre chambre
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Content Type Selector */}
        <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 shadow-md space-y-4">
          <label className="block text-sm font-medium text-stone-300">
            Type d&apos;annonce
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { id: 'food', label: 'Plat / Gastronomie', icon: Utensils },
                { id: 'room', label: 'Séjour / Chambre', icon: BedDouble },
                { id: 'spa', label: 'Spa / Bien-être', icon: Heart },
                { id: 'event', label: 'Événement / Offre', icon: Megaphone },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setContentType(item.id)}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                  contentType === item.id
                    ? 'bg-amber-950/40 border-amber-600/60 text-amber-200'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <item.icon className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-2">
              Détails complémentaires (Ingrédients, nom du plat, vin suggéré...)
            </label>
            <textarea
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={`Ex: ${presets[contentType]}`}
              className="w-full bg-stone-900 border border-stone-800 rounded-xl p-3 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-600"
            />
          </div>

          {/* Hashtags Selection */}
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-2">
              Hashtags recommandés (cliquer pour activer/désactiver)
            </label>
            <div className="flex flex-wrap gap-2">
              {hashtags.map((tag) => {
                const isActive = selectedHashtags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleHashtag(tag)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-all border ${
                      isActive
                        ? 'bg-amber-600/20 text-amber-300 border-amber-600/40'
                        : 'bg-stone-900 text-stone-500 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={generateSocialPost}
            disabled={isGenerating}
            className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-medium rounded-xl shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Rédaction par l&apos;IA en cours...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Générer la Légende Sociale</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Output Preview Column */}
      <div className="lg:col-span-6 space-y-6">
        <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 shadow-md flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-800">
              <span className="text-sm font-serif font-bold text-stone-200 flex items-center gap-2">
                <EyeIcon /> Aperçu du Post Instagram / Facebook
              </span>
              <span className="text-xs bg-stone-900 text-amber-400 px-2.5 py-1 rounded-md border border-stone-800 font-mono">
                @aubergeramstein
              </span>
            </div>

            {/* Social Card Preview */}
            <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden mb-6 shadow-inner">
              {/* Card Header */}
              <div className="p-3 bg-stone-900 border-b border-stone-800/60 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-700 text-stone-100 flex items-center justify-center font-serif text-xs font-bold">
                  AR
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-200">
                    Auberge Ramstein
                  </p>
                  <p className="text-[10px] text-stone-400">
                    Scherwiller, Alsace
                  </p>
                </div>
              </div>

              {/* Card Image */}
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt="Post"
                  className="w-full h-56 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-stone-950 flex flex-col items-center justify-center text-stone-600 gap-2">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                  <span className="text-xs">Aucune image chargée</span>
                </div>
              )}

              {/* Card Content Text */}
              <div className="p-4 space-y-3">
                {generatedCaption ? (
                  <div className="text-xs text-stone-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {generatedCaption}
                    <div className="mt-3 text-amber-400/90 font-medium">
                      {selectedHashtags.join(' ')}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 italic">
                    Cliquez sur &quot;Générer la Légende Sociale&quot; pour voir
                    le rendu de votre publication ici...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {generatedCaption && (
            <div className="pt-4 border-t border-stone-800 flex gap-3">
              <button
                onClick={() =>
                  handleCopy(
                    `${generatedCaption}\n\n${selectedHashtags.join(' ')}`,
                    'caption'
                  )
                }
                className="flex-1 py-3 bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all"
              >
                {copiedId === 'caption' ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-stone-400" />
                )}
                <span>Copier le texte complet</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      className="w-4 h-4 text-amber-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ----------------------------------------------------------------------
// TAB 2: RÉFÉRENCEMENT SEO & GOOGLE
// ----------------------------------------------------------------------
interface SeoToolProps {
  callGeminiText: (opts: CallGeminiOptions) => Promise<string>;
  handleCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

function SeoTool({ callGeminiText, handleCopy, copiedId }: SeoToolProps) {
  const [seoType, setSeoType] = useState<SeoType>('meta');
  const [pageSubject, setPageSubject] = useState(
    'Restaurant gastronomique & spécialités alsaciennes'
  );
  const [seoOutput, setSeoOutput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generateSeoContent = async () => {
    setIsLoading(true);
    setErrorMsg('');
    const systemInstruction =
      "Tu es un expert en référencement local (SEO) pour l'hôtellerie-restauration en Alsace (France).";
    let prompt = '';

    if (seoType === 'meta') {
      prompt = `Génère un Titre Meta (max 60 caractères) et une Description Meta (max 155 caractères) optimisés SEO pour l'Auberge Ramstein à Scherwiller (Alsace) sur le sujet : "${pageSubject}". Inclus des mots-clés locaux forts comme Scherwiller, Route des Vins d'Alsace, Restaurant Gastronomique, Hôtel 3 étoiles.`;
    } else if (seoType === 'gbp') {
      prompt = `Rédige une mise à jour d'actualité pour la fiche Google Business Profile de l'Auberge Ramstein à Scherwiller concernant : "${pageSubject}". Rends le texte incitatif pour inciter les voyageurs et clients locaux à venir réserver.`;
    } else {
      prompt = `Rédige 3 questions-réponses optimisées pour la FAQ du site web de l'Auberge Ramstein sur le thème : "${pageSubject}". Exemples d'infos : Parking privé, terrasse avec vue sur les vignes, borne de recharge, animaux acceptés.`;
    }

    try {
      const res = await callGeminiText({ prompt, systemInstruction });
      setSeoOutput(res);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Impossible de générer le contenu SEO.';
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 shadow-md space-y-5">
          <div>
            <h3 className="text-base font-serif font-bold text-stone-200 mb-1">
              Boîte à Outils SEO Local
            </h3>
            <p className="text-xs text-stone-400">
              Optimisez la visibilité de l&apos;Auberge sur Google Maps et les
              moteurs de recherche.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-300">
              Type de contenu SEO
            </label>
            <div className="space-y-2">
              {(
                [
                  {
                    id: 'meta',
                    title: 'Balises Meta (Title & Description)',
                    desc: "Pour le site internet de l'auberge",
                  },
                  {
                    id: 'gbp',
                    title: 'Publication Google Business',
                    desc: 'Pour la fiche Google Maps',
                  },
                  {
                    id: 'faq',
                    title: 'FAQ Optimisée SEO',
                    desc: 'Questions récurrentes des clients',
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSeoType(item.id)}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all ${
                    seoType === item.id
                      ? 'bg-amber-950/40 border-amber-600/60 text-amber-200'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="text-xs font-bold text-stone-200">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-2">
              Sujet ou Page Ciblée
            </label>
            <input
              type="text"
              value={pageSubject}
              onChange={(e) => setPageSubject(e.target.value)}
              placeholder="Ex: Soirée accords mets & vins Riesling de Scherwiller"
              className="w-full bg-stone-900 border border-stone-800 rounded-xl p-3 text-xs text-stone-200 focus:outline-none focus:border-amber-600"
            />
          </div>

          {errorMsg && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={generateSeoContent}
            disabled={isLoading}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Générer le contenu SEO</span>
          </button>
        </div>
      </div>

      <div className="lg:col-span-7">
        <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 shadow-md h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-800">
              <span className="text-sm font-serif font-bold text-stone-200 flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-500" /> Résultat
                Rédactionnel SEO
              </span>
              {seoOutput && (
                <button
                  onClick={() => handleCopy(seoOutput, 'seo')}
                  className="text-xs bg-stone-900 hover:bg-stone-800 text-amber-400 px-3 py-1.5 rounded-lg border border-stone-700 flex items-center gap-1.5"
                >
                  {copiedId === 'seo' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copier</span>
                </button>
              )}
            </div>

            {seoOutput ? (
              <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-xs text-stone-300 whitespace-pre-wrap leading-relaxed font-mono">
                {seoOutput}
              </div>
            ) : (
              <div className="text-center py-16 text-stone-500">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-xs">
                  Choisissez un type de contenu et cliquez sur générer.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 bg-amber-950/20 border border-amber-800/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-stone-400">
              <strong className="text-stone-200">
                Conseil Référencement Scherwiller :
              </strong>{' '}
              Mentionnez toujours le terme <em>&quot;Scherwiller&quot;</em> et{' '}
              <em>&quot;Route des Vins d&apos;Alsace&quot;</em> dans vos fiches
              et articles. Ce sont les mots-clés locaux les plus recherchés par
              les touristes.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB 3: RÉPONSES AVIS CLIENTS GOOGLE
// ----------------------------------------------------------------------
interface ReviewResponderProps {
  callGeminiText: (opts: CallGeminiOptions) => Promise<string>;
  handleCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

function ReviewResponder({
  callGeminiText,
  handleCopy,
  copiedId,
}: ReviewResponderProps) {
  const [reviewRating, setReviewRating] = useState(5);
  const [clientReview, setClientReview] = useState(
    "Un séjour merveilleux à l'Auberge Ramstein ! La cuisine du restaurant est un vrai régal et le service est très attentionné. Nous avons adoré le cadre au milieu des vignes de Scherwiller."
  );
  const [reply, setReply] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const generateReply = async () => {
    setIsReplying(true);
    setErrorMsg('');
    const systemInstruction = `Tu es le propriétaire de l'Auberge Ramstein à Scherwiller. Rédige une réponse chaleureuse, professionnelle et personnalisée à l'avis laissé par un client.
Si l'avis est très positif (4-5 étoiles), remercie-le et réinvite-le à revenir goûter les prochaines créations du Chef.
Si l'avis présente des réserves (1-3 étoiles), reste courtois, compréhensif et propose d'échanger en privé pour améliorer l'expérience.`;

    const prompt = `Avis client (${reviewRating}/5 étoiles) : "${clientReview}"`;

    try {
      const res = await callGeminiText({ prompt, systemInstruction });
      setReply(res);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Impossible de générer la réponse.';
      setErrorMsg(message);
    } finally {
      setIsReplying(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-6 space-y-6">
        <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 shadow-md space-y-4">
          <div>
            <h3 className="text-base font-serif font-bold text-stone-200 mb-1">
              Réponse Automatique aux Avis Google
            </h3>
            <p className="text-xs text-stone-400">
              Collez l&apos;avis reçu sur Google Maps pour obtenir une réponse
              sur-mesure.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-2">
              Note attribuée par le client
            </label>
            <div className="flex gap-2">
              {[5, 4, 3, 2, 1].map((star) => (
                <button
                  key={star}
                  onClick={() => setReviewRating(star)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                    reviewRating === star
                      ? 'bg-amber-600/20 border-amber-600 text-amber-300'
                      : 'bg-stone-900 border-stone-800 text-stone-500'
                  }`}
                >
                  <span>{star}</span>
                  <Star
                    className={`w-3.5 h-3.5 ${
                      reviewRating >= star
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-stone-600'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-2">
              Texte de l&apos;avis client
            </label>
            <textarea
              rows={4}
              value={clientReview}
              onChange={(e) => setClientReview(e.target.value)}
              className="w-full bg-stone-900 border border-stone-800 rounded-xl p-3 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-600"
            />
          </div>

          {errorMsg && (
            <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            onClick={generateReply}
            disabled={isReplying}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isReplying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
            <span>Générer la Réponse Professionnelle</span>
          </button>
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 shadow-md h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-800">
              <span className="text-sm font-serif font-bold text-stone-200 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Réponse Prête à
                Publier
              </span>
              {reply && (
                <button
                  onClick={() => handleCopy(reply, 'reply')}
                  className="text-xs bg-stone-900 hover:bg-stone-800 text-amber-400 px-3 py-1.5 rounded-lg border border-stone-700 flex items-center gap-1.5"
                >
                  {copiedId === 'reply' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copier pour Google</span>
                </button>
              )}
            </div>

            {reply ? (
              <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-xs text-stone-300 whitespace-pre-wrap leading-relaxed">
                {reply}
              </div>
            ) : (
              <div className="text-center py-16 text-stone-500">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-xs">
                  Cliquez sur générer pour créer la réponse.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// TAB 4: PLANIFICATEUR & META BUSINESS
// ----------------------------------------------------------------------
interface MetaPlannerProps {
  handleCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

function MetaPlanner({ handleCopy, copiedId }: MetaPlannerProps) {
  const posts = [
    {
      id: 1,
      day: 'Vendredi',
      date: '12:00',
      type: 'Gastronomie',
      text: "Weekend gourmand à Scherwiller ! 🍷 Venez découvrir notre suggestion du Chef accompagnée d'un cru d'Alsace d'exception.",
      hashtags: '#AubergeRamstein #GastronomieAlsace #Scherwiller',
    },
    {
      id: 2,
      day: 'Dimanche',
      date: '18:30',
      type: 'Séjour & Spa',
      text: 'Prolongez le week-end au calme... Une nuit au cœur du vignoble suivie d’un petit-déjeuner alsacien. 🛌✨',
      hashtags: '#HotelAlsace #WeekendVignoble #AubergeRamstein',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-stone-950 p-6 rounded-2xl border border-stone-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-800">
          <div>
            <h3 className="text-base font-serif font-bold text-stone-200">
              Planificateur Semaine
            </h3>
            <p className="text-xs text-stone-400">
              Préparez vos publications puis collez-les directement dans Meta
              Business Suite.
            </p>
          </div>
          <a
            href="https://business.facebook.com/"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-medium text-xs rounded-xl shadow flex items-center gap-2 w-fit"
          >
            <Share2 className="w-4 h-4" /> Ouvrir Meta Business Suite
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-800/40">
                  {post.day} • {post.date}
                </span>
                <span className="text-[10px] bg-stone-950 text-stone-400 px-2 py-0.5 rounded border border-stone-800">
                  {post.type}
                </span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed">
                {post.text}
              </p>
              <div className="text-[11px] text-amber-500 font-mono">
                {post.hashtags}
              </div>
              <button
                onClick={() =>
                  handleCopy(
                    `${post.text}\n\n${post.hashtags}`,
                    `plan-${post.id}`
                  )
                }
                className="w-full py-2 bg-stone-950 hover:bg-stone-800 text-stone-300 text-xs rounded-lg border border-stone-800 flex items-center justify-center gap-2 transition-all"
              >
                {copiedId === `plan-${post.id}` ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>Copier pour Meta Suite</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

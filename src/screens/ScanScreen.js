import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Camera, ChevronLeft, ChevronRight, RefreshCw, Scan, FileText, CheckCircle2, ShieldCheck, X, Lightbulb, Image as ImageIcon, Sparkles } from 'lucide-react-native';
import { supabase } from '../config/supabase';
import { SUPABASE_KEY } from '../config/supabase';
import { posthog } from '../config/posthog';
import { EDGE_FN_URL, RECEIPT_FN_URL } from '../config/urls';
import { C, LOC_ITEMS, urgBg } from '../config/constants';
import { FREE_ITEMS_LIMIT } from '../config/purchases';
import { parseDlc, formatDlcInput, normalizeDlc, suggestLocation, estimateDays } from '../utils/product';
import { searchSpoonacular } from '../api/spoonacular';
import { searchOpenFoodFacts, searchImageByName } from '../api/openfoodfacts';
import { searchProductCache, saveProductCache } from '../api/productCache';
import { mergeProductData } from '../utils/product';
import { styles } from '../styles';
import * as Haptics from 'expo-haptics';

const RECEIPT_SCREEN = {
  title: 'Scan ticket de caisse',
  hero: {
    title: 'Prends en photo ton ticket',
    description: "L'IA Frigy extrait automatiquement tous les produits alimentaires et leurs prix.",
  },
  actions: [
    { id: 'camera',  title: 'Prendre une photo',         fromCamera: true },
    { id: 'gallery', title: 'Choisir depuis la galerie',  fromCamera: false },
  ],
  security: {
    title: 'Tes données sont sécurisées.',
    description: "Aucune information bancaire n'est stockée.",
  },
};

const PHOTO_SCREEN = {
  title: 'Photo des courses',
  subtitle: 'Choisis la méthode qui te convient pour ajouter rapidement plusieurs produits.',
  aiInfo: 'Fridgy reconnaît tous les produits visibles et lit les dates de péremption automatiquement.',
};

const PHOTO_METHODS_CONFIG = [
  {
    id: 'camera',
    title: 'Prendre une photo',
    description: 'Pose tes courses sur une table et photographie-les.',
    feature: 'Idéal pour plusieurs produits',
    color: C.green,
    iconBg: '#EDFDF1',
    badgeBg: '#D1FAE5',
    fromCamera: true,
  },
  {
    id: 'gallery',
    title: 'Depuis la galerie',
    description: 'Choisis une photo déjà prise dans ta galerie.',
    feature: 'Utilise une photo existante',
    color: '#F5B700',
    iconBg: '#FFFBEB',
    badgeBg: '#FEF3C7',
    fromCamera: false,
  },
];

export default function ScanScreen({ onClose, setItems, items, user, familyId, isPro, onPaywall }) {
  const [mode, setMode] = useState('choice');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState('Frigo');
  const [manualName, setManualName] = useState('');
  const [imgError, setImgError] = useState(false);

  const handleScanImgError = async () => {
    if (!result) { setImgError(true); return; }
    if (result.imgUrl?.includes('636x393')) {
      const fixedUrl = result.imgUrl.replace('636x393', '312x231');
      setResult(prev => ({ ...prev, imgUrl: fixedUrl }));
      if (result.barcode) saveProductCache(result.barcode, { ...result, imgUrl: fixedUrl });
      return;
    }
    if (result.barcode) {
      const spoon = await searchSpoonacular(result.barcode);
      if (spoon?.imgUrl && spoon.imgUrl !== result.imgUrl) {
        setResult(prev => ({ ...prev, imgUrl: spoon.imgUrl }));
        saveProductCache(result.barcode, { ...result, imgUrl: spoon.imgUrl });
        return;
      }
    }
    setImgError(true);
  };

  const [dlcInput, setDlcInput] = useState('');
  const dlcCamRef = useRef(null);
  const [dlcCapturing, setDlcCapturing] = useState(false);
  const [dlcScanReturn, setDlcScanReturn] = useState('scanner');
  const [dlcScanProductId, setDlcScanProductId] = useState(null);
  const [dlcScanIsReceipt, setDlcScanIsReceipt] = useState(false);
  const dlcBusyRef = useRef(false);
  const dlcApplyRef = useRef(null);
  const dlcIntervalRef = useRef(null);

  const openDlcScan = (returnMode, productId = null, isReceipt = false) => {
    dlcApplyRef.current = (dlc) => {
      const normalized = normalizeDlc(dlc);
      if (isReceipt && productId) updateReceiptDlc(productId, normalized);
      else if (productId) updateProductDlc(productId, normalized);
      else setDlcInput(normalized);
      setMode(returnMode);
    };
    setDlcScanReturn(returnMode);
    setDlcScanProductId(productId);
    setDlcScanIsReceipt(isReceipt);
    setMode('dlcScan');
  };

  useEffect(() => {
    if (mode !== 'dlcScan') {
      clearInterval(dlcIntervalRef.current);
      dlcBusyRef.current = false;
      return;
    }
    dlcIntervalRef.current = setInterval(async () => {
      if (dlcBusyRef.current || !dlcCamRef.current) return;
      dlcBusyRef.current = true;
      setDlcCapturing(true);
      try {
        const photo = await dlcCamRef.current.takePictureAsync({ quality: 1.0 });
        const resized = await ImageManipulator.manipulateAsync(
          photo.uri, [{ resize: { width: 1600 } }],
          { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        const res = await fetch(EDGE_FN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify({ imageBase64: resized.base64, mimeType: 'image/jpeg', mode: 'dlc_only' }),
        });
        const data = await res.json();
        if (data.dlc) {
          clearInterval(dlcIntervalRef.current);
          dlcApplyRef.current?.(data.dlc);
        }
      } catch { /* silent, keep retrying */ }
      setDlcCapturing(false);
      dlcBusyRef.current = false;
    }, 3500);
    return () => clearInterval(dlcIntervalRef.current);
  }, [mode]);

  const captureDlc = async () => {
    if (!dlcCamRef.current || dlcBusyRef.current) return;
    dlcBusyRef.current = true;
    setDlcCapturing(true);
    try {
      const photo = await dlcCamRef.current.takePictureAsync({ quality: 1.0 });
      const resized = await ImageManipulator.manipulateAsync(
        photo.uri, [{ resize: { width: 1600 } }],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const base64 = resized.base64;
      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', mode: 'dlc_only' }),
      });
      const data = await res.json();
      if (data.dlc) {
        clearInterval(dlcIntervalRef.current);
        dlcApplyRef.current?.(data.dlc);
      } else {
        Alert.alert('Date non trouvée', 'Pointe vers la date et réessaie, ou saisis-la manuellement.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de lire la date.');
    }
    setDlcCapturing(false);
    dlcBusyRef.current = false;
  };

  const [photoLoading, setPhotoLoading] = useState(false);
  const [detectedProducts, setDetectedProducts] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [packUnits, setPackUnits] = useState(1);

  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptSelectedIds, setReceiptSelectedIds] = useState([]);
  const [receiptSaving, setReceiptSaving] = useState(false);

  const launchReceipt = async (fromCamera) => {
    setReceiptLoading(true);
    try {
      const picked = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ['images'] });
      if (picked.canceled) { setReceiptLoading(false); return; }
      const resized = await ImageManipulator.manipulateAsync(
        picked.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const base64 = resized.base64;
      const res = await fetch(RECEIPT_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      });
      const data = await res.json();
      if (data.error) {
        Alert.alert('Erreur', `Analyse impossible : ${data.error}`);
        setReceiptLoading(false);
        return;
      }
      const withIds = (data.items || []).map((p, i) => ({
        ...p, _id: i.toString(),
        location: suggestLocation(p.category, p.name),
        days_left: estimateDays(p.category, p.name),
        emoji: p.emoji || '🛒',
      }));
      setReceiptData({ store: data.store, total: data.total, items: withIds });
      setReceiptSelectedIds(withIds.map(p => p._id));
    } catch {
      Alert.alert('Erreur', "Impossible d'analyser le ticket.");
    }
    setReceiptLoading(false);
  };

  const updateReceiptName = (id, name) => {
    setReceiptData(prev => ({ ...prev, items: prev.items.map(p => p._id === id ? { ...p, name } : p) }));
  };

  const updateReceiptLocation = (id, loc) => {
    setReceiptData(prev => ({ ...prev, items: prev.items.map(p => p._id === id ? { ...p, location: loc } : p) }));
  };

  const updateReceiptDlc = (id, raw) => {
    const formatted = formatDlcInput(raw);
    const days = parseDlc(formatted);
    setReceiptData(prev => ({ ...prev, items: prev.items.map(p =>
      p._id === id ? { ...p, dlcInput: formatted, days_left: days !== null ? days : p.days_left } : p
    )}));
  };

  const updateReceiptQuantity = (id, delta) => {
    setReceiptData(prev => ({ ...prev, items: prev.items.map(p =>
      p._id === id ? { ...p, quantity: Math.max(1, (p.quantity || 1) + delta) } : p
    )}));
  };

  const removeReceiptItem = (id) => {
    setReceiptData(prev => {
      const items = prev.items.filter(p => p._id !== id);
      return { ...prev, items };
    });
    setReceiptSelectedIds(prev => prev.filter(x => x !== id));
  };

  const saveReceiptProducts = async () => {
    const toSave = (receiptData?.items || []).filter(p => receiptSelectedIds.includes(p._id));
    if (!toSave.length) return;
    setReceiptSaving(true);
    const rows = toSave.map(p => ({
      family_id: familyId,
      added_by: user?.id,
      name: p.name,
      emoji: p.emoji,
      brand: p.brand || '',
      category: p.category || 'épicerie',
      location: p.location,
      quantity: p.quantity || 1,
      total_units: p.quantity || 1,
      unit: '',
      dlc: p.dlcInput || '—',
      days_left: parseDlc(p.dlcInput) !== null ? parseDlc(p.dlcInput) : (p.days_left || 30),
      nutri_grade: null,
      consumed: false,
      price: p.unit_price || null,
    }));
    const savedUnits = rows.map(r => r.total_units || 1);
    const { data, error } = await supabase.from('items').insert(rows).select();
    if (error) { Alert.alert('Erreur', 'Impossible de sauvegarder.'); setReceiptSaving(false); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setItems(prev => [...prev, ...(data || []).map((i, idx) => ({
      ...i, days: i.days_left, total_units: i.total_units || savedUnits[idx] || 1,
    }))]);
    posthog.capture('scan_completed', { method: 'receipt', products_count: rows.length, store: receiptData?.store || null, total: receiptData?.total || null });
    rows.forEach(r => posthog.capture('product_added', { method: 'receipt', name: r.name, brand: r.brand || null, category: r.category, location: r.location, has_dlc: r.dlc !== '—', price: r.price || null, quantity: r.quantity || 1 }));
    Alert.alert('✅ Ajouté !', `${rows.length} produit${rows.length > 1 ? 's' : ''} ajouté${rows.length > 1 ? 's' : ''} au stock.`);
    setReceiptSaving(false);
    setReceiptData(null);
    setReceiptSelectedIds([]);
    (data || []).forEach(async (item) => {
      if (item.img_url) return;
      const imgUrl = await searchImageByName(item.name);
      if (imgUrl) {
        await supabase.from('items').update({ img_url: imgUrl }).eq('id', item.id);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, img_url: imgUrl } : i));
      }
    });
  };

  const handleBarcode = async ({ data }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    setImgError(false);
    try {
      const [cached, spoonFresh, offFresh] = await Promise.all([
        searchProductCache(data),
        searchSpoonacular(data),
        searchOpenFoodFacts(data),
      ]);
      if (cached) {
        const imgUrl = spoonFresh?.imgUrl || offFresh?.imgUrl || cached.img_url || null;
        setResult({
          barcode: data, name: cached.name, brand: cached.brand || '',
          nutri: cached.nutri_grade, kcal: cached.kcal, emoji: '🛒',
          days: estimateDays(cached.category || '', cached.name),
          category: cached.category || '', imgUrl,
          source: cached.source || 'Cache', fromCache: true,
        });
        if (imgUrl && imgUrl !== cached.img_url) {
          saveProductCache(data, { name: cached.name, brand: cached.brand, category: cached.category,
            imgUrl, nutri: cached.nutri_grade, kcal: cached.kcal, source: cached.source });
        }
      } else {
        const merged = mergeProductData(offFresh, spoonFresh);
        if (merged.name) {
          setResult({
            barcode: data, name: merged.name, brand: merged.brand,
            nutri: merged.nutri, kcal: merged.kcal, emoji: '🛒',
            days: estimateDays(merged.category, merged.name),
            category: merged.category, imgUrl: merged.imgUrl,
            source: merged.source,
          });
          saveProductCache(data, merged);
        } else {
          setResult({ barcode: data, name: 'Produit inconnu', brand: '', emoji: '🛒', days: 30, source: 'Manuel' });
        }
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de lire ce code-barres');
      setScanned(false);
    }
    setLoading(false);
  };

  const addProduct = async () => {
    if (!result) return;
    if (!isPro && (items?.length ?? 0) >= FREE_ITEMS_LIMIT) { onPaywall?.(); return; }
    const finalName = result.source === 'Manuel' ? (manualName.trim() || 'Produit') : result.name;
    const dlcDays = parseDlc(dlcInput);
    const newItem = {
      family_id: familyId,
      added_by: user?.id,
      name: finalName,
      emoji: result.emoji || '🛒',
      brand: result.brand || '',
      category: result.category || 'Épicerie',
      location,
      quantity: packUnits,
      total_units: packUnits,
      unit: '',
      dlc: dlcInput || '—',
      days_left: dlcDays !== null ? dlcDays : (result.days || 30),
      nutri_grade: result.nutri || null,
      kcal: result.kcal || null,
      img_url: result.imgUrl || null,
      barcode: result.barcode || null,
      consumed: false,
    };
    const { data, error } = await supabase.from('items').insert(newItem).select().single();
    if (error) { Alert.alert('Erreur', 'Impossible de sauvegarder le produit.'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (result.source === 'Manuel' && manualName.trim() && result.barcode) {
      saveProductCache(result.barcode, {
        name: manualName.trim(), brand: '', category: result.category || '',
        imgUrl: result.imgUrl || null, nutri: null, kcal: null, source: 'Manuel',
      });
    }
    setItems(p => [...p, { ...data, days: data.days_left }]);
    posthog.capture('product_added', {
      method: 'barcode', name: finalName, brand: result.brand || null,
      category: result.category, location, has_dlc: !!dlcInput,
      source: result.source, quantity: packUnits,
    });
    const locLabel = location === 'Frigo' ? 'le frigo' : location === 'Congélateur' ? 'le congélateur' : 'le placard';
    Alert.alert('✅ Ajouté !', `${finalName} rangé dans ${locLabel}.`);
    onClose();
  };

  const launchPhoto = async (fromCamera) => {
    setPhotoLoading(true);
    try {
      const picked = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
      if (picked.canceled) { setPhotoLoading(false); return; }
      // Gallery images on iOS return ph:// URIs that FileSystem can't read — convert to file:// first
      let uri = picked.assets[0].uri;
      if (!fromCamera) {
        const converted = await ImageManipulator.manipulateAsync(uri, [], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
        uri = converted.uri;
      }
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      });
      const { products } = await res.json();
      const withIds = (products || []).map((p, i) => ({ ...p, _id: i.toString(), quantity: p.quantity || 1, location: suggestLocation(p.category, p.name) }));
      setDetectedProducts(withIds);
      setSelectedIds(withIds.map(p => p._id));
    } catch {
      Alert.alert('Erreur', "Impossible d'analyser la photo.");
    }
    setPhotoLoading(false);
  };

  const updateProductName = (id, name) => {
    setDetectedProducts(prev => prev.map(p => p._id === id ? { ...p, name } : p));
  };

  const updateProductLocation = (id, loc) => {
    setDetectedProducts(prev => prev.map(p => p._id === id ? { ...p, location: loc } : p));
  };

  const updateProductDlc = (id, raw) => {
    const formatted = formatDlcInput(raw);
    const days = parseDlc(formatted);
    setDetectedProducts(prev => prev.map(p =>
      p._id === id ? { ...p, dlcInput: formatted, days_left: days !== null ? days : p.days_left } : p
    ));
  };

  const updateProductQuantity = (id, delta) => {
    setDetectedProducts(prev => prev.map(p =>
      p._id === id ? { ...p, quantity: Math.max(1, (p.quantity || 1) + delta) } : p
    ));
  };

  const savePhotoProducts = async () => {
    const toSave = (detectedProducts || []).filter(p => selectedIds.includes(p._id));
    if (!toSave.length) return;
    setSaving(true);
    const rows = toSave.map(p => ({
      family_id: familyId,
      added_by: user?.id,
      name: p.name,
      emoji: p.emoji || '🛒',
      brand: p.brand || '',
      category: p.category || 'Épicerie',
      location: p.location || 'Frigo',
      quantity: p.quantity || 1,
      total_units: p.quantity || 1,
      unit: '',
      dlc: p.dlcInput || p.dlc || '—',
      days_left: parseDlc(p.dlcInput) !== null ? parseDlc(p.dlcInput) : (p.days_left || 30),
      nutri_grade: null,
      consumed: false,
    }));
    const { data, error } = await supabase.from('items').insert(rows).select();
    if (error) { Alert.alert('Erreur', 'Impossible de sauvegarder.'); setSaving(false); return; }
    setItems(prev => [...prev, ...(data || []).map(i => ({ ...i, days: i.days_left }))]);
    posthog.capture('scan_completed', { method: 'photo', products_count: rows.length });
    rows.forEach(r => posthog.capture('product_added', { method: 'photo', name: r.name, brand: r.brand || null, category: r.category, location: r.location, has_dlc: r.dlc !== '—', quantity: r.quantity || 1 }));
    Alert.alert('✅ Ajouté !', `${rows.length} produit${rows.length > 1 ? 's' : ''} rangé${rows.length > 1 ? 's' : ''}.`);
    setSaving(false);
    setDetectedProducts(null);
    setSelectedIds([]);
    (data || []).forEach(async (item) => {
      if (item.img_url) return;
      const imgUrl = await searchImageByName(item.name);
      if (imgUrl) {
        await supabase.from('items').update({ img_url: imgUrl }).eq('id', item.id);
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, img_url: imgUrl } : i));
      }
    });
  };

  // ── CHOICE ──────────────────────────────────────────────────────────────────
  const ADD_METHODS = [
    {
      id: 'barcode', Icon: Scan,
      title: 'Scanner code-barres', badge: 'GRATUIT',
      description: "Pointe vers le code-barres d'un produit pour l'ajouter automatiquement.",
      feature: 'Reconnaissance instantanée',
      color: C.green, iconBg: `${C.green}18`, badgeBg: `${C.green}18`, featureBg: `${C.green}12`,
      pro: false,
    },
    {
      id: 'photo', Icon: Camera,
      title: 'Photo des courses', badge: isPro ? 'RAPIDE' : 'PRO',
      description: "Prends en photo plusieurs produits à la fois depuis ton caddie ou ton plan de travail.",
      feature: isPro ? 'Identification multiple' : '✦ Fonctionnalité Pro',
      color: '#E6A23C', iconBg: '#FEF6E7', badgeBg: '#FEF3DC', featureBg: '#FEF6E7',
      pro: !isPro,
    },
    {
      id: 'receipt', Icon: FileText,
      title: 'Scan ticket de caisse', badge: isPro ? 'NOUVEAU' : 'PRO',
      description: "Prends en photo ton ticket de caisse pour extraire automatiquement les produits et les prix.",
      feature: isPro ? 'Produits et prix extraits' : '✦ Fonctionnalité Pro',
      color: '#8B5CF6', iconBg: '#F3EFFE', badgeBg: '#EDE9FE', featureBg: '#F3EFFE',
      pro: !isPro,
    },
  ];

  const handleMethodPress = (id) => {
    posthog.capture('scan_started', { method: id });
    if (id === 'barcode') { if (!permission?.granted) requestPermission(); setMode('scanner'); }
    else if (id === 'photo') { if (!isPro) { onPaywall?.(); return; } setMode('photo'); }
    else if (id === 'receipt') { if (!isPro) { onPaywall?.(); return; } setMode('receipt'); }
  };

  if (mode === 'choice') return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F9F8' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

        {/* Back button */}
        <View style={{ paddingTop: 16, marginBottom: 28 }}>
          <TouchableOpacity onPress={onClose}
            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,
              alignSelf: 'flex-start' }}>
            <ChevronLeft size={22} color={C.t1} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={{ fontSize: 30, fontWeight: '900', color: C.t1, letterSpacing: -1, marginBottom: 12, lineHeight: 36 }}>
          Ajouter des{'\n'}produits
        </Text>
        <Text style={{ fontSize: 16, color: '#6B7280', lineHeight: 25, marginBottom: 36 }}>
          Choisis la méthode la plus simple pour ajouter un ou plusieurs produits dans ton frigo.
        </Text>

        {/* Method cards */}
        {ADD_METHODS.map(m => (
          <TouchableOpacity key={m.id} onPress={() => handleMethodPress(m.id)}
            style={{ backgroundColor: '#fff', borderRadius: 28, padding: 22, marginBottom: 16,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 14 }}>
            <View style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>
              {/* Icon block */}
              <View style={{ width: 92, height: 92, borderRadius: 24, backgroundColor: m.iconBg,
                alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <m.Icon size={42} color={m.color} strokeWidth={1.6} />
              </View>
              {/* Content */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: C.t1 }}>{m.title}</Text>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: m.badgeBg, borderRadius: 999 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: m.color, letterSpacing: 0.5 }}>{m.badge}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={m.color} strokeWidth={2.5} style={{ marginLeft: 4 }} />
                </View>
                <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 20 }}>{m.description}</Text>
                {/* Feature badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
                  backgroundColor: m.featureBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}>
                  <CheckCircle2 size={15} color={m.color} strokeWidth={2.5} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: m.color }}>{m.feature}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Security footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
          backgroundColor: `${C.green}12`, borderRadius: 20, marginTop: 4 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${C.green}20`,
            alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={20} color={C.green} strokeWidth={2} />
          </View>
          <Text style={{ flex: 1, fontSize: 13, color: '#374151', lineHeight: 19 }}>
            Tes données sont sécurisées et traitées uniquement pour améliorer ton expérience.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );

  // ── DLC SCAN ─────────────────────────────────────────────────────────────────
  if (mode === 'dlcScan') return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView ref={dlcCamRef} style={{ flex: 1 }} facing="back" />
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20 }}>
          <TouchableOpacity onPress={() => setMode(dlcScanReturn)}
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode(dlcScanReturn)}
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Passer</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, marginBottom: 28, alignItems: 'center', gap: 6 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Scanner la date d'expiration</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {dlcCapturing
                ? <ActivityIndicator size="small" color={C.yellow} />
                : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />}
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                {dlcCapturing ? 'Analyse en cours…' : 'Recherche automatique'}
              </Text>
            </View>
          </View>
          <View style={{ width: 290, height: 90, borderRadius: 12, borderWidth: 2,
            borderColor: dlcCapturing ? C.yellow : 'rgba(255,255,255,0.85)' }} />
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 20, gap: 14 }}>
          <TouchableOpacity onPress={captureDlc} disabled={dlcCapturing}
            style={{ backgroundColor: C.yellow, padding: 16, borderRadius: 14, alignItems: 'center', opacity: dlcCapturing ? 0.6 : 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Capturer maintenant</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode(dlcScanReturn)} style={{ alignItems: 'center', paddingVertical: 4 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '600', fontSize: 14 }}>Saisir manuellement</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );

  // ── BARCODE SCANNER ───────────────────────────────────────────────────────────
  if (mode === 'scanner') {
    if (!permission?.granted) return (
      <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center', padding: 30 }]}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.t1, marginBottom: 12, textAlign: 'center' }}>
          Accès caméra requis
        </Text>
        <TouchableOpacity style={styles.greenBtn} onPress={requestPermission}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Autoriser</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );

    if (result) return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 30, fontWeight: '900', color: C.t1, letterSpacing: -1 }}>
            {result.source === 'Manuel' ? 'Produit non reconnu' : result.fromCache ? 'Produit reconnu ⚡' : 'Produit détecté ✅'}
          </Text>
        </View>
        <ScrollView style={{ padding: 16 }}>
          <View style={[styles.card, { padding: 20, alignItems: 'center', marginBottom: 16 }]}>
            {result.imgUrl && !imgError
              ? <Image source={{ uri: result.imgUrl }} style={{ width: 120, height: 120, borderRadius: 16, marginBottom: 12 }} resizeMode="contain" onError={handleScanImgError} />
              : <Text style={{ fontSize: 60, marginBottom: 12 }}>{result.emoji}</Text>
            }
            {result.source === 'Manuel' ? (
              <View style={{ width: '100%', marginBottom: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.t3, marginBottom: 8, textAlign: 'center' }}>
                  Code-barres non trouvé — entre le nom manuellement
                </Text>
                <TextInput
                  value={manualName}
                  onChangeText={setManualName}
                  placeholder="Nom du produit…"
                  placeholderTextColor={C.t4}
                  style={{ borderWidth: 1.5, borderColor: manualName ? C.green : C.border,
                    borderRadius: 12, padding: 13, fontSize: 16, color: C.t1,
                    backgroundColor: '#FAFAFA', textAlign: 'center' }}
                  autoFocus
                />
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 20, fontWeight: '700', color: C.t1, marginBottom: 4, textAlign: 'center' }}>{result.name}</Text>
                {result.brand && <Text style={{ fontSize: 14, color: C.t3, marginBottom: 8 }}>{result.brand}</Text>}
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {result.source !== 'Manuel' && (
                <View style={{ paddingHorizontal: 12, paddingVertical: 4, backgroundColor: `${C.green}15`, borderRadius: 100 }}>
                  <Text style={{ fontSize: 12, color: C.green, fontWeight: '600' }}>
                    {result.fromCache ? '⚡ Cache' : result.source === 'Spoonacular' ? '🥄 Spoonacular' : result.source === 'Merged' ? '🔀 Merged' : '🌐 OpenFoodFacts'}
                  </Text>
                </View>
              )}
              {result.nutri && (
                <View style={{ paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#34C75920', borderRadius: 100 }}>
                  <Text style={{ fontSize: 12, color: '#34C759', fontWeight: '600' }}>Nutri-Score {result.nutri}</Text>
                </View>
              )}
              {result.kcal && (
                <View style={{ paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#F0F0F0', borderRadius: 100 }}>
                  <Text style={{ fontSize: 12, color: C.t3 }}>{result.kcal} kcal/100g</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.card, { padding: 16, marginBottom: 12 }]}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.t3, marginBottom: 10 }}>DATE LIMITE (DLC)</Text>
            <TouchableOpacity onPress={() => openDlcScan('scanner')}
              style={{ backgroundColor: C.yellow, padding: 13, borderRadius: 12,
                alignItems: 'center', marginBottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <Camera size={16} color="#fff" strokeWidth={2.5} />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Scanner la date</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TextInput
                value={dlcInput}
                onChangeText={t => setDlcInput(formatDlcInput(t))}
                placeholder="ou saisir JJ/MM/AAAA"
                placeholderTextColor={C.t4}
                keyboardType="numeric"
                maxLength={10}
                style={{ flex: 1, backgroundColor: '#FAFAFA', borderWidth: 1.5,
                  borderColor: parseDlc(dlcInput) !== null ? C.green : C.border,
                  borderRadius: 10, padding: 11, fontSize: 15, color: C.t1 }}
              />
              {parseDlc(dlcInput) !== null && (
                <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: urgBg(parseDlc(dlcInput)), borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>J-{parseDlc(dlcInput)}</Text>
                </View>
              )}
            </View>
            {!dlcInput && <Text style={{ fontSize: 11, color: C.t3, marginTop: 6 }}>Optionnel — estimation auto sinon</Text>}
          </View>

          <View style={[styles.card, { padding: 16, marginBottom: 12 }]}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.t3, marginBottom: 12 }}>QUANTITÉ</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <TouchableOpacity onPress={() => setPackUnits(p => Math.max(1, p - 1))}
                style={{ width: 42, height: 42, borderRadius: 13,
                  backgroundColor: packUnits > 1 ? `${C.orange}20` : '#F0F0F0',
                  alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: packUnits > 1 ? C.orange : C.t4, lineHeight: 28 }}>−</Text>
              </TouchableOpacity>
              <View style={{ alignItems: 'center', minWidth: 60 }}>
                <Text style={{ fontSize: 32, fontWeight: '800', color: C.t1 }}>{packUnits}</Text>
                <Text style={{ fontSize: 10, color: C.t3 }}>{packUnits > 1 ? 'unités' : 'unité'}</Text>
              </View>
              <TouchableOpacity onPress={() => setPackUnits(p => Math.min(24, p + 1))}
                style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: `${C.green}20`, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: C.green, lineHeight: 28 }}>+</Text>
              </TouchableOpacity>
            </View>
            {packUnits > 1 && (
              <Text style={{ fontSize: 11, color: C.t3, textAlign: 'center', marginTop: 10 }}>
                Pack de {packUnits} — stock décrémentable depuis le frigo
              </Text>
            )}
          </View>

          <View style={[styles.card, { padding: 16, marginBottom: 12 }]}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.t3, marginBottom: 10 }}>OÙ LE RANGER ?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {LOC_ITEMS.map(l => (
                <TouchableOpacity key={l.id} onPress={() => setLocation(l.id)}
                  style={{ flex: 1, alignItems: 'center', padding: 10, borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: location === l.id ? C.green : C.border,
                    backgroundColor: location === l.id ? `${C.green}12` : C.card }}>
                  <l.Icon size={22} color={location === l.id ? C.green : C.t3} strokeWidth={location === l.id ? 2.5 : 1.8} style={{ marginBottom: 4 }} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: location === l.id ? C.green : C.t3 }}>{l.id}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.greenBtn} onPress={addProduct}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
              ✅ Ranger dans {location === 'Frigo' ? 'le frigo' : location === 'Congélateur' ? 'le congélateur' : 'le placard'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.greenBtn, { backgroundColor: 'transparent', marginTop: 10, flexDirection: 'row', gap: 6 }]}
            onPress={() => { setResult(null); setScanned(false); setDlcInput(''); setPackUnits(1); setManualName(''); }}>
            <ChevronLeft size={16} color={C.green} strokeWidth={2.5} />
            <Text style={{ color: C.green, fontWeight: '700', fontSize: 15 }}>Scanner un autre</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView style={{ flex: 1 }} facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarcode}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'qr'] }} />
        <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20 }}>
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: 'rgba(0,0,0,0.5)',
              width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {loading ? (
              <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', padding: 20, borderRadius: 16, alignItems: 'center' }}>
                <ActivityIndicator color={C.green} size="large" />
                <Text style={{ color: '#fff', marginTop: 10, fontWeight: '600' }}>Recherche OpenFoodFacts…</Text>
              </View>
            ) : (
              <View style={{ width: 260, height: 180, borderRadius: 20, borderWidth: 2,
                borderColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14, opacity: .7 }}>Pointe vers le code-barres</Text>
              </View>
            )}
          </View>
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>EAN-13 · EAN-8 · QR Code · Code128</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── RECEIPT ───────────────────────────────────────────────────────────────────
  if (mode === 'receipt') {
    if (receiptLoading) return (
      <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#8B5CF6" size="large" />
        <Text style={{ marginTop: 16, fontSize: 15, fontWeight: '600', color: C.t2 }}>Fridgy analyse ton ticket…</Text>
        <Text style={{ marginTop: 6, fontSize: 13, color: C.t3 }}>Extraction des produits et prix</Text>
      </SafeAreaView>
    );

    if (receiptData) return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 30, fontWeight: '900', color: C.t1, letterSpacing: -1, lineHeight: 36 }}>
                {receiptData.items.length} produit{receiptData.items.length > 1 ? 's' : ''}{'\n'}détecté{receiptData.items.length > 1 ? 's' : ''}
              </Text>
              {receiptData.store && (
                <Text style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>
                  {receiptData.store}{receiptData.total ? ` · ${receiptData.total.toFixed(2)} €` : ''}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setReceiptData(null)}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
                alignItems: 'center', justifyContent: 'center', marginTop: 4,
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 }}>
              <X size={18} color={C.t2} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text style={{ fontSize: 16 }}>✏️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#92610A' }}>Vérifiez avant d'ajouter</Text>
              <Text style={{ fontSize: 12, color: '#92610A', marginTop: 2, lineHeight: 17 }}>
                Les emplacements et DLC sont estimés automatiquement — ils peuvent être inexacts. Corrigez-les pour profiter à 100% des alertes et du tri par urgence.
              </Text>
            </View>
          </View>
          {receiptData.items.map(p => (
            <View key={p._id} style={[styles.card, { marginBottom: 10, padding: 14 }]}>

              {/* Row 1 : emoji + name + price + delete */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 28, marginRight: 10 }}>{p.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={p.name}
                    onChangeText={t => updateReceiptName(p._id, t)}
                    style={{ fontSize: 15, fontWeight: '700', color: C.t1,
                      borderBottomWidth: 1.5, borderBottomColor: '#8B5CF640', paddingBottom: 2 }}
                  />
                  {p.brand ? <Text style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>{p.brand}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6, marginLeft: 8 }}>
                  {p.unit_price != null && (
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#8B5CF618', borderRadius: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#8B5CF6' }}>{p.unit_price.toFixed(2)} €</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => removeReceiptItem(p._id)}
                    style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFF0F0',
                      alignItems: 'center', justifyContent: 'center' }}>
                    <X size={14} color="#FF3B30" strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 2 : quantité */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.t3, flex: 1 }}>QUANTITÉ</Text>
                <TouchableOpacity onPress={() => updateReceiptQuantity(p._id, -1)}
                  style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: (p.quantity || 1) > 1 ? '#8B5CF618' : '#F3F4F6',
                    alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: (p.quantity || 1) > 1 ? '#8B5CF6' : C.t4, lineHeight: 22 }}>−</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.t1, minWidth: 24, textAlign: 'center' }}>{p.quantity || 1}</Text>
                <TouchableOpacity onPress={() => updateReceiptQuantity(p._id, 1)}
                  style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#8B5CF618', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#8B5CF6', lineHeight: 22 }}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Row 3 : DLC */}
              <View style={{ backgroundColor: '#F8F9FA', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: C.t3, marginBottom: 6 }}>DATE LIMITE (DLC)</Text>
                <TouchableOpacity onPress={() => openDlcScan('receipt', p._id, true)}
                  style={{ backgroundColor: C.yellow, padding: 10, borderRadius: 10,
                    alignItems: 'center', marginBottom: 8, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                  <Camera size={14} color="#fff" strokeWidth={2.5} />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Scanner la date</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TextInput
                    value={p.dlcInput || ''}
                    onChangeText={t => updateReceiptDlc(p._id, t)}
                    placeholder="JJ/MM/AAAA"
                    placeholderTextColor={C.t4}
                    keyboardType="numeric"
                    maxLength={10}
                    style={{ flex: 1, backgroundColor: C.card, borderWidth: 1.5,
                      borderColor: parseDlc(p.dlcInput) !== null ? C.green : C.border,
                      borderRadius: 8, padding: 8, fontSize: 13, color: C.t1 }}
                  />
                  {parseDlc(p.dlcInput) !== null && (
                    <View style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFB800', borderRadius: 8 }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>J-{parseDlc(p.dlcInput)}</Text>
                    </View>
                  )}
                </View>
                {!p.dlcInput && (
                  <Text style={{ fontSize: 10, color: '#92610A', marginTop: 4 }}>
                    ⏱ Estimée : ~{p.days_left} j — vérifiez sur l'emballage
                  </Text>
                )}
              </View>

              {/* Row 4 : emplacement */}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {LOC_ITEMS.map(l => {
                  const active = p.location === l.id;
                  return (
                    <TouchableOpacity key={l.id} onPress={() => updateReceiptLocation(p._id, l.id)}
                      style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, borderWidth: 1.5,
                        borderColor: active ? '#8B5CF6' : C.border,
                        backgroundColor: active ? '#8B5CF615' : '#FAFAFA' }}>
                      <l.Icon size={16} color={active ? '#8B5CF6' : C.t3} strokeWidth={active ? 2.5 : 1.8} />
                      <Text style={{ fontSize: 9, fontWeight: '600', color: active ? '#8B5CF6' : C.t3, marginTop: 1 }}>{l.id}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

            </View>
          ))}

          <TouchableOpacity
            style={[styles.greenBtn, { marginTop: 4, marginBottom: 10, backgroundColor: '#8B5CF6' }]}
            onPress={saveReceiptProducts} disabled={receiptSaving || receiptData.items.length === 0}>
            {receiptSaving ? <ActivityIndicator color="#fff" /> :
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                ✅ Ajouter {receiptData.items.length} produit{receiptData.items.length > 1 ? 's' : ''} au stock
              </Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.greenBtn, { backgroundColor: 'transparent', marginBottom: 20, flexDirection: 'row', gap: 6 }]}
            onPress={() => setReceiptData(null)}>
            <ChevronLeft size={16} color="#8B5CF6" strokeWidth={2.5} />
            <Text style={{ color: '#8B5CF6', fontWeight: '700', fontSize: 15 }}>Scanner un autre ticket</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F9F8' }}>
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>

          {/* Header — title + close */}
          <View style={{ paddingTop: 16, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 28, gap: 16 }}>
            <Text style={{ flex: 1, fontSize: 30, fontWeight: '900', color: C.t1, letterSpacing: -1, lineHeight: 36 }}>
              {RECEIPT_SCREEN.title}
            </Text>
            <TouchableOpacity onPress={() => setMode('choice')}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff',
                alignItems: 'center', justifyContent: 'center', marginTop: 4,
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }}>
              <X size={20} color={C.t1} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Hero card */}
          <View style={{ backgroundColor: '#fff', borderRadius: 32, padding: 32, marginBottom: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 16 }}>

            {/* Receipt illustration */}
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <View style={{ width: 200, height: 170, alignItems: 'center', justifyContent: 'center' }}>
                {/* Circle */}
                <View style={{ width: 160, height: 160, borderRadius: 80, backgroundColor: '#EDE9FE',
                  alignItems: 'center', justifyContent: 'center' }}>
                  {/* Paper */}
                  <View style={{ backgroundColor: '#fff', width: 88, height: 110, borderRadius: 4,
                    paddingHorizontal: 9, paddingVertical: 8,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.13, shadowRadius: 6 }}>
                    <Text style={{ fontSize: 8, fontWeight: '900', color: '#111827', textAlign: 'center', letterSpacing: 1, marginBottom: 2 }}>RECEIPT</Text>
                    <View style={{ height: 1.5, backgroundColor: '#111827', marginBottom: 3 }} />
                    <Text style={{ fontSize: 6, color: '#6B7280', textAlign: 'center', marginBottom: 5 }}>JUL 17</Text>
                    {[['MISFITS..........', '0.00'], ['SQUARE', null], ['HOLES...........', '0.00'], ['ROUND', null], ['PEGS.............', '0.00']].map(([label, price], i) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1.5 }}>
                        <Text style={{ fontSize: 5.5, color: '#111827' }}>{label}</Text>
                        {price && <Text style={{ fontSize: 5.5, color: '#111827' }}>{price}</Text>}
                      </View>
                    ))}
                    <View style={{ height: 0.5, backgroundColor: '#E5E7EB', marginTop: 3, marginBottom: 2 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <Text style={{ fontSize: 6.5, fontWeight: '800', color: '#111827' }}>0.00</Text>
                    </View>
                  </View>
                </View>
                {/* Sparkle decorations */}
                <View style={{ position: 'absolute', top: 10, right: 16 }}>
                  <Sparkles size={17} color="#8B5CF6" strokeWidth={1.8} />
                </View>
                <View style={{ position: 'absolute', top: 26, right: 4 }}>
                  <Sparkles size={11} color="#8B5CF680" strokeWidth={1.8} />
                </View>
                <View style={{ position: 'absolute', bottom: 20, left: 12 }}>
                  <Sparkles size={13} color="#8B5CF660" strokeWidth={1.8} />
                </View>
              </View>
            </View>

            <Text style={{ fontSize: 22, fontWeight: '800', color: C.t1, textAlign: 'center', marginBottom: 10 }}>
              {RECEIPT_SCREEN.hero.title}
            </Text>
            <Text style={{ fontSize: 16, color: '#6B7280', textAlign: 'center', lineHeight: 24, paddingHorizontal: 8 }}>
              {RECEIPT_SCREEN.hero.description}
            </Text>
          </View>

          {/* Action cards */}
          {RECEIPT_SCREEN.actions.map(a => (
            <TouchableOpacity key={a.id} onPress={() => launchReceipt(a.fromCamera)}
              style={{ backgroundColor: '#fff', borderRadius: 28, paddingVertical: 22, paddingHorizontal: 20,
                marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 16,
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12 }}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#EDE9FE',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {a.id === 'camera'
                  ? <Camera size={24} color="#8B5CF6" strokeWidth={1.8} />
                  : <RefreshCw size={24} color="#8B5CF6" strokeWidth={1.8} />}
              </View>
              <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: C.t1 }}>{a.title}</Text>
              <ChevronRight size={20} color="#8B5CF6" strokeWidth={2.5} />
            </TouchableOpacity>
          ))}

          {/* Security footer */}
          <View style={{ backgroundColor: '#EDE9FE', borderRadius: 24, padding: 20,
            flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#8B5CF625',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={22} color="#8B5CF6" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#6D28D9', marginBottom: 2 }}>{RECEIPT_SCREEN.security.title}</Text>
              <Text style={{ fontSize: 13, color: '#7C3AED' }}>{RECEIPT_SCREEN.security.description}</Text>
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── PHOTO ─────────────────────────────────────────────────────────────────────
  if (mode === 'photo') {
    if (photoLoading) return (
      <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={C.green} size="large" />
        <Text style={{ marginTop: 16, fontSize: 15, fontWeight: '600', color: C.t2 }}>Fridgy analyse ta photo…</Text>
        <Text style={{ marginTop: 6, fontSize: 13, color: C.t3 }}>Ça prend 5 à 10 secondes</Text>
      </SafeAreaView>
    );

    if (detectedProducts) return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.bg }]}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 30, fontWeight: '900', color: C.t1, letterSpacing: -1, lineHeight: 36 }}>
            {detectedProducts.length} produit{detectedProducts.length > 1 ? 's' : ''}{'\n'}détecté{detectedProducts.length > 1 ? 's' : ''}
          </Text>
          <TouchableOpacity onPress={() => setDetectedProducts(null)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
              alignItems: 'center', justifyContent: 'center', marginTop: 4,
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 }}>
            <X size={18} color={C.t2} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
          {detectedProducts.map(p => {
            const sel = selectedIds.includes(p._id);
            return (
              <View key={p._id} style={[styles.card, { marginBottom: 8, padding: 12, opacity: sel ? 1 : 0.45 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: sel ? 10 : 0 }}>
                  <TouchableOpacity onPress={() => setSelectedIds(prev =>
                    sel ? prev.filter(x => x !== p._id) : [...prev, p._id]
                  )} style={{ marginRight: 10 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2,
                      borderColor: sel ? C.green : C.t4,
                      backgroundColor: sel ? C.green : 'transparent',
                      alignItems: 'center', justifyContent: 'center' }}>
                      {sel && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 28, marginRight: 10 }}>{p.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {sel ? (
                        <TextInput
                          value={p.name}
                          onChangeText={t => updateProductName(p._id, t)}
                          style={{ fontSize: 15, fontWeight: '700', color: C.t1, borderBottomWidth: 1.5,
                            borderBottomColor: C.green, paddingBottom: 2, paddingTop: 0, flex: 1 }}
                        />
                      ) : (
                        <Text style={styles.productName}>{p.name}</Text>
                      )}
                      {(p.quantity || 1) > 1 && (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: `${C.green}18`, borderRadius: 8 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: C.green }}>×{p.quantity}</Text>
                        </View>
                      )}
                    </View>
                    {p.brand && <Text style={styles.productSub}>{p.brand}</Text>}
                  </View>
                </View>
                {sel && (
                  <>
                    {/* Quantité */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: C.t3, flex: 1 }}>QUANTITÉ</Text>
                      <TouchableOpacity onPress={() => updateProductQuantity(p._id, -1)}
                        style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: (p.quantity || 1) > 1 ? `${C.green}18` : '#F3F4F6',
                          alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: (p.quantity || 1) > 1 ? C.green : C.t4, lineHeight: 22 }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: C.t1, minWidth: 24, textAlign: 'center' }}>{p.quantity || 1}</Text>
                      <TouchableOpacity onPress={() => updateProductQuantity(p._id, 1)}
                        style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: `${C.green}18`, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: C.green, lineHeight: 22 }}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ backgroundColor: '#F8F9FA', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: C.t3, marginBottom: 6 }}>DATE LIMITE (DLC)</Text>
                      <TouchableOpacity onPress={() => openDlcScan('photo', p._id)}
                        style={{ backgroundColor: C.yellow, padding: 10, borderRadius: 10,
                          alignItems: 'center', marginBottom: 8, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                        <Camera size={14} color="#fff" strokeWidth={2.5} />
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Scanner la date</Text>
                      </TouchableOpacity>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TextInput
                          value={p.dlcInput || ''}
                          onChangeText={t => updateProductDlc(p._id, t)}
                          placeholder={p.dlc || 'JJ/MM/AAAA'}
                          placeholderTextColor={p.dlc ? C.green : C.t4}
                          keyboardType="numeric"
                          maxLength={10}
                          style={{ flex: 1, backgroundColor: C.card, borderWidth: 1.5,
                            borderColor: parseDlc(p.dlcInput) !== null ? C.green : C.border,
                            borderRadius: 8, padding: 8, fontSize: 13, color: C.t1 }}
                        />
                        {parseDlc(p.dlcInput) !== null && (
                          <View style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFB800', borderRadius: 8 }}>
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>J-{parseDlc(p.dlcInput)}</Text>
                          </View>
                        )}
                      </View>
                      {!p.dlcInput && p.dlc && (
                        <Text style={{ fontSize: 10, color: C.green, marginTop: 4 }}>IA a détecté : {p.dlc} — tape pour corriger</Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {LOC_ITEMS.map(l => {
                        const active = p.location === l.id;
                        return (
                          <TouchableOpacity key={l.id} onPress={() => updateProductLocation(p._id, l.id)}
                            style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8, borderWidth: 1.5,
                              borderColor: active ? C.green : C.border,
                              backgroundColor: active ? `${C.green}12` : '#FAFAFA' }}>
                            <l.Icon size={16} color={active ? C.green : C.t3} strokeWidth={active ? 2.5 : 1.8} />
                            <Text style={{ fontSize: 9, fontWeight: '600', color: active ? C.green : C.t3, marginTop: 1 }}>{l.id}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            );
          })}
          <TouchableOpacity style={[styles.greenBtn, { marginTop: 4, marginBottom: 10 }]}
            onPress={savePhotoProducts} disabled={saving || selectedIds.length === 0}>
            {saving ? <ActivityIndicator color="#fff" /> :
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                ✅ Ranger {selectedIds.length} produit{selectedIds.length > 1 ? 's' : ''}
              </Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.greenBtn, { backgroundColor: 'transparent', marginBottom: 20, flexDirection: 'row', gap: 6 }]}
            onPress={() => setDetectedProducts(null)}>
            <ChevronLeft size={16} color={C.green} strokeWidth={2.5} />
            <Text style={{ color: C.green, fontWeight: '700', fontSize: 15 }}>Reprendre une photo</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F9F8' }}>
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>

          {/* Header */}
          <View style={{ paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 }}>
            <TouchableOpacity onPress={() => setMode('choice')}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }}>
              <ChevronLeft size={22} color={C.t1} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }}>
              <X size={20} color={C.t1} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 30, fontWeight: '900', color: C.t1, letterSpacing: -1, marginBottom: 12, lineHeight: 36 }}>
            {PHOTO_SCREEN.title}
          </Text>
          <Text style={{ fontSize: 16, color: '#6B7280', lineHeight: 26, marginBottom: 36 }}>
            {PHOTO_SCREEN.subtitle}
          </Text>

          {/* Method cards */}
          {PHOTO_METHODS_CONFIG.map(m => (
            <TouchableOpacity key={m.id} onPress={() => launchPhoto(m.fromCamera)}
              style={{ backgroundColor: '#fff', borderRadius: 30, padding: 24, marginBottom: 16,
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 16 }}>
              <View style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>
                <View style={{ width: 96, height: 96, borderRadius: 24, backgroundColor: m.iconBg,
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {m.id === 'camera'
                    ? <Camera size={40} color={m.color} strokeWidth={1.6} />
                    : <ImageIcon size={40} color={m.color} strokeWidth={1.6} />}
                </View>
                <View style={{ flex: 1, paddingTop: 2 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: C.t1, marginBottom: 6 }}>{m.title}</Text>
                  <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 21, marginBottom: 14 }}>{m.description}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: m.badgeBg,
                    borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start', gap: 8 }}>
                    <CheckCircle2 size={16} color={m.color} strokeWidth={2.5} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: m.color }}>{m.feature}</Text>
                  </View>
                </View>
                <ChevronRight size={20} color={m.color} strokeWidth={2.5} style={{ marginTop: 38 }} />
              </View>
            </TouchableOpacity>
          ))}

          {/* AI info block */}
          <View style={{ backgroundColor: '#EAF8EE', borderRadius: 24, padding: 20,
            flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#C7F0D4',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Lightbulb size={22} color="#16834A" strokeWidth={2} />
            </View>
            <Text style={{ flex: 1, fontSize: 14, color: '#16834A', lineHeight: 22 }}>
              {PHOTO_SCREEN.aiInfo}
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

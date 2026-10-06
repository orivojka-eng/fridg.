import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Camera as CameraIcon, RotateCcw } from '../src/components/ui/lucide';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFridgeStore } from '../src/store/useFridgeStore';
import { useTheme, font, fs, s, motion } from '../src/theme';
import { IconButton, Button, PressableScale, FoodIcon } from '../src/components/ui';
import { FridgeCategory } from '../src/types';
import { plural } from '../src/lib/matching';
import { env } from '../src/config/env';
import { fridgeApi, type ScanCandidate } from '../src/api/fridge';
import { errorMessage, isApiError } from '../src/api/client';
import { PermissionPrimer } from '../src/components/PermissionPrimer';

interface Detection {
  name: string;
  category: FridgeCategory;
  quantity: string;
  quantityValue: number;
  unit: string;
  confidence: number;
  daysToExpiry: number;
}

/** Simulated vision output for the prototype (backend off). */
const DETECTION_POOL: Detection[] = [
  { name: 'Red peppers', category: 'Veg', quantity: '3 pcs', quantityValue: 3, unit: 'pcs', confidence: 0.94, daysToExpiry: 5 },
  { name: 'Eggs', category: 'Protein', quantity: '6 pcs', quantityValue: 6, unit: 'pcs', confidence: 0.91, daysToExpiry: 12 },
  { name: 'Greek yoghurt', category: 'Dairy', quantity: '500 g', quantityValue: 500, unit: 'g', confidence: 0.88, daysToExpiry: 6 },
  { name: 'Spinach', category: 'Veg', quantity: '180 g', quantityValue: 180, unit: 'g', confidence: 0.82, daysToExpiry: 3 },
  { name: 'Halloumi', category: 'Dairy', quantity: '225 g', quantityValue: 225, unit: 'g', confidence: 0.71, daysToExpiry: 10 },
  { name: 'Courgette', category: 'Veg', quantity: '2 pcs', quantityValue: 2, unit: 'pcs', confidence: 0.55, daysToExpiry: 6 },
];

const fmtQty = (q: number, unit: string) => `${Number.isInteger(q) ? q : q.toFixed(1)} ${unit}`.trim();

const fromCandidate = (c: ScanCandidate): Detection => ({ name: c.name, category: c.category, quantity: fmtQty(c.quantity, c.unit), quantityValue: c.quantity, unit: c.unit, confidence: c.confidence, daysToExpiry: c.daysToExpiry });

type Phase = 'ready' | 'scanning' | 'done';

/**
 * Camera, a close button, and one sheet: scan → items found (with confidence,
 * low-confidence ones unselected) → add. Nothing reaches the fridge until the
 * user taps Add; the photo is deleted server-side within 24 h.
 */
export default function ScanScreen() {
  const router = useRouter();
  const t = useTheme();
  const addMultipleItems = useFridgeStore((u) => u.addMultipleItems);
  const hydrateFridge = useFridgeStore((u) => u.hydrate);
  const markScanned = useFridgeStore((u) => u.markScanned);
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const real = env.USE_BACKEND;
  const [phase, setPhase] = useState<Phase>(real ? 'ready' : 'scanning');
  const [found, setFound] = useState<Detection[]>([]);
  const [off, setOff] = useState<string[]>([]);
  const [scanId, setScanId] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const sheet = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const done = phase === 'done';

  const canUseCamera = Platform.OS !== 'web' && !!permission?.granted;

  const [cameraPrimer, setCameraPrimer] = useState(false);
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) setCameraPrimer(true);
  }, [permission]);

  useEffect(() => {
    Animated.timing(sheet, { toValue: 1, duration: motion.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [sheet]);

  // Prototype: simulated detections stream in.
  useEffect(() => {
    if (real) return;
    const picks = [...DETECTION_POOL].sort(() => Math.random() - 0.5).slice(0, 4);
    const timers = picks.map((d, i) => setTimeout(() => setFound((prev) => [...prev, d]), 1100 + i * 450));
    const finish = setTimeout(() => setPhase('done'), 1100 + picks.length * 450 + 200);
    Animated.timing(bar, { toValue: 1, duration: 1100 + picks.length * 450 + 200, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [real, bar]);

  /** Backend: capture → (signed upload | inline) → vision → candidates. */
  const scanNow = async () => {
    if (phase === 'scanning') return;
    setPhase('scanning');
    setFound([]);
    setOff([]);
    bar.setValue(0);
    Animated.timing(bar, { toValue: 0.85, duration: 9000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    try {
      if (!canUseCamera || !cameraRef.current) throw new Error('Camera access is needed to scan. Enable it in Settings, or add items manually.');
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.45, base64: true, skipProcessing: true });
      if (!photo?.base64) throw new Error('Could not capture a photo. Try again.');
      let payload: { imageKey?: string; imageBase64?: string } = { imageBase64: photo.base64 };
      const { upload } = await fridgeApi.uploadUrl('jpg');
      if (upload) {
        const blob = await (await fetch(photo.uri)).blob();
        const put = await fetch(upload.url, { method: 'PUT', body: blob, headers: { 'content-type': upload.contentType } });
        if (put.ok) payload = { imageKey: upload.key };
      }
      const res = await fridgeApi.scan(payload);
      Animated.timing(bar, { toValue: 1, duration: 300, useNativeDriver: false }).start();
      setScanId(res.scanId);
      const items = res.items.map(fromCandidate);
      setFound(items);
      setOff(res.items.filter((c) => !c.suggested).map((c) => c.name));
      setPhase('done');
      if (!res.isFood) Alert.alert('No food spotted', res.sceneNote ?? 'Point the camera at your fridge shelves or groceries and try again.');
    } catch (e) {
      setPhase('ready');
      bar.setValue(0);
      const premium = isApiError(e) && (e.code === 'PREMIUM_REQUIRED' || e.code === 'QUOTA_EXCEEDED');
      Alert.alert(premium ? 'Scan limit reached' : 'Scan failed', errorMessage(e), premium ? [{ text: 'Not now', style: 'cancel' }, { text: 'See Premium', onPress: () => router.push('/premium') }] : undefined);
    }
  };

  const selected = useMemo(() => found.filter((d) => !off.includes(d.name)), [found, off]);
  const toggle = (name: string) => setOff((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const add = async () => {
    if (adding) return;
    setAdding(true);
    try {
      if (real) {
        const res = await fridgeApi.confirmScan(scanId, selected.map((d) => ({ name: d.name, category: d.category, quantity: d.quantityValue, unit: d.unit, daysToExpiry: d.daysToExpiry, confidence: d.confidence })));
        await hydrateFridge();
        markScanned();
        router.replace(`/fridge?added=${res.added}&merged=${res.merged}`);
        return;
      }
      const { added, merged } = addMultipleItems(selected.map((d) => ({ name: d.name, category: d.category, quantity: d.quantity, daysToExpiry: d.daysToExpiry, addedVia: 'scan', scanConfidence: d.confidence })));
      markScanned();
      router.replace(`/fridge?added=${added}&merged=${merged}`);
    } catch (e) {
      Alert.alert('Could not add', errorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const title = phase === 'ready' ? 'Point at your fridge' : phase === 'scanning' ? 'Scanning your fridge' : `${plural(found.length, 'item')} found`;

  return (
    <View style={[styles.container, { backgroundColor: t.black }]}>
      {canUseCamera ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setCameraReady(true)} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: t.dark }]} />}

      <PermissionPrimer
        kind="camera"
        visible={cameraPrimer}
        onAllow={() => {
          setCameraPrimer(false);
          requestPermission();
        }}
        onNotNow={() => {
          setCameraPrimer(false);
          if (real) close();
        }}
      />
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <IconButton dark onPress={close}>
          <X size={20} color="#FFFFFF" />
        </IconButton>
      </View>

      {!canUseCamera && permission?.granted === false && (
        <Text style={styles.hint}>{real ? 'Camera access is off — enable it in Settings to scan.' : 'Camera access is off — showing demo detection.'}</Text>
      )}

      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 18, backgroundColor: t.dark, opacity: sheet, transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {phase === 'scanning' && <ActivityIndicator color={t.lime} size="small" />}
          {done && real && (
            <PressableScale onPress={scanNow} hitSlop={8}>
              <RotateCcw size={18} color="rgba(255,255,255,0.7)" />
            </PressableScale>
          )}
        </View>
        {phase === 'scanning' && (
          <View style={styles.track}>
            <Animated.View style={[styles.barFill, { backgroundColor: t.lime, width: bar.interpolate({ inputRange: [0, 1], outputRange: ['6%', '100%'] }) }]} />
          </View>
        )}

        {phase === 'ready' ? (
          <Text style={styles.ready}>Fill the frame with a shelf or your groceries. You will confirm every item before it is added.</Text>
        ) : (
          <View style={styles.chips}>
            {found.map((d) => {
              const on = !off.includes(d.name);
              const unsure = d.confidence < 0.6;
              return (
                <PressableScale key={d.name} onPress={() => toggle(d.name)} scaleTo={0.94} highlight radius={18}>
                  <View style={[styles.chip, { backgroundColor: on ? t.lime : 'rgba(255,255,255,0.08)', borderColor: on ? t.lime : unsure ? 'rgba(255,180,80,0.5)' : 'rgba(255,255,255,0.16)' }]}>
                    <FoodIcon name={d.name} category={d.category} size={14} color={on ? t.onLime : 'rgba(255,255,255,0.6)'} />
                    <Text style={[styles.chipText, { color: on ? t.onLime : 'rgba(255,255,255,0.6)' }]}>{d.name}</Text>
                    {real && <Text style={[styles.conf, { color: on ? 'rgba(20,24,15,0.6)' : 'rgba(255,255,255,0.45)' }]}>{unsure ? '?' : `${Math.round(d.confidence * 100)}%`}</Text>}
                  </View>
                </PressableScale>
              );
            })}
          </View>
        )}

        {phase === 'ready' ? (
          <Button label={cameraReady || !canUseCamera ? 'Scan now' : 'Starting camera…'} onPress={scanNow} disabled={canUseCamera && !cameraReady} left={<CameraIcon size={16} color={t.onLime} />} />
        ) : (
          <Button label={selected.length === 0 ? (done ? 'Nothing selected' : 'Looking…') : `Add ${selected.length} to fridge`} onPress={add} disabled={!done || selected.length === 0} loading={adding} />
        )}
        <PressableScale onPress={() => router.push('/fridge/add-manual')} hitSlop={8} style={{ alignSelf: 'center' }}>
          <Text style={[styles.manual, { color: t.textMuted }]}>Add manually instead</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { position: 'absolute', left: 20, zIndex: 2 },
  hint: { position: 'absolute', top: 120, left: 30, right: 30, color: 'rgba(255,255,255,0.75)', fontSize: fs(13), textAlign: 'center' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 14 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: fs(20), color: '#FFFFFF', fontFamily: font.display },
  ready: { color: 'rgba(255,255,255,0.7)', fontSize: fs(13), lineHeight: fs(19) },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 36 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  chipText: { fontSize: fs(13), fontWeight: '700' },
  conf: { fontSize: fs(10), fontWeight: '800' },
  manual: { fontSize: fs(13), fontWeight: '600' },
});

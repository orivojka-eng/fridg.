import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { Camera, BellRing, Image as ImageIcon, Video, LucideIcon } from './ui/lucide';
import { useTheme, fs, font, s, colors } from '../theme';
import { Button, GlassSurface } from './ui';
import { Mascot } from './Mascot';

export type PermissionKind = 'camera' | 'notifications' | 'photos' | 'media';

const COPY: Record<PermissionKind, { icon: LucideIcon; title: string; body: string; bullets: string[]; cta: string }> = {
  camera: {
    icon: Camera,
    title: 'FRIDGR would like to use the camera',
    body: 'To recognise the food in your fridge so it can suggest recipes.',
    bullets: ['Photos are used only to detect food', 'You confirm every item before it is added', 'Photos are deleted within 24 hours'],
    cta: 'Allow camera',
  },
  notifications: {
    icon: BellRing,
    title: 'Get a nudge before food goes off',
    body: 'A short reminder two days before something in your fridge expires, plus your weekly plan when it is ready.',
    bullets: ['Only the reminders you turn on', 'Never marketing', 'Change any time in Preferences'],
    cta: 'Turn on reminders',
  },
  media: {
    icon: Video,
    title: 'Pick the saved video or screenshots',
    body: 'FRIDGR watches the clip (or reads the screenshots) and writes out the full recipe.',
    bullets: ['Only the files you pick are uploaded', 'They are deleted as soon as the recipe is ready', 'Nothing else in your library is read'],
    cta: 'Choose from library',
  },
  photos: {
    icon: ImageIcon,
    title: 'Choose a photo from your library',
    body: 'To add a cover picture to a recipe you create.',
    bullets: ['Only the photo you pick is uploaded', 'Nothing else in your library is read'],
    cta: 'Choose photo',
  },
};

interface Props {
  kind: PermissionKind;
  visible: boolean;
  /** The system prompt is requested right after this. */
  onAllow: () => void;
  onNotNow: () => void;
}

/**
 * Explains why a permission is needed *before* the iOS/Android system prompt
 * (App Store guideline 5.1.1: purpose strings and context). The system
 * dialog can only be shown once, so this screen makes sure the user says
 * yes for the right reason.
 */
export const PermissionPrimer: React.FC<Props> = ({ kind, visible, onAllow, onNotNow }) => {
  const t = useTheme();
  const c = COPY[kind];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNotNow}>
      <View style={styles.backdrop}>
        <GlassSurface tone="light" radius={28} style={{ width: '100%' }}>
          <View style={styles.card}>
            <View style={styles.top}>
              <View style={[styles.iconWrap, { backgroundColor: t.lime }]}>
                <c.icon size={s(26)} color={t.onLime} />
              </View>
              <Mascot size={s(64)} float />
            </View>
            <Text style={[styles.title, { color: t.textStrong }]}>{c.title}</Text>
            <Text style={[styles.body, { color: t.text }]}>{c.body}</Text>
            <View style={{ gap: 6 }}>
              {c.bullets.map((b) => (
                <View key={b} style={styles.bullet}>
                  <View style={[styles.dot, { backgroundColor: t.lime }]} />
                  <Text style={[styles.bulletText, { color: t.text }]}>{b}</Text>
                </View>
              ))}
            </View>
            <Button label={c.cta} onPress={onAllow} />
            <Button label="Not now" variant="ghost" onPress={onNotNow} />
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,13,10,0.55)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { alignSelf: 'stretch', padding: 22, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: { width: s(52), height: s(52), borderRadius: s(18), alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.display, fontSize: fs(22), lineHeight: fs(27) },
  body: { fontSize: fs(14), lineHeight: fs(20) },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  bulletText: { fontSize: fs(13), fontWeight: '600', flex: 1 },
  legal: { color: colors.mutedGray },
});

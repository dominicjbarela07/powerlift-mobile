import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardModal as Modal } from '@/components/keyboard/KeyboardSurface';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies, SLRadius } from '@/constants/theme';
import type { SetVideoDraft } from '@/lib/set-video-upload-status';

/** Local-only playback. Mount only while previewing; the hook releases on unmount. */
export function SelectedSetVideoPreview({ video, onClose }: { video: SetVideoDraft; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(video.uri, instance => {
    instance.loop = false;
    instance.staysActiveInBackground = false;
    instance.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const close = () => {
    player.pause();
    onClose();
  };

  return <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
    <View style={[s.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={s.header}>
        <View style={s.heading}><Text style={s.kicker}>VIDEO PREVIEW</Text><Text numberOfLines={1} style={s.filename}>{video.name}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close video preview" onPress={close} style={({ pressed }) => [s.close, pressed && s.pressed]}><Ionicons name="close" size={25} color={SLColors.text} /></Pressable>
      </View>
      <View style={s.frame}>
        <VideoView player={player} style={s.video} nativeControls contentFit="contain" />
        {status === 'loading' ? <View pointerEvents="none" style={s.overlay}><ActivityIndicator color={SLColors.accentViolet} size="large" /></View> : null}
        {status === 'error' ? <View style={s.overlay}><Text style={s.error}>Could not preview this video.</Text><Text style={s.detail}>Go back to choose another clip.</Text></View> : null}
      </View>
      <View style={s.footer}>
        <Text style={s.detail}>Not uploaded yet</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to set" onPress={close} style={({ pressed }) => [s.back, pressed && s.pressed]}><Text style={s.backText}>Back to set</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SLColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  heading: { flex: 1, gap: 5 }, kicker: { color: SLColors.accentViolet, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 12, letterSpacing: 1.5 },
  filename: { color: SLColors.textSecondary, fontFamily: SLFontFamilies.body, fontSize: 13 },
  close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  frame: { flex: 1, backgroundColor: '#000' }, video: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: SLColors.background, gap: 8 },
  error: { color: SLColors.text, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 18, textAlign: 'center' },
  detail: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 13, textAlign: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
  back: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.md, backgroundColor: SLColors.accentViolet },
  backText: { color: SLColors.background, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 16 },
  pressed: { opacity: 0.65 },
});

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/sl-text';
import { SLColors, SLFontFamilies, SLRadius } from '@/constants/theme';
import { videoUploadPresentation, type SetVideoDraft } from '@/lib/set-video-upload-status';
import type { QueuedVideoUploadJob } from '@/lib/videoUploadQueue';
import { SelectedSetVideoPreview } from './selected-set-video-preview';

export function SetEntryVideo({ video, onPick, onChange, onRemove, allowCoachReview, disabled }: {
  video?: SetVideoDraft | null; onPick: () => Promise<void>; onChange: (video: SetVideoDraft) => void;
  onRemove: () => void; allowCoachReview: boolean; disabled?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const busy = disabled || picking;
  const pick = async () => {
    if (busy) return;
    setPicking(true);
    try { await onPick(); } catch (error: any) { Alert.alert('Could not select video', error?.message || 'Try selecting the video again.'); }
    finally { setPicking(false); }
  };
  return <View style={s.entry}>
    <View style={s.row}>
      {video ? <Pressable accessibilityRole="button" accessibilityLabel="Play selected video preview" disabled={busy} onPress={() => setPreviewUri(video.uri)} style={({ pressed }) => [s.previewThumbnail, pressed && s.pressed]}>
        {video.thumbnailUri ? <Image source={{ uri: video.thumbnailUri }} style={s.thumbnail} /> : null}
        <View style={s.playBadge}><Ionicons name="play" size={17} color={SLColors.text} /></View>
      </Pressable> : <Ionicons name="videocam-outline" size={22} color={SLColors.accentViolet} />}
      <Pressable accessibilityRole="button" accessibilityLabel={video ? 'Preview selected set video' : 'Add video to this set'} disabled={busy} onPress={video ? () => setPreviewUri(video.uri) : pick} style={({ pressed }) => [s.copy, pressed && s.pressed, busy && s.disabled]}>
        <Text style={s.title}>{picking ? 'Selecting video…' : video ? 'Preview video' : 'Add video'}</Text>
        {video ? <Text numberOfLines={1} style={s.detail}>{video.name}</Text> : null}
      </Pressable>
      {picking ? <ActivityIndicator color={SLColors.accentViolet} /> : video ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose a different set video" disabled={busy} onPress={pick} style={({ pressed }) => [s.action, pressed && s.pressed]}><Text style={s.change}>Change</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove selected video" disabled={busy} onPress={onRemove} style={({ pressed }) => [s.action, pressed && s.pressed]}><Ionicons name="close" size={21} color={SLColors.textSecondary} /></Pressable>
      </> : <Pressable accessibilityRole="button" accessibilityLabel="Choose set video" disabled={busy} onPress={pick} style={({ pressed }) => [s.action, pressed && s.pressed]}><Ionicons name="add" size={22} color={SLColors.accentViolet} /></Pressable>}
    </View>
    {video ? <>
      <Text style={s.detail}>Uploads after you save this set.</Text>
      {allowCoachReview ? <View style={s.intents}>{[false, true].map(review => <Pressable key={String(review)} accessibilityRole="button" accessibilityState={{ selected: (video.submitForReview !== false) === review }} disabled={busy} onPress={() => onChange({ ...video, submitForReview: review })} style={[s.intent, (video.submitForReview !== false) === review && s.selected]}><Text style={[s.detail, (video.submitForReview !== false) === review && s.selectedText]}>{review ? 'Coach review' : 'Archive only'}</Text></Pressable>)}</View> : null}
    </> : null}
    {video && previewUri === video.uri ? <SelectedSetVideoPreview video={video} onClose={() => setPreviewUri(null)} /> : null}
  </View>;
}

export function SessionVideoUploadStatus({ job, onView, onRetry }: {
  job?: QueuedVideoUploadJob | null; onView: (id: number) => void; onRetry: (id: string) => void;
}) {
  if (!job || job.status === 'cancelled') return null;
  const status = videoUploadPresentation(job);
  const color = status.tone === 'success' ? SLColors.success : status.tone === 'error' ? SLColors.danger : SLColors.accentCyanMuted;
  return <View accessibilityLiveRegion="polite" style={s.notice}>
    {status.tone === 'pending' ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={status.tone === 'success' ? 'checkmark-circle' : 'alert-circle-outline'} size={20} color={color} />}
    <Text style={[s.noticeText, { color }]}>{status.label}</Text>
    {status.action ? <Pressable accessibilityRole="button" accessibilityLabel={status.action === 'View' ? 'View uploaded set video' : 'Retry set video upload'} onPress={() => status.action === 'View' ? onView(Number(job.serverAttachmentId)) : onRetry(job.id)} style={s.action}><Text style={[s.title, { color }]}>{status.action}</Text></Pressable> : null}
  </View>;
}

const s = StyleSheet.create({
  entry: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderStandard, paddingTop: 10, gap: 5, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }, copy: { flex: 1, justifyContent: 'center', minHeight: 44 },
  title: { color: SLColors.accentViolet, fontFamily: SLFontFamilies.bodySemiBold, fontSize: 15 }, detail: { color: SLColors.textMuted, fontFamily: SLFontFamilies.body, fontSize: 12 },
  action: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, thumbnail: { width: 44, height: 44, borderRadius: SLRadius.sm },
  previewThumbnail: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: SLRadius.sm, overflow: 'hidden', backgroundColor: SLColors.surfaceSelected },
  playBadge: { position: 'absolute', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)' },
  change: { color: SLColors.accentViolet, fontFamily: SLFontFamilies.bodyMedium, fontSize: 12 }, pressed: { opacity: 0.65 }, disabled: { opacity: 0.5 },
  intents: { flexDirection: 'row', gap: 8 }, intent: { paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', borderRadius: SLRadius.sm, borderWidth: 1, borderColor: SLColors.borderSubtle },
  selected: { borderColor: SLColors.accentViolet, backgroundColor: SLColors.surfaceSelected }, selectedText: { color: SLColors.accentViolet },
  notice: { flexDirection: 'row', gap: 9, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: SLColors.borderSubtle, marginBottom: 8, minHeight: 44 },
  noticeText: { flex: 1, fontFamily: SLFontFamilies.bodyMedium, fontSize: 13 },
});

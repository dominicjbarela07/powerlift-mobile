import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@/components/ui/sl-text';

import { MessengerAttachment, getAttachmentDownloadUrl } from '@/lib/api';
import { SLColors, SLRadius, SLTypography } from '@/constants/theme';

export function MessageImageAttachment({
  attachment,
  mine,
  onError,
}: {
  attachment: MessengerAttachment;
  mine: boolean;
  onError: (message: string) => void;
}) {
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [loading, setLoading] = useState(!!attachment.id);
  const [failed, setFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDownloadUrl() {
      if (!attachment.id) {
        setLoading(false);
        setFailed(true);
        return;
      }

      setLoading(true);
      setFailed(false);

      try {
        const res = await getAttachmentDownloadUrl(Number(attachment.id));
        if (!active) return;
        if (!res.ok || !res.download_url) {
          throw new Error(res.error || 'Image could not be loaded.');
        }
        setDownloadUrl(res.download_url);
      } catch (err: any) {
        if (!active) return;
        setFailed(true);
        onError(err?.message || 'Image could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDownloadUrl();

    return () => {
      active = false;
    };
  }, [attachment.id, onError]);

  const openImage = () => {
    if (!downloadUrl) return;
    setPreviewOpen(true);
  };

  return (
    <>
      <Pressable
        disabled={!downloadUrl}
        onPress={openImage}
        style={({ pressed }) => [
          styles.wrap,
          mine ? styles.wrapMine : styles.wrapTheirs,
          pressed && !!downloadUrl && styles.pressed,
        ]}
      >
        {downloadUrl ? (
          <Image source={{ uri: downloadUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            {loading ? (
              <ActivityIndicator size="small" color={SLColors.accentViolet} />
            ) : (
              <Ionicons name={failed ? 'image-outline' : 'image'} size={22} color={SLColors.textMuted} />
            )}
          </View>
        )}
        {!!attachment.filename && failed && (
          <Text style={styles.filename} numberOfLines={1}>
            {attachment.filename}
          </Text>
        )}
      </Pressable>
      <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
        <SafeAreaView style={styles.preview}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close image preview"
            onPress={() => setPreviewOpen(false)}
            style={styles.previewClose}
          >
            <Ionicons name="close" size={24} color={SLColors.textStrong} />
          </Pressable>
          {!!downloadUrl && <Image source={{ uri: downloadUrl }} style={styles.previewImage} resizeMode="contain" />}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 238,
    maxWidth: '100%',
    marginTop: 9,
    borderRadius: SLRadius.radiusCard,
    overflow: 'hidden',
    borderWidth: 1,
  },
  wrapMine: {
    backgroundColor: SLColors.surfaceMuted,
    borderColor: SLColors.borderSubtle,
  },
  wrapTheirs: {
    backgroundColor: SLColors.surfaceInset,
    borderColor: SLColors.borderSubtle,
  },
  pressed: {
    opacity: 0.88,
  },
  image: {
    width: '100%',
    aspectRatio: 1.25,
    backgroundColor: SLColors.background,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLColors.surfaceScrim,
  },
  filename: {
    color: SLColors.text,
    fontSize: SLTypography.micro.fontSize,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  preview: {
    flex: 1,
    backgroundColor: SLColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewClose: {
    position: 'absolute',
    top: 52,
    right: 18,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: SLRadius.radiusSheet,
    backgroundColor: SLColors.surfaceCommand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: SLColors.borderStrong,
  },
  previewImage: {
    width: '100%',
    height: '86%',
  },
});

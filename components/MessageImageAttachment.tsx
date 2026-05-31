import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MessengerAttachment, getAttachmentDownloadUrl } from '@/lib/api';

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
    Linking.openURL(downloadUrl).catch(() => {
      onError('Image could not be opened.');
    });
  };

  return (
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
            <ActivityIndicator size="small" color="#C4B5FD" />
          ) : (
            <Ionicons name={failed ? 'image-outline' : 'image'} size={22} color="#94A3B8" />
          )}
        </View>
      )}
      {!!attachment.filename && failed && (
        <Text style={styles.filename} numberOfLines={1}>
          {attachment.filename}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 238,
    maxWidth: '100%',
    marginTop: 9,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  wrapMine: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  wrapTheirs: {
    backgroundColor: 'rgba(2,6,23,0.50)',
    borderColor: 'rgba(148,163,184,0.14)',
  },
  pressed: {
    opacity: 0.88,
  },
  image: {
    width: '100%',
    aspectRatio: 1.25,
    backgroundColor: '#020617',
  },
  placeholder: {
    width: '100%',
    aspectRatio: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,6,23,0.78)',
  },
  filename: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});

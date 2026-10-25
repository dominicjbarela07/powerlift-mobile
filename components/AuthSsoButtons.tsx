import React, { useMemo } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/sl-text';
import { FontAwesome } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { mobileOAuthRequest, type ApiLoginResponse } from '@/lib/api';
import { SLColors, SLFontFamilies, SLRadius, SLTypography } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

type OAuthProvider = 'google' | 'apple';

type Props = {
  disabled?: boolean;
  oauthLoading: OAuthProvider | null;
  setOauthLoading: (provider: OAuthProvider | null) => void;
  onOAuthResult: (provider: OAuthProvider, idToken: string, res: ApiLoginResponse) => Promise<void>;
  onError: (message: string | null) => void;
};

type GoogleSsoButtonProps = Props & {
  googleClientIds: {
    iosClientId?: string;
    androidClientId?: string;
    webClientId?: string;
  };
};

function GoogleSsoButton({
  disabled = false,
  oauthLoading,
  setOauthLoading,
  onOAuthResult,
  onError,
  googleClientIds,
}: GoogleSsoButtonProps) {
  const [googleRequest, , promptGoogleAsync] = Google.useAuthRequest({
    ...googleClientIds,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
  });

  const handleGoogleSignIn = async () => {
    if (!googleRequest) {
      onError('Google sign-in is not configured for this build.');
      return;
    }

    onError(null);
    setOauthLoading('google');
    try {
      const result = await promptGoogleAsync();
      if (result.type !== 'success') {
        if (result.type !== 'dismiss' && result.type !== 'cancel') {
          onError('Google sign-in did not finish. Please try again.');
        }
        return;
      }
      const idToken =
        (result as any).authentication?.idToken ||
        (result as any).params?.id_token;
      if (!idToken) {
        onError('Google did not return an identity token. Please try again.');
        return;
      }
      const res = await mobileOAuthRequest('google', idToken);
      await onOAuthResult('google', idToken, res);
    } catch (err) {
      console.error('Google sign-in failed', err);
      onError('Google sign-in failed. Please try again.');
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.ssoButton,
        styles.ssoButtonGoogle,
        pressed && styles.ssoButtonPressed,
        (disabled || !googleRequest || oauthLoading === 'google') && styles.ssoButtonDisabled,
      ]}
      onPress={handleGoogleSignIn}
      disabled={disabled || !googleRequest || !!oauthLoading}
    >
      {oauthLoading === 'google' ? (
        <ActivityIndicator color={SLColors.surfaceRaised} />
      ) : (
        <>
          <FontAwesome name="google" size={17} color={SLColors.surfaceRaised} />
          <Text style={styles.ssoTextGoogle}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

export default function AuthSsoButtons({
  disabled = false,
  oauthLoading,
  setOauthLoading,
  onOAuthResult,
  onError,
}: Props) {
  const googleClientIds = useMemo(() => ({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  }), []);

  const googleConfigured = Platform.OS === 'ios'
    ? !!(googleClientIds.iosClientId || googleClientIds.webClientId)
    : Platform.OS === 'android'
      ? !!(googleClientIds.androidClientId || googleClientIds.webClientId)
      : !!googleClientIds.webClientId;

  if (!googleConfigured) {
    return null;
  }

  return (
    <View style={styles.ssoStack}>
      {googleConfigured ? (
        <GoogleSsoButton
          disabled={disabled}
          oauthLoading={oauthLoading}
          setOauthLoading={setOauthLoading}
          onOAuthResult={onOAuthResult}
          onError={onError}
          googleClientIds={googleClientIds}
        />
      ) : null}

      <View style={styles.emailDivider}>
        <View style={styles.emailDividerLine} />
        <Text style={styles.emailDividerText}>or continue with email</Text>
        <View style={styles.emailDividerLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emailDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  emailDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(222, 198, 166, 0.10)',
  },
  emailDividerText: {
    fontFamily: SLFontFamilies.sansMedium,
    fontSize: SLTypography.micro.fontSize,
    color: SLColors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  ssoStack: {
    gap: 10,
  },
  ssoButton: {
    minHeight: 50,
    borderRadius: SLRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ssoButtonGoogle: {
    backgroundColor: SLColors.white,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  ssoButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  ssoButtonDisabled: {
    opacity: 0.46,
  },
  ssoTextGoogle: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: SLTypography.rowTitle.fontSize,
    color: SLColors.surfaceRaised,
  },
});

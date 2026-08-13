import React, { useEffect, useMemo, useState } from 'react';
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
type AppleAuthenticationModule = typeof import('expo-apple-authentication');

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
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleAuth, setAppleAuth] = useState<AppleAuthenticationModule | null>(null);

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

  useEffect(() => {
    let mounted = true;
    import('expo-apple-authentication')
      .then(async (module) => {
        const available = await module.isAvailableAsync();
        if (mounted) {
          setAppleAuth(module);
          setAppleAvailable(available);
        }
      })
      .catch(() => {
        if (mounted) {
          setAppleAuth(null);
          setAppleAvailable(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleAppleSignIn = async () => {
    if (!appleAvailable || !appleAuth) {
      onError('Apple sign-in is not available on this device.');
      return;
    }

    onError(null);
    setOauthLoading('apple');
    try {
      const credential = await appleAuth.signInAsync({
        requestedScopes: [
          appleAuth.AppleAuthenticationScope.FULL_NAME,
          appleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });
      const idToken = credential.identityToken;
      if (!idToken) {
        onError('Apple did not return an identity token. Please try again.');
        return;
      }
      const res = await mobileOAuthRequest('apple', idToken, {
        first_name: credential.fullName?.givenName || undefined,
        last_name: credential.fullName?.familyName || undefined,
      });
      await onOAuthResult('apple', idToken, res);
    } catch (err: any) {
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        console.error('Apple sign-in failed', err);
        onError('Apple sign-in failed. Please try again.');
      }
    } finally {
      setOauthLoading(null);
    }
  };

  if (!googleConfigured && !appleAvailable) {
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

      {appleAvailable ? (
        <Pressable
          style={({ pressed }) => [
            styles.ssoButton,
            styles.ssoButtonApple,
            pressed && styles.ssoButtonPressed,
            (disabled || oauthLoading === 'apple') && styles.ssoButtonDisabled,
          ]}
          onPress={handleAppleSignIn}
          disabled={disabled || !!oauthLoading}
        >
          {oauthLoading === 'apple' ? (
            <ActivityIndicator color={SLColors.white} />
          ) : (
            <>
              <FontAwesome name="apple" size={20} color={SLColors.white} />
              <Text style={styles.ssoTextApple}>Continue with Apple</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  ssoButtonApple: {
    backgroundColor: SLColors.black,
    borderColor: 'rgba(255,255,255,0.18)',
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
  ssoTextApple: {
    fontFamily: SLFontFamilies.sansSemiBold,
    fontSize: SLTypography.rowTitle.fontSize,
    color: SLColors.white,
  },
});

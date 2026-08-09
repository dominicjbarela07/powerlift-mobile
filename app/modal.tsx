import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { SLColors } from '@/constants/theme';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <ThemedText variant="h1">This is a modal</ThemedText>
      <Link href="/" dismissTo style={styles.link}>
        <ThemedText variant="body" style={styles.linkText}>Go to home screen</ThemedText>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'transparent',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    color: SLColors.review,
  },
});
